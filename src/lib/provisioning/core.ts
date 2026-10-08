// ====================================================================
// QC NETCORE - PROVISIONING CORE (server-only, dependency-free)
// Validation, token handling, secret encryption and environment config.
// Never import this from a Client Component.
// ====================================================================

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const ROUTER_API_USER = "qc-netcore";

export type ProvisioningTokenStatus =
  | "PROVISIONING"
  | "AWAITING_CONNECTION"
  | "CONNECTED"
  | "EXPIRED"
  | "REVOKED";

// ---------- Validation ----------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROUTER_NAME = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/;

export interface BootstrapRequest {
  routerName?: string;
  routerOsVersion: "v6" | "v7";
  siteId?: string;
  routerId?: string;
}

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; field: string; message: string };

/**
 * Validates a bootstrap request body. `organizationId` is deliberately NOT read:
 * the organization is always resolved server-side from the session.
 */
export function validateBootstrapRequest(body: unknown): Validated<BootstrapRequest> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, field: "body", message: "Request body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;
  const routerOsVersion = b.routerOsVersion === undefined ? "v7" : b.routerOsVersion;
  if (routerOsVersion !== "v6" && routerOsVersion !== "v7") {
    return { ok: false, field: "routerOsVersion", message: "RouterOS version must be v6 or v7." };
  }
  const out: BootstrapRequest = { routerOsVersion };

  if (b.routerId !== undefined && b.routerId !== null && b.routerId !== "") {
    if (typeof b.routerId !== "string" || !UUID.test(b.routerId)) {
      return { ok: false, field: "routerId", message: "Router ID is not valid." };
    }
    out.routerId = b.routerId;
  }
  if (b.siteId !== undefined && b.siteId !== null && b.siteId !== "") {
    if (typeof b.siteId !== "string" || !UUID.test(b.siteId)) {
      return { ok: false, field: "siteId", message: "Site ID is not valid." };
    }
    out.siteId = b.siteId;
  }
  if (!out.routerId) {
    const name = typeof b.routerName === "string" ? b.routerName.trim() : "";
    if (!ROUTER_NAME.test(name)) {
      return {
        ok: false,
        field: "routerName",
        message: "Router name must be 1-64 characters: letters, numbers, spaces, '.', '_' or '-'.",
      };
    }
    out.routerName = name;
  }
  return { ok: true, value: out };
}

export interface RegistrationPayload {
  token: string;
  publicKey?: string;
  routerosVersion: string;
  boardModel: string;
  cpuLoad: number;
  freeMemoryMb: number;
  uptime: string;
}

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{32,128}$/;
const WG_KEY = /^[A-Za-z0-9+/]{43}=$/;
const SAFE_TEXT = /^[A-Za-z0-9 ._()+\-:/,]{0,100}$/;

export function validateRegistrationPayload(body: unknown): Validated<RegistrationPayload> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, field: "body", message: "Request body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.token !== "string" || !TOKEN_FORMAT.test(b.token)) {
    return { ok: false, field: "token", message: "Provisioning token is invalid." };
  }
  if (b.publicKey !== undefined && (typeof b.publicKey !== "string" || !WG_KEY.test(b.publicKey))) {
    return { ok: false, field: "publicKey", message: "WireGuard public key is invalid." };
  }
  const text = (key: string): string | null =>
    typeof b[key] === "string" && SAFE_TEXT.test(b[key] as string) ? (b[key] as string) : null;
  const version = text("routerosVersion");
  const board = text("boardModel");
  const uptime = text("uptime");
  if (version === null || board === null || uptime === null) {
    return { ok: false, field: "telemetry", message: "Router report contains invalid values." };
  }
  const cpu = Number(b.cpuLoad);
  const mem = Number(b.freeMemoryMb);
  if (!Number.isFinite(cpu) || cpu < 0 || cpu > 100 || !Number.isFinite(mem) || mem < 0) {
    return { ok: false, field: "telemetry", message: "Router report contains invalid values." };
  }
  return {
    ok: true,
    value: {
      token: b.token,
      publicKey: b.publicKey as string | undefined,
      routerosVersion: version,
      boardModel: board,
      cpuLoad: Math.round(cpu),
      freeMemoryMb: Math.round(mem),
      uptime,
    },
  };
}

export function routerOsMajor(version: string | null | undefined): "v6" | "v7" {
  return /^v?6/.test(String(version ?? "").trim()) ? "v6" : "v7";
}

// ---------- Tokens ----------

export function generateProvisioningToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateApiPassword(): string {
  return randomBytes(24).toString("base64url");
}

// ---------- Tunnel address allocation (10.200.0.0/16, gateway owns x.x.1.1) ----------

export function allocateTunnelIp(used: Iterable<string>, skip = 0): string | null {
  const taken = new Set(used);
  let seen = 0;
  for (let third = 1; third <= 254; third++) {
    for (let fourth = 2; fourth <= 254; fourth++) {
      const ip = `10.200.${third}.${fourth}`;
      if (taken.has(ip)) continue;
      if (seen++ < skip) continue;
      return ip;
    }
  }
  return null;
}

// ---------- Secret encryption (AES-256-GCM, APP_ENCRYPTION_KEY) ----------

export function encryptSecret(plain: string, keyHex: string): string {
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) throw new Error("APP_ENCRYPTION_KEY must be 64 hex characters");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

