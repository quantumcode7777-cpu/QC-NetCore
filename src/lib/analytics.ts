// ====================================================================
// QC NETCORE OPERATING SYSTEM
// Dashboard analytics — pure, tenant-agnostic aggregation helpers.
//
// Everything here is computed from rows already fetched for the signed-in
// organization. No Supabase/server imports so the same logic can run in a
// route handler, a React component, or `node --test`.
// ====================================================================

export type AnalyticsServiceType = "HOTSPOT" | "PPPOE";
export type RevenueService = AnalyticsServiceType | "UNATTRIBUTED";

export interface AnalyticsWindow {
  /** Inclusive ISO timestamp. */
  start: string;
  /** Exclusive ISO timestamp. */
  end: string;
}

export interface AnalyticsPaymentRow {
  id?: string;
  customerId?: string | null;
  customerName?: string | null;
  accountNumber?: string | null;
  amount: number;
  status?: string;
  createdAt: string;
  processedAt?: string | null;
}

export interface AnalyticsSubscriptionRow {
  customerId: string;
  planId: string;
  status?: string;
  startTime: string;
  endTime: string;
}

export interface AnalyticsPlanRow {
  id: string;
  name?: string;
  serviceType: string;
  price?: number;
}

export interface AnalyticsVoucherRow {
  planId: string;
  firstActivatedAt?: string | null;
}

export interface AnalyticsPppoeAccountRow {
  customerId: string;
  routerId?: string | null;
  username?: string;
  isOnline?: boolean;
  bytesIn?: number;
  bytesOut?: number;
}

export interface AnalyticsRouterRow {
  id: string;
  name: string;
  siteName?: string | null;
  status?: string;
}

export interface AnalyticsCustomerRow {
  id: string;
  fullName?: string | null;
  accountNumber?: string | null;
  phoneNumber?: string | null;
}

export interface DailyUsageBucket {
  dateKey: string;
  label: string;
  downloadBytes: number;
  uploadBytes: number;
  totalBytes: number;
}

export interface HourlyActivityBucket {
  hour: number;
  label: string;
  onlineHotspot: number;
  onlinePppoe: number;
  total: number;
}

/** Raw rows returned by `/api/v1/analytics/dashboard` and consumed by the UI. */
export interface AnalyticsRawData {
  payments: AnalyticsPaymentRow[];
  subscriptions: AnalyticsSubscriptionRow[];
  plans: AnalyticsPlanRow[];
  vouchers: AnalyticsVoucherRow[];
  pppoeAccounts: AnalyticsPppoeAccountRow[];
  routers: AnalyticsRouterRow[];
  customers: AnalyticsCustomerRow[];
  /** Empty until accounting snapshot history exists — UI must say so. */
  usageSnapshots: UsageSnapshotRow[];
  /** Empty until session snapshot history exists — Signal Clock must say so. */
  activitySnapshots: ActivitySnapshotRow[];
  /** Non-fatal query failures, surfaced as an honesty note in the UI. */
  warnings?: string[];
}

export function emptyAnalyticsData(): AnalyticsRawData {
  return {
    payments: [],
    subscriptions: [],
    plans: [],
    vouchers: [],
    pppoeAccounts: [],
    routers: [],
    customers: [],
    usageSnapshots: [],
    activitySnapshots: [],
  };
}

const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shortLabel(d: Date): string {
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

/** Local-calendar day window ending today, expressed as ISO timestamps. */
export function windowForDays(days: number, reference: Date = new Date()): AnalyticsWindow {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 7;
  const end = new Date(reference);
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (safeDays - 1));
  return { start: start.toISOString(), end: new Date(end.getTime() + 86_400_000).toISOString() };
}

export function inWindow(iso: string | null | undefined, window: AnalyticsWindow): boolean {
  if (!iso) return false;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return false;
  return ts >= new Date(window.start).getTime() && ts < new Date(window.end).getTime();
}

function paymentTimestamp(p: AnalyticsPaymentRow): string | null {
  return p.processedAt || p.createdAt || null;
}

function isCompleted(p: AnalyticsPaymentRow): boolean {
  return !p.status || p.status === "COMPLETED";
}

/**
 * Which service earned this payment? A customer's subscription overlapping
 * the payment timestamp decides the plan. If a customer holds both, HOTSPOT
 * wins — the same rule used by the owner's revenue-share invoices.
 */
