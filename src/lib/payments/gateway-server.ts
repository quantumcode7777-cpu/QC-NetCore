// ====================================================================
// Server-only payment gateway configuration access.
// Decrypted secrets never leave this module except through Daraja calls.
// ====================================================================

import { jsonError, type AnyClient } from "@/lib/captive/server";
import { decryptSecret, encryptSecret } from "@/lib/provisioning/core";
import type { DarajaCredentials } from "./daraja";
import {
  gatewayMissingFields,
  maskGatewayConfig,
  mergeGatewaySecrets,
  SECRET_MASK,
  type GatewayConfigInput,
  type GatewayConfigView,
} from "./gateway";

const ADMIN_ROLES = new Set(["super_admin", "isp_owner", "isp_admin"]);
type Row = Record<string, unknown>;

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function nullable(value: unknown): string | null {
  const v = text(value);
  return v ? v : null;
}

function envCredentials(): DarajaCredentials | null {
  const environment = text(process.env.DARAJA_ENVIRONMENT) === "production" ? "production" : "sandbox";
  const credentials: DarajaCredentials = {
    environment,
    shortcode: text(process.env.DARAJA_SHORTCODE),
    passkey: text(process.env.DARAJA_PASSKEY),
    consumerKey: text(process.env.DARAJA_CONSUMER_KEY),
    consumerSecret: text(process.env.DARAJA_CONSUMER_SECRET),
  };
  return gatewayMissingFields(credentials).length === 0 ? credentials : null;
}

function defaultUrls(): { callbackUrl: string; confirmationUrl: string; validationUrl: string } {
  const base = (
    text(process.env.PROVISIONING_BASE_URL) ||
    text(process.env.NEXT_PUBLIC_APP_URL) ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
  return {
    callbackUrl:
      text(process.env.MPESA_CALLBACK_URL) || `${base}/api/v1/mpesa-callback`,
    confirmationUrl: `${base}/api/v1/mpesa-c2b/confirmation`,
    validationUrl: `${base}/api/v1/mpesa-c2b/validation`,
  };
}

/** Append the optional shared secret to a publicly registered callback URL. */
export function withWebhookToken(url: string): string {
  const token = text(process.env.MPESA_WEBHOOK_TOKEN);
  if (!token || !url) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("token", token);
    return parsed.toString();
  } catch {
    return url;
  }
}

async function serviceDb(): Promise<AnyClient> {
  const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
  return createSupabaseServiceClient() as unknown as AnyClient;
}

function decryptRow(row: Row): GatewayConfigView {
  const key = text(process.env.APP_ENCRYPTION_KEY);
  const decrypt = (value: unknown) => {
    const raw = text(value);
    if (!raw) return "";
    try {
      return key ? decryptSecret(raw, key) : "";
    } catch {
      return "";
    }
  };
  const urls = defaultUrls();
  return {
    id: text(row.id),
    organizationId: text(row.organization_id),
    provider: "MPESA_DARAJA",
    environment: text(row.environment) === "production" ? "production" : "sandbox",
    shortcode: text(row.shortcode),
    callbackUrl: text(row.callback_url) || urls.callbackUrl,
    confirmationUrl: text(row.confirmation_url) || urls.confirmationUrl,
    validationUrl: text(row.validation_url) || urls.validationUrl,
    consumerKey: decrypt(row.consumer_key_encrypted),
    consumerSecret: decrypt(row.consumer_secret_encrypted),
    passkey: decrypt(row.passkey_encrypted),
    isEnabled: row.is_enabled !== false,
    c2bRegisteredAt: nullable(row.c2b_registered_at),
    source: "organization",
  };
}

function envView(): GatewayConfigView {
  const credentials = envCredentials();
  const urls = defaultUrls();
  return {
    organizationId: "",
    provider: "MPESA_DARAJA",
    environment: credentials?.environment ?? "sandbox",
    shortcode: credentials?.shortcode ?? "",
    ...urls,
    consumerKey: credentials?.consumerKey ? SECRET_MASK : "",
    consumerSecret: credentials?.consumerSecret ? SECRET_MASK : "",
    passkey: credentials?.passkey ? SECRET_MASK : "",
    isEnabled: Boolean(credentials),
    source: credentials ? "platform" : "none",
    missing: credentials ? [] : ["gateway configuration"],
  };
}

