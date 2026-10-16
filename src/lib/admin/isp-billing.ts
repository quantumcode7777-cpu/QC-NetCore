// ====================================================================
// QC NetCore — SaaS owner bills ISPs (revenue-share invoices + SMS).
// Pure logic. Wrapped by /api/v1/admin/billing/*. Tested by
// tests/admin-isp-billing.test.mjs. No server imports — safe for clients.
// ====================================================================

export const ISP_SHARE_MIN_PCT = 0;
export const ISP_SHARE_MAX_PCT = 100;
/** Public pricing page: HOTSPOT 3% of revenue, PPPOE $0.25 / active user. */
export const DEFAULT_HOTSPOT_PCT = 3;
export const DEFAULT_PPPOE_RATE_USD = 0.25;
/** Manual KES-per-USD snapshot (editable per invoice). */
export const DEFAULT_FX_KES_PER_USD = 129;

export type IspInvoiceStatus =
  | "DRAFT"
  | "SENT"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "VOID";

export interface CreateIspInvoiceInput {
  organizationId?: unknown;
  period?: unknown; // "YYYY-MM"
  sharePct?: unknown; // hotspot % (defaults to the ISP's revenue_share_pct)
  pppoeRateUsd?: unknown;
  fxRate?: unknown; // KES per USD
  customAmount?: unknown;
  customLabel?: unknown;
  dueDate?: unknown; // "YYYY-MM-DD"
  notes?: unknown;
}

export interface ValidIspInvoice {
  organizationId: string;
  year: number;
  month: number;
  sharePct: number | null; // null = use the ISP's configured share
  pppoeRateUsd: number;
  fxRate: number;
  customAmount: number;
  customLabel: string;
  dueDate: string;
  notes: string;
}

export type IspInvoiceValidation =
  | { ok: true; value: ValidIspInvoice }
  | { ok: false; status: number; code: string; message: string };

const PERIOD_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_RE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function parsePeriod(raw: unknown): { year: number; month: number } | null {
  if (typeof raw !== "string") return null;
  const m = PERIOD_RE.exec(raw.trim());
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

/** UTC month window [start, end) for summing an ISP's collections. */
export function periodWindowUtc(year: number, month: number): { start: string; end: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return {
    start: `${year}-${pad(month)}-01T00:00:00.000Z`,
    end: `${next.year}-${pad(next.month)}-01T00:00:00.000Z`,
  };
}

export function validateCreateIspInvoice(input: CreateIspInvoiceInput): IspInvoiceValidation {
  const organizationId = typeof input.organizationId === "string" ? input.organizationId.trim() : "";
  if (!organizationId) {
    return { ok: false, status: 400, code: "ISP_REQUIRED", message: "Choose the ISP to invoice." };
  }
  const period = parsePeriod(input.period);
  if (!period) {
    return { ok: false, status: 400, code: "BAD_PERIOD", message: "Period must be YYYY-MM (e.g. 2026-10)." };
  }
  const shareRaw = input.sharePct;
  let sharePct: number | null = null;
  if (shareRaw !== undefined && shareRaw !== null && shareRaw !== "") {
    const pct = typeof shareRaw === "number" ? shareRaw : Number(shareRaw);
    if (!Number.isFinite(pct) || pct < ISP_SHARE_MIN_PCT || pct > ISP_SHARE_MAX_PCT) {
      return { ok: false, status: 400, code: "BAD_SHARE", message: "Hotspot share must be between 0 and 100 percent." };
    }
    sharePct = pct;
  }
  const rateRaw = input.pppoeRateUsd;
  const pppoeRateUsd =
    rateRaw === undefined || rateRaw === null || rateRaw === ""
      ? DEFAULT_PPPOE_RATE_USD
      : typeof rateRaw === "number"
        ? rateRaw
        : Number(rateRaw);
  if (!Number.isFinite(pppoeRateUsd) || pppoeRateUsd < 0 || pppoeRateUsd > 100) {
    return { ok: false, status: 400, code: "BAD_PPPOE_RATE", message: "PPPoE rate must be between 0 and 100 USD." };
  }
  const fxRaw = input.fxRate;
  const fxRate =
    fxRaw === undefined || fxRaw === null || fxRaw === "" ? DEFAULT_FX_KES_PER_USD : Number(fxRaw);
  if (!Number.isFinite(fxRate) || fxRate <= 0 || fxRate > 10000) {
    return { ok: false, status: 400, code: "BAD_FX", message: "Exchange rate must be a positive number." };
  }
  const customRaw = input.customAmount;
  const customAmount =
    customRaw === undefined || customRaw === null || customRaw === "" ? 0 : Number(customRaw);
  if (!Number.isFinite(customAmount) || customAmount < 0 || customAmount > 100_000_000) {
    return { ok: false, status: 400, code: "BAD_CUSTOM", message: "Custom amount must be zero or more." };
  }
  const customLabel =
    typeof input.customLabel === "string" ? input.customLabel.trim().slice(0, 100) : "";
  const dueDate = typeof input.dueDate === "string" ? input.dueDate.trim() : "";
  if (!DATE_RE.exec(dueDate)) {
    return { ok: false, status: 400, code: "BAD_DUE_DATE", message: "Due date must be YYYY-MM-DD." };
  }
  const notes = typeof input.notes === "string" ? input.notes.trim().slice(0, 500) : "";
  return {
    ok: true,
    value: { organizationId, year: period.year, month: period.month, sharePct, pppoeRateUsd, fxRate, customAmount, customLabel, dueDate, notes },
  };
}

/** Platform fee = base collections x share %, rounded to 2dp. */
export function computeShareAmount(baseAmount: number, sharePct: number): number {
  const safe = Number.isFinite(baseAmount) && baseAmount > 0 ? baseAmount : 0;
  return Math.round(safe * (sharePct / 100) * 100) / 100;
}

/** e.g. QC-202610-DAGINE-3F8K (unique per issue; DB UNIQUE is the backstop). */
export function buildInvoiceNumber(year: number, month: number, slug: string, randSuffix: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const tag = (slug || "isp").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "ISP";
  const suffix = randSuffix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4).padEnd(4, "X");
  return `QC-${year}${pad(month)}-${tag}-${suffix}`;
}

