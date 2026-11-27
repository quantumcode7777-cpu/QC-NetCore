// ====================================================================
// Safaricom Daraja HTTP layer (server-side only).
//
// The pure helpers here are deterministic and dependency-injected so they can
// be unit-tested with `node --test`. The network functions use native fetch;
// no credentials are logged or returned to the browser.
// ====================================================================

import { createHash } from "node:crypto";

export type DarajaEnvironment = "sandbox" | "production";

export interface DarajaCredentials {
  environment: DarajaEnvironment;
  shortcode: string;
  passkey: string;
  consumerKey: string;
  consumerSecret: string;
}

export interface DarajaStkRequest {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  callbackUrl: string;
}

export interface DarajaStkResponse {
  success: boolean;
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
}

export interface DarajaC2BRegistration {
  confirmationUrl: string;
  validationUrl: string;
}

const BASE_URLS: Record<DarajaEnvironment, string> = {
  sandbox: "https://sandbox.safaricom.co.ke",
  production: "https://api.safaricom.co.ke",
};

export function darajaBaseUrl(environment: DarajaEnvironment): string {
  return BASE_URLS[environment] ?? BASE_URLS.sandbox;
}

export function oauthUrl(environment: DarajaEnvironment): string {
  return `${darajaBaseUrl(environment)}/oauth/v1/generate?grant_type=client_credentials`;
}

export function stkPushUrl(environment: DarajaEnvironment): string {
  return `${darajaBaseUrl(environment)}/mpesa/stkpush/v1/processrequest`;
}

export function c2bRegisterUrl(environment: DarajaEnvironment): string {
  return `${darajaBaseUrl(environment)}/mpesa/c2b/v1/registerurl`;
}

/** Daraja expects YYYYMMDDHHMMSS with no timezone suffix. */
export function darajaTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/** Base64(SHA256(shortcode + passkey + timestamp)). */
export function darajaPassword(shortcode: string, passkey: string, timestamp: string): string {
  return createHash("sha256")
    .update(`${shortcode}${passkey}${timestamp}`)
    .digest("base64");
}

export interface DarajaStkPayload {
  BusinessShortCode: string;
  Password: string;
  Timestamp: string;
  TransactionType: "CustomerPayBillOnline";
  Amount: number;
  PartyA: string;
  PartyB: string;
  PhoneNumber: string;
  CallBackURL: string;
  AccountReference: string;
  TransactionDesc: string;
}

export function buildStkPayload(
  credentials: DarajaCredentials,
  request: DarajaStkRequest,
  now: Date
): DarajaStkPayload {
  const timestamp = darajaTimestamp(now);
  return {
    BusinessShortCode: credentials.shortcode,
    Password: darajaPassword(credentials.shortcode, credentials.passkey, timestamp),
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.round(Number(request.amount) * 100) / 100,
    PartyA: request.phoneNumber,
    PartyB: credentials.shortcode,
    PhoneNumber: request.phoneNumber,
    CallBackURL: request.callbackUrl,
    AccountReference: request.accountReference.slice(0, 50),
    TransactionDesc: request.transactionDesc.slice(0, 100),
  };
}

export function parseOAuthResponse(json: unknown): string {
  if (!json || typeof json !== "object") throw new Error("Daraja OAuth returned an invalid response.");
  const token = (json as { access_token?: unknown }).access_token;
  if (typeof token !== "string" || !token) {
    throw new Error("Daraja OAuth did not return an access token.");
  }
  return token;
}

export function parseStkResponse(json: unknown): DarajaStkResponse {
  if (!json || typeof json !== "object") throw new Error("Daraja returned an invalid STK response.");
  const row = json as Record<string, unknown>;
  const code = String(row.ResponseCode ?? "");
  return {
    success: code === "0",
    merchantRequestId: String(row.MerchantRequestID ?? ""),
    checkoutRequestId: String(row.CheckoutRequestID ?? ""),
    responseCode: code,
    responseDescription: String(row.ResponseDescription ?? ""),
    customerMessage: String(row.CustomerMessage ?? ""),
  };
}