/** Returns plaintext config for server-to-server calls only. */
export async function loadGatewayConfig(orgId: string): Promise<{
  ok: boolean;
  config: GatewayConfigView | null;
  warning?: string;
}> {
  try {
    const db = await serviceDb();
    const { data, error } = await db
      .from("payment_gateways")
      .select("*")
      .eq("organization_id", orgId)
      .eq("provider", "MPESA_DARAJA")
      .maybeSingle();
    if (error) {
      return {
        ok: false,
        config: null,
        warning: `gateway table unavailable: ${error.message ?? "query failed"}`,
      };
    }
    if (!data) return { ok: true, config: null };
    return { ok: true, config: decryptRow(data as Row) };
  } catch (err) {
    return {
      ok: false,
      config: null,
      warning: err instanceof Error ? err.message : "gateway configuration unavailable",
    };
  }
}

export async function resolveGatewayCredentials(orgId: string): Promise<
  | {
      ok: true;
      source: "organization" | "platform";
      credentials: DarajaCredentials;
      callbackUrl: string;
      warning?: string;
    }
  | { ok: false; status: number; code: string; message: string }
> {
  const loaded = await loadGatewayConfig(orgId);
  const orgConfig = loaded.config;
  if (orgConfig?.isEnabled) {
    const missing = gatewayMissingFields(orgConfig);
    if (missing.length === 0) {
      return {
        ok: true,
        source: "organization",
        credentials: {
          environment: orgConfig.environment,
          shortcode: orgConfig.shortcode,
          passkey: orgConfig.passkey,
          consumerKey: orgConfig.consumerKey,
          consumerSecret: orgConfig.consumerSecret,
        },
        callbackUrl: withWebhookToken(orgConfig.callbackUrl),
        warning: loaded.warning,
      };
    }
  }

  const fallback = envCredentials();
  if (fallback) {
    return {
      ok: true,
      source: "platform",
      credentials: fallback,
      callbackUrl: withWebhookToken(defaultUrls().callbackUrl),
      warning:
        loaded.warning ||
        (orgConfig ? `Organization gateway is incomplete: ${gatewayMissingFields(orgConfig).join(", ")}` : undefined),
    };
  }

  const missing = orgConfig?.isEnabled
    ? gatewayMissingFields(orgConfig)
    : ["organization gateway", "DARAJA_CONSUMER_KEY", "DARAJA_CONSUMER_SECRET", "DARAJA_PASSKEY", "DARAJA_SHORTCODE"];
  return {
    ok: false,
    status: 503,
    code: "GATEWAY_NOT_CONFIGURED",
    message: `M-Pesa gateway is not configured. Missing: ${missing.join(", ")}.`,
  };
}

/** Safe for the browser: secrets are masked, never decrypted into the response. */
export async function getGatewayView(orgId: string): Promise<{
  view: GatewayConfigView;
  warning?: string;
}> {
  const loaded = await loadGatewayConfig(orgId);
  if (loaded.config) return { view: maskGatewayConfig(loaded.config), warning: loaded.warning };
  const view = envView();
  view.organizationId = orgId;
  return { view, warning: loaded.warning };
}

export async function saveGatewayConfig(
  orgId: string,
  input: GatewayConfigInput,
  actorRole?: string | null
): Promise<
  | { ok: true; view: GatewayConfigView }
  | { ok: false; status: number; code: string; message: string }
