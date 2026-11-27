// ====================================================================
// Payment Gateway — pure configuration and reconciliation helpers.
// No Supabase/Next imports: route handlers and `node --test` share this code.
// ====================================================================

import { timingSafeEqual } from "node:crypto";
import {
  normalizeAccountRef,
  normalizeKenyanMsisdn,
  reconcileIncomingPayment,
  type IncomingPaymentEvent,
  type ReconcilableInvoice,
  type ReconcilableSubscriber,
} from "./reconciliation.ts";
import type { DarajaEnvironment } from "./daraja.ts";

export const SECRET_MASK = "••••••••";

export type GatewayProvider = "MPESA_DARAJA";

export interface GatewaySecretFields {
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
}

export interface GatewayConfigInput extends GatewaySecretFields {
  environment: DarajaEnvironment;
  shortcode: string;
  callbackUrl: string;
  confirmationUrl: string;
  validationUrl: string;
  isEnabled: boolean;
}

export interface GatewayConfigView {
  id?: string;
  organizationId: string;
  provider: GatewayProvider;
  environment: DarajaEnvironment;
  shortcode: string;
  callbackUrl: string;
  confirmationUrl: string;
  validationUrl: string;
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  isEnabled: boolean;
  c2bRegisteredAt?: string | null;
  source?: "organization" | "platform" | "none";
  missing?: string[];
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; code: string; message: string };

const ENVIRONMENTS: DarajaEnvironment[] = ["sandbox", "production"];

function trim(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function validHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Shared validation for the gateway form and API. */
export function validateGatewayInput(
  body: Record<string, unknown>
): ValidationResult<GatewayConfigInput> {
  const environment = trim(body.environment) as DarajaEnvironment;
  if (!ENVIRONMENTS.includes(environment)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_ENVIRONMENT",
      message: "Environment must be sandbox or production.",
    };
  }

  const shortcode = trim(body.shortcode);
  if (!/^\d{5,9}$/.test(shortcode)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_SHORTCODE",
      message: "Enter a 5–9 digit M-Pesa paybill or till number.",
    };
  }

  const callbackUrl = trim(body.callbackUrl);
  const confirmationUrl = trim(body.confirmationUrl);
  const validationUrl = trim(body.validationUrl);
  for (const [name, value] of [
    ["callback URL", callbackUrl],
    ["confirmation URL", confirmationUrl],
    ["validation URL", validationUrl],
  ]) {
    if (!value || !validHttpUrl(value)) {
      return {
        ok: false,
        status: 400,
        code: "INVALID_URL",
        message: `Enter a valid ${name}.`,
      };
    }
  }

  return {
    ok: true,
    value: {
      environment,
      shortcode,
      callbackUrl,
      confirmationUrl,
      validationUrl,
      consumerKey: trim(body.consumerKey),
      consumerSecret: trim(body.consumerSecret),
      passkey: trim(body.passkey),
      isEnabled: body.isEnabled === undefined ? true : Boolean(body.isEnabled),
    },
  };
}

/**
 * Browser never receives decrypted secrets. If the form posts the mask or an
 * empty secret field, keep the stored encrypted value.
 */
export function mergeGatewaySecrets<T extends GatewaySecretFields>(
  existing: T | null,
  incoming: T
): T {
  const keep = (next: string, previous?: string) => {
    const clean = trim(next);
    return clean === "" || clean === SECRET_MASK ? (previous ?? "") : clean;
  };
  return {
    ...incoming,
    consumerKey: keep(incoming.consumerKey, existing?.consumerKey),
    consumerSecret: keep(incoming.consumerSecret, existing?.consumerSecret),
    passkey: keep(incoming.passkey, existing?.passkey),
  };
}

export function gatewayMissingFields(
  config: Pick<GatewayConfigView, "consumerKey" | "consumerSecret" | "passkey" | "shortcode"> | null
): string[] {
  const missing: string[] = [];
  if (!config) return ["gateway configuration"];
  if (!trim(config.shortcode)) missing.push("shortcode");
  if (!trim(config.consumerKey)) missing.push("consumer key");
  if (!trim(config.consumerSecret)) missing.push("consumer secret");
  if (!trim(config.passkey)) missing.push("passkey");
  return missing;
}