export function decryptSecret(payload: string, keyHex: string): string {
  const [v, iv, tag, ct] = payload.split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unsupported ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}

// ---------- Environment configuration ----------

export interface ProvisioningEnv {
  baseUrl: string;
  gatewayHost: string;
  gatewayPort: number;
  gatewayPublicKey: string;
  radiusServer: string;
  radiusSecret: string;
  radiusAuthPort: number;
  radiusAcctPort: number;
  hotspotDnsName?: string;
  portalDomain: string;
  encryptionKey: string;
}

export type ProvisioningEnvResult =
  | { ok: true; config: ProvisioningEnv }
  | { ok: false; missing: string[] };

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const HOST = /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*$/;

/**
 * Reads infrastructure configuration from server environment variables.
 * Returns the NAMES of missing/invalid variables (never values) on failure.
 */
export function loadProvisioningEnv(env: Record<string, string | undefined>): ProvisioningEnvResult {
  const missing: string[] = [];
  const get = (k: string) => (env[k] ?? "").trim();

  const endpoint = get("WIREGUARD_PUBLIC_ENDPOINT");
  const m = /^([^:\s]+):(\d{1,5})$/.exec(endpoint);
  const gatewayHost = m?.[1] ?? "";
  const gatewayPort = m ? Number(m[2]) : 0;
  if (!m || (!IPV4.test(gatewayHost) && !HOST.test(gatewayHost)) || gatewayPort < 1 || gatewayPort > 65535) {
    missing.push("WIREGUARD_PUBLIC_ENDPOINT");
  }

  const gatewayPublicKey = get("WIREGUARD_SERVER_PUBLIC_KEY");
  if (!WG_KEY.test(gatewayPublicKey)) missing.push("WIREGUARD_SERVER_PUBLIC_KEY");

  const radiusServer = get("RADIUS_SERVER");
  if (!IPV4.test(radiusServer)) missing.push("RADIUS_SERVER");
  const radiusSecret = get("RADIUS_SECRET");
  if (radiusSecret.length < 8) missing.push("RADIUS_SECRET");

  const rawBaseUrl = (get("PROVISIONING_BASE_URL") || get("NEXT_PUBLIC_APP_URL")).replace(/\/+$/, "");
  let portalDomain = "";
  let baseUrl = rawBaseUrl;
  try {
    const u = new URL(rawBaseUrl);
    // In production, require https to prevent cleartext token interception over internet
    const isLocal = u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname.endsWith(".internal") || u.hostname.endsWith(".local");
    if (process.env.NODE_ENV === "production" && !isLocal && u.protocol !== "https:") {
      missing.push("PROVISIONING_BASE_URL (HTTPS required in production)");
    }
    portalDomain = u.hostname;
    baseUrl = u.origin;
  } catch {
    missing.push("PROVISIONING_BASE_URL");
  }

  const encryptionKey = get("APP_ENCRYPTION_KEY");
  if (!/^[0-9a-fA-F]{64}$/.test(encryptionKey)) missing.push("APP_ENCRYPTION_KEY");
  if (!get("SUPABASE_SERVICE_ROLE_KEY")) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  const port = (k: string, def: number) => {
    const v = get(k);
    if (!v) return def;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 65535) missing.push(k);
    return n;
  };
  const radiusAuthPort = port("RADIUS_AUTH_PORT", 1812);
  const radiusAcctPort = port("RADIUS_ACCT_PORT", 1813);
  const hotspotDnsName = get("HOTSPOT_DNS_NAME") || undefined;
  if (hotspotDnsName && !HOST.test(hotspotDnsName)) missing.push("HOTSPOT_DNS_NAME");

  if (missing.length) return { ok: false, missing };
  return {
    ok: true,
    config: {
      baseUrl,
      gatewayHost,
      gatewayPort,
      gatewayPublicKey,
      radiusServer,
      radiusSecret,
      radiusAuthPort,
      radiusAcctPort,
      hotspotDnsName,
      portalDomain,
      encryptionKey,
    },
  };
}

export interface ConfigDiagnosticStatus {
  key: string;
  status: "configured" | "missing" | "invalid";
}

/**
 * Safe diagnostic configuration inspector.
 * Reports ONLY status flags ('configured' | 'missing' | 'invalid').
 * NEVER reveals secret values, keys, or passwords.
 */
export function getProvisioningConfigDiagnostics(env: Record<string, string | undefined>): {
  ready: boolean;
  diagnostics: ConfigDiagnosticStatus[];
} {
  const get = (k: string) => (env[k] ?? "").trim();
  const res = loadProvisioningEnv(env);
  const keys = [
    "WIREGUARD_PUBLIC_ENDPOINT",
    "WIREGUARD_SERVER_PUBLIC_KEY",
    "RADIUS_SERVER",
    "RADIUS_SECRET",
    "PROVISIONING_BASE_URL",
    "APP_ENCRYPTION_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];

  const missingSet = new Set(res.ok ? [] : res.missing);
  const diagnostics: ConfigDiagnosticStatus[] = keys.map((key) => {
    const val = get(key);
    if (!val) return { key, status: "missing" };
    if (missingSet.has(key)) return { key, status: "invalid" };
    return { key, status: "configured" };
  });

  return { ready: res.ok, diagnostics };
}

