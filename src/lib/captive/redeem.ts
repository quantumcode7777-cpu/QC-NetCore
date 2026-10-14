// ====================================================================
// QC NetCore — Captive portal voucher redemption (pure logic).
// Thinly wrapped by POST /api/v1/captive/redeem. Tested by
// tests/captive-redeem.test.mjs. No server imports — safe for client code.
// ====================================================================

export interface RedeemVoucherRow {
  id: string;
  organization_id: string;
  plan_id: string;
  code: string;
  status: string;
  first_activated_at: string | null;
  expires_at: string | null;
}

export interface RedeemPlanRow {
  id: string;
  name: string;
  service_type: string;
  validity_duration_seconds: number;
  is_active: boolean;
}

export type RedeemDecision =
  | { ok: true; firstActivation: boolean; validityDurationSeconds: number | null }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
      /** Caller should flip a USED-but-lapsed voucher to EXPIRED (purges rad rows). */
      markExpired?: boolean;
    };

/** Codes are printed/stored UPPERCASE with dashes (e.g. GT-8924-XYZ). */
export function normalizeVoucherCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function decideRedeem(
  voucher: RedeemVoucherRow | null,
  plan: RedeemPlanRow | null,
  nowMs: number
): RedeemDecision {
  if (!voucher) {
    return {
      ok: false,
      status: 404,
      code: "VOUCHER_NOT_FOUND",
      message: "Voucher code not found. Check the code and try again.",
    };
  }
  if (voucher.status === "DISABLED") {
    return {
      ok: false,
      status: 403,
      code: "VOUCHER_DISABLED",
      message: "This voucher has been disabled. Contact support.",
    };
  }
  if (voucher.status === "EXPIRED") {
    return {
      ok: false,
      status: 410,
      code: "VOUCHER_EXPIRED",
      message: "This voucher has expired.",
    };
  }
  if (voucher.status === "USED") {
    // Matches the RADIUS writer semantics (migration 022): a USED voucher
    // with no expiry recorded, or a future one, still authenticates.
    if (!voucher.expires_at) {
      return { ok: true, firstActivation: false, validityDurationSeconds: null };
    }
    const exp = Date.parse(voucher.expires_at);
    if (Number.isFinite(exp) && exp > nowMs) {
      return { ok: true, firstActivation: false, validityDurationSeconds: null };
    }
    return {
      ok: false,
      status: 410,
      code: "VOUCHER_EXPIRED",
      message: "This voucher has expired.",
      markExpired: true,
    };
  }
  if (voucher.status !== "AVAILABLE") {
    return {
      ok: false,
      status: 500,
      code: "VOUCHER_STATE_UNKNOWN",
      message: "This voucher cannot be used right now. Contact support.",
    };
  }
  if (!plan || plan.service_type !== "HOTSPOT" || !plan.is_active) {
    return {
      ok: false,
      status: 403,
      code: "VOUCHER_PLAN_INACTIVE",
      message: "This voucher's package is no longer available. Contact support.",
    };
  }
  return {
    ok: true,
    firstActivation: true,
    validityDurationSeconds: plan.validity_duration_seconds,
  };
}

export interface ActivationOpts {
  mac?: string;
  phone?: string;
}

/** First-activation write. Column sizes: used_mac_address(20), used_by_phone(50). */
export function buildActivationUpdate(
  validityDurationSeconds: number,
  nowMs: number,
  opts: ActivationOpts = {}
): Record<string, string> {
  const update: Record<string, string> = {
    status: "USED",
    first_activated_at: new Date(nowMs).toISOString(),
    expires_at: new Date(nowMs + validityDurationSeconds * 1000).toISOString(),
  };
  const mac = (opts.mac ?? "").trim().slice(0, 20);
  const phone = (opts.phone ?? "").trim().slice(0, 50);
  if (mac) update.used_mac_address = mac;
  if (phone) update.used_by_phone = phone;
  return update;
}

/**
 * Bounce-back target must be a plain http(s) URL. Hotspot logins are plain
 * http (e.g. http://10.20.0.1/login or http://wifi.login.local/login).
 */
export function isSafeLinkLoginUrl(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const v = raw.trim();
  if (v.length === 0 || v.length > 500) return false;
  if (/[\s<>"'`\\]/.test(v)) return false;
  return /^https?:\/\//i.test(v);
}