/** Normalize to +E.164 Kenyan MSISDN for Africa's Talking. */
export function normalizePhoneKE(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+254${digits.slice(1)}`;
  if (digits.length === 9 && /^[17]/.test(digits)) return `+254${digits}`;
  return null;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function periodLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1] ?? ""} ${year}`;
}

export interface InvoiceSmsInput {
  ispName: string;
  invoiceNumber: string;
  year: number;
  month: number;
  hotspotBase: number;
  hotspotPct: number;
  hotspotAmount: number;
  pppoeUsers: number;
  pppoeRateUsd: number;
  pppoeAmount: number;
  customAmount: number;
  customLabel: string;
  totalAmount: number;
  dueDate: string;
  currency: string;
}

export function money(n: number, currency: string): string {
  const cur = (currency || "KES").toUpperCase();
  const formatted = Number(n).toLocaleString("en-KE", { maximumFractionDigits: 2 });
  return cur === "KES" ? `KSh ${formatted}` : `${formatted} ${cur}`;
}

function trimNum(n: number): string {
  return String(Math.round(n * 10000) / 10000);
}

/** Compact money for SMS (no decimals when whole). */
function shortMoney(n: number, currency: string): string {
  const cur = (currency || "KES").toUpperCase();
  const v = Math.round(n * 100) / 100;
  const formatted = Number.isInteger(v)
    ? v.toLocaleString("en-KE")
    : v.toLocaleString("en-KE", { maximumFractionDigits: 2 });
  return cur === "KES" ? formatted : `${formatted} ${cur}`;
}

/**
 * Itemized fee SMS. Zero lines are omitted so the common cases fit one
 * 160-char segment (custom label omitted for space — amount only).
 */
export function buildInvoiceSms(i: InvoiceSmsInput): string {
  const parts: string[] = [];
  if (i.hotspotAmount > 0) {
    parts.push(
      `Hotspot ${i.hotspotPct}%x${shortMoney(i.hotspotBase, i.currency)}=${shortMoney(i.hotspotAmount, i.currency)}`
    );
  }
  if (i.pppoeAmount > 0) {
    parts.push(`PPPoE ${i.pppoeUsers}x$${trimNum(i.pppoeRateUsd)}=${shortMoney(i.pppoeAmount, i.currency)}`);
  }
  if (i.customAmount > 0) {
    parts.push(`Adj ${shortMoney(i.customAmount, i.currency)}`);
  }
  const lines = parts.length > 0 ? parts.join(" + ") : "No chargeable usage";
  return (
    `${i.ispName} ${periodLabel(i.year, i.month)}: ${lines}. ` +
    `Total ${shortMoney(i.totalAmount, i.currency)} Inv${i.invoiceNumber} due${i.dueDate}`
  );
}