export async function requestOAuthToken(
  credentials: DarajaCredentials,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const basic = Buffer.from(
    `${credentials.consumerKey}:${credentials.consumerSecret}`
  ).toString("base64");
  const response = await fetchImpl(oauthUrl(credentials.environment), {
    method: "GET",
    headers: { Authorization: `Basic ${basic}` },
    cache: "no-store",
  });
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Daraja authentication failed (HTTP ${response.status}).`);
  }
  return parseOAuthResponse(json);
}

export async function initiateDarajaSTKPush(
  credentials: DarajaCredentials,
  request: DarajaStkRequest,
  fetchImpl: typeof fetch = fetch,
  now: Date = new Date()
): Promise<DarajaStkResponse> {
  if (!Number.isFinite(request.amount) || request.amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }
  if (!/^254\d{9}$/.test(request.phoneNumber)) {
    throw new Error("Phone number must be in 254XXXXXXXXX format.");
  }
  if (!/^https?:\/\//.test(request.callbackUrl)) {
    throw new Error("A valid publicly reachable callback URL is required.");
  }

  const token = await requestOAuthToken(credentials, fetchImpl);
  const response = await fetchImpl(stkPushUrl(credentials.environment), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildStkPayload(credentials, request, now)),
    cache: "no-store",
  });
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Daraja STK request failed (HTTP ${response.status}).`);
  }
  const parsed = parseStkResponse(json);
  if (!parsed.success) {
    throw new Error(parsed.responseDescription || "Daraja rejected the STK request.");
  }
  return parsed;
}

export async function registerC2BUrls(
  credentials: DarajaCredentials,
  urls: DarajaC2BRegistration,
  fetchImpl: typeof fetch = fetch
): Promise<{ responseCode: string; responseDescription: string }> {
  const token = await requestOAuthToken(credentials, fetchImpl);
  const response = await fetchImpl(c2bRegisterUrl(credentials.environment), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ShortCode: credentials.shortcode,
      ResponseType: "Completed",
      ConfirmationURL: urls.confirmationUrl,
      ValidationURL: urls.validationUrl,
    }),
    cache: "no-store",
  });
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Daraja C2B registration failed (HTTP ${response.status}).`);
  }
  const row = (json ?? {}) as Record<string, unknown>;
  const code = String(row.ResponseCode ?? "");
  if (code && code !== "0") {
    throw new Error(String(row.ResponseDescription || "Daraja rejected C2B registration."));
  }
  return {
    responseCode: code || "0",
    responseDescription: String(row.ResponseDescription ?? "URLs registered"),
  };
}

export interface DarajaC2BEvent {
  transactionReference: string;
  amount: number;
  msisdnPhone: string;
  accountReference: string;
  senderName: string;
  shortcode: string;
}

function pickItem(payload: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (payload[key] !== undefined && payload[key] !== null) return payload[key];
  }
  return undefined;
}

/** Normalizes the C2B confirmation/validation payload across Daraja field casing. */
export function parseC2BEvent(payload: unknown): DarajaC2BEvent {
  if (!payload || typeof payload !== "object") throw new Error("Invalid C2B payload.");
  const row = payload as Record<string, unknown>;
  const ref = String(pickItem(row, ["TransID", "TransactionId", "transactionId"]) ?? "").trim();
  const amount = Number(pickItem(row, ["TransAmount", "Amount", "amount"]) ?? 0);
  const msisdn = String(pickItem(row, ["MSISDN", "msisdn", "PhoneNumber"]) ?? "").trim();
  const account = String(
    pickItem(row, ["BillRefNumber", "AccountNumber", "accountReference"]) ?? ""
  ).trim();
  const first = String(pickItem(row, ["FirstName", "firstName"]) ?? "").trim();
  const middle = String(pickItem(row, ["MiddleName", "middleName"]) ?? "").trim();
  const last = String(pickItem(row, ["LastName", "lastName"]) ?? "").trim();
  const senderName = [first, middle, last].filter(Boolean).join(" ");
  const shortcode = String(
    pickItem(row, ["BusinessShortCode", "ShortCode", "shortcode"]) ?? ""
  ).trim();

  if (!ref || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("C2B payload is missing a transaction id or a valid amount.");
  }
  return {
    transactionReference: ref,
    amount,
    msisdnPhone: msisdn,
    accountReference: account,
    senderName,
    shortcode,
  };
}