export function classifyPaymentService(
  payment: AnalyticsPaymentRow,
  subscriptions: AnalyticsSubscriptionRow[],
  plansById: Map<string, AnalyticsPlanRow>
): RevenueService {
  if (!payment.customerId) return "UNATTRIBUTED";
  const ts = new Date(paymentTimestamp(payment) ?? "").getTime();
  if (Number.isNaN(ts)) return "UNATTRIBUTED";

  let hotspot = false;
  let pppoe = false;
  for (const sub of subscriptions) {
    if (sub.customerId !== payment.customerId) continue;
    if (sub.status === "CANCELLED") continue;
    const start = new Date(sub.startTime).getTime();
    const end = new Date(sub.endTime).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || ts < start || ts >= end) continue;
    const type = plansById.get(sub.planId)?.serviceType;
    if (type === "HOTSPOT") hotspot = true;
    if (type === "PPPOE") pppoe = true;
  }
  if (hotspot) return "HOTSPOT";
  if (pppoe) return "PPPOE";
  return "UNATTRIBUTED";
}

export interface RevenueSummary {
  window: AnalyticsWindow;
  hotspotPayments: number;
  voucherFaceValue: number;
  hotspot: number;
  pppoe: number;
  unattributed: number;
  total: number;
  paymentCount: number;
  hotspotPaymentCount: number;
  pppoePaymentCount: number;
  unattributedPaymentCount: number;
  transactionCount: number;
}

export interface SummarizeRevenueInput {
  payments: AnalyticsPaymentRow[];
  subscriptions?: AnalyticsSubscriptionRow[];
  plans?: AnalyticsPlanRow[];
  vouchers?: AnalyticsVoucherRow[];
  window: AnalyticsWindow;
}