/** Status after recording a payment of `paidTotal` against `total`. */
export function statusAfterPayment(total: number, paidTotal: number): IspInvoiceStatus {
  if (paidTotal <= 0) return "SENT";
  if (paidTotal + 0.005 >= total) return "PAID";
  return "PARTIALLY_PAID";
}

export interface AttributablePayment {
  customer_id: string | null;
  amount: number;
}

export interface AttributableSubscription {
  customer_id: string;
  plan_id: string;
  status: string;
  start_time: string;
  end_time: string;
}

/** ISO-8601 UTC strings compare chronologically — overlap without parsing. */
export function windowsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Hotspot revenue for the month: COMPLETED payments whose customer held an
 * overlapping HOTSPOT subscription (hotspot checked first when a customer
 * holds both), PLUS redeemed voucher face value (prepaid hotspot sales
 * rarely pass through `payments` yet).
 */
export function attributeHotspotPayments(
  payments: AttributablePayment[],
  subscriptions: AttributableSubscription[],
  hotspotPlanIds: Set<string>,
  winStart: string,
  winEnd: string
): number {
  const hotspotCustomers = new Set<string>();
  for (const s of subscriptions) {
    if (!hotspotPlanIds.has(s.plan_id)) continue;
    if (!windowsOverlap(s.start_time, s.end_time, winStart, winEnd)) continue;
    hotspotCustomers.add(s.customer_id);
  }
  let sum = 0;
  for (const p of payments) {
    if (!p.customer_id || !hotspotCustomers.has(p.customer_id)) continue;
    sum += Number(p.amount) || 0;
  }
  return Math.round(sum * 100) / 100;
}

export interface RedeemedVoucher {
  plan_id: string;
  first_activated_at: string;
}

/** Face value of vouchers redeemed in the window (plan price at issue time). */
export function voucherFaceValue(
  vouchers: RedeemedVoucher[],
  planPrices: Map<string, number>,
  winStart: string,
  winEnd: string
): number {
  let sum = 0;
  for (const v of vouchers) {
    if (v.first_activated_at < winStart || v.first_activated_at >= winEnd) continue;
    sum += planPrices.get(v.plan_id) ?? 0;
  }
  return Math.round(sum * 100) / 100;
}

/**
 * Billable PPPoE users: distinct customers with an ACTIVE/GRACE subscription
 * on a PPPoE plan overlapping the month.
 */
export function countPppoeUsers(
  subscriptions: AttributableSubscription[],
  pppoePlanIds: Set<string>,
  winStart: string,
  winEnd: string
): number {
  const users = new Set<string>();
  for (const s of subscriptions) {
    if (!pppoePlanIds.has(s.plan_id)) continue;
    if (s.status !== "ACTIVE" && s.status !== "GRACE") continue;
    if (!windowsOverlap(s.start_time, s.end_time, winStart, winEnd)) continue;
    users.add(s.customer_id);
  }
  return users.size;
}

export interface InvoiceTotalsInput {
  hotspotBase: number;
  hotspotPct: number;
  pppoeUsers: number;
  pppoeRateUsd: number;
  fxRate: number;
  customAmount: number;
}

export interface InvoiceTotals {
  hotspotAmount: number;
  pppoeAmount: number;
  customAmount: number;
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Line amounts + grand total, all rounded to cents. */
export function computeInvoiceTotals(t: InvoiceTotalsInput): InvoiceTotals {
  const hotspotAmount = computeShareAmount(t.hotspotBase, t.hotspotPct);
  const pppoeAmount = round2(t.pppoeUsers * t.pppoeRateUsd * t.fxRate);
  const customAmount = round2(Math.max(0, t.customAmount || 0));
  return { hotspotAmount, pppoeAmount, customAmount, total: round2(hotspotAmount + pppoeAmount + customAmount) };
}
