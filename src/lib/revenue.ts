// ====================================================================
// G-TECH ISP OPERATING SYSTEM
// Revenue Aggregation & Axis Utilities
// Shared between server API routes and client dashboard components.
// ====================================================================

export type RevenuePeriod = 7 | 30;

export interface DailyRevenueBucket {
  /** YYYY-MM-DD in local calendar time */
  dateKey: string;
  /** Short axis label, e.g. "3 Oct" */
  label: string;
  /** Tooltip full date, e.g. "03 Oct 2026" */
  fullDate: string;
  /** Sum of COMPLETED payment amounts for this day */
  total: number;
  /** Count of COMPLETED payments for this day */
  count: number;
}

export interface RevenueSeries {
  period: RevenuePeriod;
  buckets: DailyRevenueBucket[];
  totalRevenue: number;
  totalPayments: number;
  maxDailyRevenue: number;
}

export interface PaymentLike {
  status: string;
  amount: number;
  processedAt?: string | null;
  createdAt: string;
}

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Aggregate COMPLETED payments by local calendar day over the last `days` days
 * ending on `referenceDate` (defaults to today). Missing days are filled with 0.
 */
export function aggregateRevenueByDay(
  payments: PaymentLike[],
  days: RevenuePeriod,
  referenceDate: Date = new Date()
): RevenueSeries {
  const end = new Date(referenceDate);
  end.setHours(0, 0, 0, 0);

  const buckets: DailyRevenueBucket[] = [];
  const index = new Map<string, DailyRevenueBucket>();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const dateKey = toLocalDateKey(d);
    const bucket: DailyRevenueBucket = {
      dateKey,
      label: d.toLocaleDateString("en-KE", { day: "numeric", month: "short" }),
      fullDate: d.toLocaleDateString("en-KE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      total: 0,
      count: 0,
    };
    buckets.push(bucket);
    index.set(dateKey, bucket);
  }

  for (const p of payments) {
    if (p.status !== "COMPLETED") continue;
    const amount = Number(p.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const rawTs = p.processedAt || p.createdAt;
    if (!rawTs) continue;
    const when = new Date(rawTs);
    if (Number.isNaN(when.getTime())) continue;
    const key = toLocalDateKey(when);
    const bucket = index.get(key);
    if (bucket) {
      bucket.total += amount;
      bucket.count += 1;
    }
  }

  let totalRevenue = 0;
  let totalPayments = 0;
  let maxDailyRevenue = 0;
  for (const b of buckets) {
    totalRevenue += b.total;
    totalPayments += b.count;
    if (b.total > maxDailyRevenue) maxDailyRevenue = b.total;
  }

  return {
    period: days,
    buckets,
    totalRevenue,
    totalPayments,
    maxDailyRevenue,
  };
}

/**
 * Compute human-friendly Y-axis ticks from 0 up to a nice ceiling >= maxVal.
 */
export function computeNiceTicks(maxVal: number, intervals = 5): number[] {
  if (!Number.isFinite(maxVal) || maxVal <= 0) {
    return [0, 500, 1000, 1500, 2000, 2500];
  }
  const rawStep = maxVal / intervals;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  let niceFraction: number;
  if (residual <= 1) niceFraction = 1;
  else if (residual <= 2) niceFraction = 2;
  else if (residual <= 2.5) niceFraction = 2.5;
  else if (residual <= 5) niceFraction = 5;
  else niceFraction = 10;

  const step = Math.max(1, Math.round(niceFraction * magnitude));
  const count = Math.max(1, Math.ceil(maxVal / step));
  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) {
    ticks.push(i * step);
  }
  return ticks;
}