> {
  if (!actorRole || !ADMIN_ROLES.has(actorRole)) {
    return {
      ok: false,
      status: 403,
      code: "PERMISSION_DENIED",
      message: "Only an ISP owner or administrator can change payment credentials.",
    };
  }
  const key = text(process.env.APP_ENCRYPTION_KEY);
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    return {
      ok: false,
      status: 503,
      code: "ENCRYPTION_KEY_MISSING",
      message: "APP_ENCRYPTION_KEY must be set to 64 hex characters before saving secrets.",
    };
  }

  const loaded = await loadGatewayConfig(orgId);
  const merged = mergeGatewaySecrets(loaded.config, input);
  const missing = gatewayMissingFields(merged);
  if (missing.length > 0) {
    return {
      ok: false,
      status: 400,
      code: "INCOMPLETE_GATEWAY",
      message: `Provide: ${missing.join(", ")}.`,
    };
  }

  try {
    const db = await serviceDb();
    const now = new Date().toISOString();
    const row = {
      organization_id: orgId,
      provider: "MPESA_DARAJA",
      environment: input.environment,
      shortcode: input.shortcode,
      passkey_encrypted: encryptSecret(merged.passkey, key),
      consumer_key_encrypted: encryptSecret(merged.consumerKey, key),
      consumer_secret_encrypted: encryptSecret(merged.consumerSecret, key),
      callback_url: input.callbackUrl,
      confirmation_url: input.confirmationUrl,
      validation_url: input.validationUrl,
      is_enabled: input.isEnabled,
      last_error: null,
      updated_at: now,
    };
    const { error } = await db
      .from("payment_gateways")
      .upsert(row, { onConflict: "organization_id,provider" });
    if (error) {
      return {
        ok: false,
        status: 500,
        code: "GATEWAY_SAVE_FAILED",
        message: "Could not save the gateway configuration. Check that migration 026 has been applied.",
      };
    }
    const { view } = await getGatewayView(orgId);
    return { ok: true, view };
  } catch (err) {
    console.error("[Payment gateway] save failed:", err);
    return {
      ok: false,
      status: 503,
      code: "GATEWAY_UNAVAILABLE",
      message: "Could not save the gateway configuration right now.",
    };
  }
}

export async function markGatewayRegistration(orgId: string, error?: string): Promise<void> {
  try {
    const db = await serviceDb();
    await db
      .from("payment_gateways")
      .update({
        c2b_registered_at: error ? null : new Date().toISOString(),
        last_tested_at: new Date().toISOString(),
        last_error: error ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", orgId)
      .eq("provider", "MPESA_DARAJA");
  } catch (err) {
    console.error("[Payment gateway] registration marker failed:", err);
  }
}

export async function resolveOrgByShortcode(shortcode: string): Promise<{
  organizationId: string;
  organizationName?: string;
  source: "organization" | "platform";
} | null> {
  const clean = text(shortcode).trim();
  if (!clean) return null;
  try {
    const db = await serviceDb();
    const { data } = await db
      .from("payment_gateways")
      .select("organization_id, organizations(name)")
      .eq("shortcode", clean)
      .maybeSingle();
    if (data?.organization_id) {
      const relation = data.organizations as unknown;
      const name =
        relation && typeof relation === "object" && "name" in relation
          ? text((relation as { name?: unknown }).name)
          : undefined;
      return { organizationId: text(data.organization_id), organizationName: name, source: "organization" };
    }
  } catch {
    // Table may not exist yet; fall through to the platform shortcode.
  }

  if (clean === text(process.env.DARAJA_SHORTCODE)) {
    const orgId = text(process.env.MPESA_DEFAULT_ORGANIZATION_ID);
    if (orgId) return { organizationId: orgId, source: "platform" };
  }
  return null;
}

/** Resolves an STK callback to the org that initiated the checkout request. */
export async function resolveOrgByCheckoutRequest(checkoutRequestId: string): Promise<string | null> {
  const clean = text(checkoutRequestId).trim();
  if (!clean) return null;
  try {
    const db = await serviceDb();
    const { data } = await db
      .from("payments")
      .select("organization_id")
      .eq("transaction_reference", clean)
      .maybeSingle();
    if (data?.organization_id) return text(data.organization_id);
  } catch {
    // Ignore and use the configured default below.
  }
  return text(process.env.MPESA_DEFAULT_ORGANIZATION_ID) || null;
}

export function gatewayAdminError(role?: string | null) {
  if (!role || !ADMIN_ROLES.has(role)) {
    return jsonError(403, "PERMISSION_DENIED", "Only an ISP owner or administrator can manage payments.");
  }
  return null;
}