/** Completed collections split by HOTSPOT / PPPOE / unknown service. */
export function summarizeRevenue(input: SummarizeRevenueInput): RevenueSummary {
  const plansById = new Map((input.plans ?? []).map((p) => [String(p.id), p]));
  const result: RevenueSummary = {
    window: input.window,
    hotspotPayments: 0,
    voucherFaceValue: 0,
    hotspot: 0,
    pppoe: 0,
    unattributed: 0,
    total: 0,
    paymentCount: 0,
    hotspotPaymentCount: 0,
    pppoePaymentCount: 0,
    unattributedPaymentCount: 0,
    transactionCount: 0,
  };

  for (const p of input.payments ?? []) {
    if (!isCompleted(p) || !inWindow(paymentTimestamp(p), input.window)) continue;
    const amount = Number(p.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const service = classifyPaymentService(p, input.subscriptions ?? [], plansById);
    if (service === "HOTSPOT") {
      result.hotspotPayments += amount;
      result.hotspotPaymentCount += 1;
    } else if (service === "PPPOE") {
      result.pppoe += amount;
      result.pppoePaymentCount += 1;
    } else {
      result.unattributed += amount;
      result.unattributedPaymentCount += 1;
    }
    result.paymentCount += 1;
  }

  for (const v of input.vouchers ?? []) {
    if (!inWindow(v.firstActivatedAt, input.window)) continue;
    const price = Number(plansById.get(String(v.planId))?.price ?? 0);
    if (Number.isFinite(price) && price > 0) result.voucherFaceValue += price;
  }

  result.hotspotPayments = round2(result.hotspotPayments);
  result.voucherFaceValue = round2(result.voucherFaceValue);
  result.hotspot = round2(result.hotspotPayments + result.voucherFaceValue);
  result.pppoe = round2(result.pppoe);
  result.unattributed = round2(result.unattributed);
  result.total = round2(result.hotspot + result.pppoe + result.unattributed);
  result.transactionCount = result.paymentCount + (input.vouchers ?? []).filter((v) =>
    inWindow(v.firstActivatedAt, input.window)
  ).length;
  return result;
}

export interface RouterRevenueRow {
  routerId: string;
  routerName: string;
  siteName: string;
  hotspot: number;
  pppoe: number;
  unattributed: number;
  total: number;
  sessions: number;
  downloadBytes: number;
  uploadBytes: number;
}

export interface RevenueByRouterInput extends SummarizeRevenueInput {
  routers?: AnalyticsRouterRow[];
  pppoeAccounts?: AnalyticsPppoeAccountRow[];
}

const UNATTRIBUTED_ROUTER = "unattributed";

/** Revenue + live usage grouped by router. Payments without a router mapping go to "Unattributed". */
export function revenueByRouter(input: RevenueByRouterInput): RouterRevenueRow[] {
  const plansById = new Map((input.plans ?? []).map((p) => [String(p.id), p]));
  const rows = new Map<string, RouterRevenueRow>();

  const ensure = (id: string, name: string, siteName = "") => {
    let row = rows.get(id);
    if (!row) {
      row = {
        routerId: id,
        routerName: name,
        siteName,
        hotspot: 0,
        pppoe: 0,
        unattributed: 0,
        total: 0,
        sessions: 0,
        downloadBytes: 0,
        uploadBytes: 0,
      };
      rows.set(id, row);
    }
    return row;
  };

  for (const r of input.routers ?? []) {
    ensure(String(r.id), String(r.name), r.siteName ? String(r.siteName) : "");
  }

  const routerByCustomer = new Map<string, string>();
  for (const a of input.pppoeAccounts ?? []) {
    if (!a.customerId) continue;
    if (a.routerId && !routerByCustomer.has(a.customerId)) {
      routerByCustomer.set(a.customerId, String(a.routerId));
    }
    if (a.routerId) {
      const row = ensure(String(a.routerId), `Router ${String(a.routerId)}`);
      row.downloadBytes += Number(a.bytesIn) || 0;
      row.uploadBytes += Number(a.bytesOut) || 0;
      if (a.isOnline) row.sessions += 1;
    }
  }

  for (const p of input.payments ?? []) {
    if (!isCompleted(p) || !inWindow(paymentTimestamp(p), input.window)) continue;
    const amount = Number(p.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const service = classifyPaymentService(p, input.subscriptions ?? [], plansById);
    const routerId = (p.customerId && routerByCustomer.get(p.customerId)) || UNATTRIBUTED_ROUTER;
    const row =
      routerId === UNATTRIBUTED_ROUTER
        ? ensure(UNATTRIBUTED_ROUTER, "Unattributed", "Customer has no router mapping")
        : ensure(routerId, `Router ${routerId}`);
    if (service === "HOTSPOT") row.hotspot += amount;
    else if (service === "PPPOE") row.pppoe += amount;
    else row.unattributed += amount;
    row.total += amount;
  }

  return Array.from(rows.values())
    .map((r) => ({
      ...r,
      hotspot: round2(r.hotspot),
      pppoe: round2(r.pppoe),
      unattributed: round2(r.unattributed),
      total: round2(r.total),
    }))
    .sort((a, b) => b.total - a.total || a.routerName.localeCompare(b.routerName));
}

/** Average revenue per active subscriber. Zero subscribers yields zero, not NaN. */
export function computeArpu(revenue: number, activeSubscribers: number): number {
  const active = Number.isFinite(activeSubscribers) && activeSubscribers > 0 ? activeSubscribers : 0;
  return active > 0 ? round2(Number(revenue || 0) / active) : 0;
}

export interface TopCustomerRow {
  customerId: string;
  name: string;
  detail: string;
  amount: number;
  payments: number;
}

export function topCustomersByPayments(
  payments: AnalyticsPaymentRow[],
  customers: AnalyticsCustomerRow[],
  window: AnalyticsWindow,
  limit = 5
): TopCustomerRow[] {
  const names = new Map(customers.map((c) => [String(c.id), c]));
  const grouped = new Map<string, TopCustomerRow>();

  for (const p of payments ?? []) {
    if (!isCompleted(p) || !inWindow(paymentTimestamp(p), window)) continue;
    const amount = Number(p.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const id = String(p.customerId || "unknown");
    let row = grouped.get(id);
    if (!row) {
      const customer = names.get(id);
      const detail =
        customer?.accountNumber ||
        customer?.phoneNumber ||
        p.accountNumber ||
        p.customerName ||
        "Unknown customer";
      row = {
        customerId: id,
        name: customer?.fullName || p.customerName || detail || "Unknown customer",
        detail,
        amount: 0,
        payments: 0,
      };
      grouped.set(id, row);
    }
    row.amount += amount;
    row.payments += 1;
  }

  return Array.from(grouped.values())
    .map((r) => ({ ...r, amount: round2(r.amount) }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
    .slice(0, Math.max(1, Math.floor(limit)));
}

export interface UsageSnapshotRow {
  at: string;
  downloadBytes: number;
  uploadBytes: number;
}

export interface UsageAggregate {
  window: AnalyticsWindow;
  buckets: DailyUsageBucket[];
  totalBytes: number;
  downloadBytes: number;
  uploadBytes: number;
  dailyAverageBytes: number;
  busiestDay: DailyUsageBucket | null;
}

/**
 * Turn cumulative accounting snapshots into per-day deltas. Returns an empty
 * series when there are fewer than two snapshots, so the UI can say honestly
 * that daily history is not available yet.
 */
export function aggregateUsageByDay(
  snapshots: UsageSnapshotRow[],
  days: number,
  reference: Date = new Date()
): UsageAggregate {
  const window = windowForDays(days, reference);
  const buckets: DailyUsageBucket[] = [];
  const byKey = new Map<string, DailyUsageBucket>();
  const end = new Date(window.end);
  end.setDate(end.getDate() - 1);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const bucket: DailyUsageBucket = {
      dateKey: localDateKey(d),
      label: shortLabel(d),
      downloadBytes: 0,
      uploadBytes: 0,
      totalBytes: 0,
    };
    buckets.push(bucket);
    byKey.set(bucket.dateKey, bucket);
  }

  const sorted = [...(snapshots ?? [])]
    .filter((s) => s && Number.isFinite(new Date(s.at).getTime()))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (!inWindow(curr.at, window)) continue;
    const downDelta = Math.max(0, Number(curr.downloadBytes) - Number(prev.downloadBytes) || 0);
    const upDelta = Math.max(0, Number(curr.uploadBytes) - Number(prev.uploadBytes) || 0);
    const bucket = byKey.get(localDateKey(new Date(curr.at)));
    if (!bucket) continue;
    bucket.downloadBytes += downDelta;
    bucket.uploadBytes += upDelta;
    bucket.totalBytes += downDelta + upDelta;
  }

  let totalBytes = 0;
  let downloadBytes = 0;
  let uploadBytes = 0;
  let busiestDay: DailyUsageBucket | null = null;
  for (const b of buckets) {
    totalBytes += b.totalBytes;
    downloadBytes += b.downloadBytes;
    uploadBytes += b.uploadBytes;
    if (!busiestDay || b.totalBytes > busiestDay.totalBytes) busiestDay = b;
  }

  return {
    window,
    buckets,
    totalBytes,
    downloadBytes,
    uploadBytes,
    dailyAverageBytes: Math.round(totalBytes / buckets.length),
    busiestDay: busiestDay && busiestDay.totalBytes > 0 ? busiestDay : null,
  };
}

export interface ActivitySnapshotRow {
  at: string;
  onlineHotspot: number;
  onlinePppoe: number;
}

export interface HourlyActivity {
  buckets: HourlyActivityBucket[];
  busiestHour: HourlyActivityBucket | null;
}

/** Average online users by hour of day from historical session snapshots. */
export function aggregateHourlyActivity(snapshots: ActivitySnapshotRow[]): HourlyActivity {
  const sums = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${hour.toString().padStart(2, "0")}:00`,
    onlineHotspot: 0,
    onlinePppoe: 0,
    total: 0,
    samples: 0,
  }));

  for (const s of snapshots ?? []) {
    const d = new Date(s?.at ?? "");
    if (Number.isNaN(d.getTime())) continue;
    const bucket = sums[d.getHours()];
    bucket.onlineHotspot += Number(s.onlineHotspot) || 0;
    bucket.onlinePppoe += Number(s.onlinePppoe) || 0;
    bucket.samples += 1;
  }

  const buckets = sums.map((s) => {
    const divisor = Math.max(1, s.samples);
    return {
      hour: s.hour,
      label: s.label,
      onlineHotspot: Math.round(s.onlineHotspot / divisor),
      onlinePppoe: Math.round(s.onlinePppoe / divisor),
      total: Math.round((s.onlineHotspot + s.onlinePppoe) / divisor),
    };
  });

  const busiest = buckets.reduce<HourlyActivityBucket | null>(
    (best, b) => (!best || b.total > best.total ? b : best),
    null
  );
  return { buckets, busiestHour: busiest && busiest.total > 0 ? busiest : null };
}

export function formatBytes(bytes: number): string {
  const value = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (value === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let scaled = value;
  let unit = 0;
  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024;
    unit += 1;
  }
  const digits = scaled >= 100 || unit === 0 ? 0 : 1;
  return `${scaled.toFixed(digits)} ${units[unit]}`;
}
