// ====================================================================
// QC NetCore — SaaS owner bills ISPs (revenue-share invoices + SMS).
// Pure logic. Wrapped by /api/v1/admin/billing/*. Tested by
// tests/admin-isp-billing.test.mjs. No server imports — safe for clients.
// ====================================================================

export const ISP_SHARE_MIN_PCT = 0;
export const ISP_SHARE_MAX_PCT = 100;

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
  sharePct?: unknown;
  dueDate?: unknown; // "YYYY-MM-DD"
  notes?: unknown;
}

export interface ValidIspInvoice {
  organizationId: string;
  year: number;
  month: number;
  sharePct: number;
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
  const sharePct = typeof input.sharePct === "number" ? input.sharePct : Number(input.sharePct);
  if (!Number.isFinite(sharePct) || sharePct < ISP_SHARE_MIN_PCT || sharePct > ISP_SHARE_MAX_PCT) {
    return { ok: false, status: 400, code: "BAD_SHARE", message: "Revenue share must be between 0 and 100 percent." };
  }
  const dueDate = typeof input.dueDate === "string" ? input.dueDate.trim() : "";
  if (!DATE_RE.exec(dueDate)) {
    return { ok: false, status: 400, code: "BAD_DUE_DATE", message: "Due date must be YYYY-MM-DD." };
  }
  const notes = typeof input.notes === "string" ? input.notes.trim().slice(0, 500) : "";
  return { ok: true, value: { organizationId, year: period.year, month: period.month, sharePct, dueDate, notes } };
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
  baseAmount: number;
  sharePct: number;
  totalAmount: number;
  dueDate: string;
  currency: string;
}

export function money(n: number, currency: string): string {
  const cur = (currency || "KES").toUpperCase();
  const formatted = Number(n).toLocaleString("en-KE", { maximumFractionDigits: 2 });
  return cur === "KES" ? `KSh ${formatted}` : `${formatted} ${cur}`;
}

/** <=160 chars keeps it to a single SMS segment. */
export function buildInvoiceSms(i: InvoiceSmsInput): string {
  return (
    `${i.ispName}: QC NetCore platform fee ${periodLabel(i.year, i.month)}: ` +
    `${money(i.baseAmount, i.currency)} collected x ${i.sharePct}% = ${money(i.totalAmount, i.currency)}. ` +
    `Inv ${i.invoiceNumber}, due ${i.dueDate}.`
  );
}

/** Status after recording a payment of `paidTotal` against `total`. */
export function statusAfterPayment(total: number, paidTotal: number): IspInvoiceStatus {
  if (paidTotal <= 0) return "SENT";
  if (paidTotal + 0.005 >= total) return "PAID";
  return "PARTIALLY_PAID";
}