export function maskGatewayConfig(config: GatewayConfigView): GatewayConfigView {
  return {
    ...config,
    consumerKey: config.consumerKey ? SECRET_MASK : "",
    consumerSecret: config.consumerSecret ? SECRET_MASK : "",
    passkey: config.passkey ? SECRET_MASK : "",
  };
}

/** Optional shared-secret guard for webhook URLs registered with Daraja. */
export function verifyWebhookToken(expected: string | undefined, provided: string | null): boolean {
  if (!expected) return true;
  if (!provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface UnmatchedPayment {
  id: string;
  transactionReference: string;
  providerReceipt?: string | null;
  amount: number;
  paymentMethod: string;
  msisdnPhone: string;
  senderName?: string | null;
  accountReference?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  invoiceId?: string | null;
  createdAt: string;
}

export interface UnmatchedPaymentView extends UnmatchedPayment {
  suggestedCustomerId?: string;
  suggestedCustomerName?: string;
  suggestedInvoiceId?: string;
  matchBy?: "ACCOUNT_NUMBER" | "PHONE_NUMBER" | "SENDER_NAME";
  matchConfidence?: number;
  note?: string;
}

interface CustomerForMatch {
  id: string;
  accountNumber: string;
  fullName: string;
  phoneNumber: string;
  altPhoneNumber?: string | null;
}

interface InvoiceForMatch {
  id: string;
  customerId: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID";
}

function toSubscriber(c: CustomerForMatch): ReconcilableSubscriber {
  return {
    id: c.id,
    accountNumber: c.accountNumber,
    fullName: c.fullName,
    phoneNumber: c.phoneNumber,
    altPhoneNumber: c.altPhoneNumber ?? undefined,
    balanceDue: 0,
  };
}

function toInvoice(i: InvoiceForMatch): ReconcilableInvoice {
  return {
    id: i.id,
    customerId: i.customerId,
    invoiceNumber: i.id,
    totalAmount: i.totalAmount,
    amountPaid: i.amountPaid,
    balanceDue: i.balanceDue,
    status: i.status,
  };
}

/** Suggestions only — the operator explicitly resolves an unmatched payment. */
export function buildUnmatchedViews(
  payments: UnmatchedPayment[],
  customers: CustomerForMatch[],
  invoices: InvoiceForMatch[]
): UnmatchedPaymentView[] {
  const subs = customers.map(toSubscriber);
  const openInvoices = invoices.map(toInvoice);

  return payments.map((p) => {
    const event: IncomingPaymentEvent = {
      transactionReference: p.transactionReference,
      channel: p.paymentMethod,
      amount: p.amount,
      msisdnPhone: p.msisdnPhone,
      accountReference: p.accountReference ?? undefined,
      senderName: p.senderName ?? undefined,
    };
    const result = reconcileIncomingPayment({
      payment: event,
      subscribers: subs,
      openInvoices,
    });
    const matched = result.matchStatus !== "UNMATCHED" && result.matchStatus !== "DUPLICATE";
    return {
      ...p,
      ...(matched && result.matchedCustomerId
        ? {
            suggestedCustomerId: result.matchedCustomerId,
            suggestedCustomerName: result.matchedCustomerName,
            suggestedInvoiceId: result.matchedInvoiceId,
            matchBy: result.matchedBy === "NONE" ? undefined : result.matchedBy,
            matchConfidence: result.matchConfidence,
          }
        : { note: result.discrepancyReason }),
    };
  });
}

export function accountRefFromRawPayload(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const candidates = [
    row.accountReference,
    row.AccountNumber,
    row.BillRefNumber,
    (row.Body as Record<string, unknown> | undefined)?.stkCallback,
  ];
  const direct = candidates.find((v) => typeof v === "string" && trim(v));
  if (typeof direct === "string") return normalizeAccountRef(direct) || direct;
  return null;
}

export function normalizePhoneForMatch(phone: string | null | undefined): string {
  return normalizeKenyanMsisdn(phone);
}
