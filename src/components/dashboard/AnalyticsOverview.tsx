"use client";

import React, { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  CreditCard,
  Router as RouterIcon,
  Users,
} from "lucide-react";
import type { NOCStats } from "@/types";
import {
  aggregateHourlyActivity,
  aggregateUsageByDay,
  classifyPaymentService,
  computeArpu,
  emptyAnalyticsData,
  formatBytes,
  revenueByRouter,
  summarizeRevenue,
  topCustomersByPayments,
  windowForDays,
  type AnalyticsRawData,
  type RevenueService,
} from "@/lib/analytics";
import type { RevenuePeriod } from "@/lib/revenue";
import { cn, formatKES } from "@/lib/utils";
import { EmptyState } from "@/components/ui/States";

const USAGE_RANGES = [7, 14, 30, 90] as const;
const TOP_FILTERS: Array<{ value: "ALL" | RevenueService; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "HOTSPOT", label: "HotSpot" },
  { value: "PPPOE", label: "PPPoE" },
  { value: "UNATTRIBUTED", label: "Unknown" },
];

function AnalyticsPanel({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-surface shadow-xs", className)}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            {title}
          </h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function RangeButtons({
  values,
  value,
  onChange,
  label,
}: {
  values: readonly number[];
  value: number;
  onChange: (n: number) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-md border border-border p-0.5">
      {values.map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={value === n}
          onClick={() => onChange(n)}
          className={cn(
            "h-7 rounded px-2.5 text-xs font-medium transition-colors",
            value === n
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {n}d
        </button>
      ))}
    </div>
  );
}

function ShareBar({ hotspot, pppoe, unattributed }: { hotspot: number; pppoe: number; unattributed: number }) {
  const total = hotspot + pppoe + unattributed;
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  return (
    <div
      className="flex h-2 w-full overflow-hidden rounded-full bg-surface-subtle"
      role="img"
      aria-label={`HotSpot ${Math.round(pct(hotspot))}%, PPPoE ${Math.round(pct(pppoe))}%, unattributed ${Math.round(pct(unattributed))}%`}
    >
      <div className="h-full bg-success transition-all duration-500" style={{ width: `${pct(hotspot)}%` }} />
      <div className="h-full bg-primary transition-all duration-500" style={{ width: `${pct(pppoe)}%` }} />
      <div className="h-full bg-muted-foreground/40 transition-all duration-500" style={{ width: `${pct(unattributed)}%` }} />
    </div>
  );
}

function MiniBars({
  values,
  ariaLabel,
  className,
}: {
  values: Array<{ label: string; value: number; tooltip: string; color: string }>;
  ariaLabel: string;
  className?: string;
}) {
  const max = Math.max(1, ...values.map((v) => v.value));
  return (
    <div
      className={cn("flex h-28 items-end gap-1", className)}
      role="img"
      aria-label={ariaLabel}
    >
      {values.map((v, i) => (
        <div
          key={`${v.label}-${i}`}
          title={v.tooltip}
          className="flex h-full min-w-0 flex-1 flex-col justify-end"
        >
          <div
            className={cn("w-full rounded-t-sm transition-all duration-500", v.color)}
            style={{ height: `${Math.max(v.value > 0 ? 3 : 0, (v.value / max) * 100)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

export interface AnalyticsOverviewProps {
  period: RevenuePeriod;
  stats: NOCStats | null;
  data: AnalyticsRawData | null;
  error?: string | null;
}

/**
 * REA-inspired analytics surface. Every panel is honest about unavailable
 * telemetry: revenue attribution comes from real joins, while daily usage and
 * Signal Clock render an explicit empty state until snapshot history exists.
 */
export function AnalyticsOverview({ period, stats, data, error }: AnalyticsOverviewProps) {
  const [usageDays, setUsageDays] = useState<number>(7);
  const [topFilter, setTopFilter] = useState<"ALL" | RevenueService>("ALL");

  const raw = data ?? emptyAnalyticsData();
  const window = useMemo(() => windowForDays(period), [period]);
  const plansById = useMemo(
    () => new Map(raw.plans.map((p) => [String(p.id), p])),
    [raw.plans]
  );

  const summary = useMemo(
    () =>
      summarizeRevenue({
        payments: raw.payments,
        subscriptions: raw.subscriptions,
        plans: raw.plans,
        vouchers: raw.vouchers,
        window,
      }),
    [raw.payments, raw.subscriptions, raw.plans, raw.vouchers, window]
  );

  const routers = useMemo(
    () =>
      revenueByRouter({
        payments: raw.payments,
        subscriptions: raw.subscriptions,
        plans: raw.plans,
        vouchers: raw.vouchers,
        pppoeAccounts: raw.pppoeAccounts,
        routers: raw.routers,
        window,
      }),
    [
      raw.payments,
      raw.subscriptions,
      raw.plans,
      raw.vouchers,
      raw.pppoeAccounts,
      raw.routers,
      window,
    ]
  );

  const usage = useMemo(
    () => aggregateUsageByDay(raw.usageSnapshots, usageDays),
    [raw.usageSnapshots, usageDays]
  );
  const signal = useMemo(
    () => aggregateHourlyActivity(raw.activitySnapshots),
    [raw.activitySnapshots]
  );

  const topPayments = useMemo(
    () =>
      topFilter === "ALL"
        ? raw.payments
        : raw.payments.filter(
            (p) => classifyPaymentService(p, raw.subscriptions, plansById) === topFilter
          ),
    [raw.payments, raw.subscriptions, plansById, topFilter]
  );
  const topUsers = useMemo(
    () => topCustomersByPayments(topPayments, raw.customers, window, 5),
    [topPayments, raw.customers, window]
  );

  const arpu = computeArpu(summary.total, stats?.activeSubscribers ?? 0);
  const hotspotPct = summary.total > 0 ? Math.round((summary.hotspot / summary.total) * 100) : 0;
  const pppoePct = summary.total > 0 ? Math.round((summary.pppoe / summary.total) * 100) : 0;
  const activeAccounts = raw.pppoeAccounts.filter((a) => a.isOnline).length;
  const liveBytes = raw.pppoeAccounts.reduce(
    (acc, a) => acc + (Number(a.bytesIn) || 0) + (Number(a.bytesOut) || 0),
    0
  );
  const liveRouterCount = raw.routers.length;
  const warnings = raw.warnings ?? [];

  return (
    <section id="analytics" className="space-y-4 scroll-mt-20" aria-label="Revenue and usage analytics">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">Revenue &amp; usage analytics</h2>
          <p className="text-xs text-muted-foreground">
            Service and router attribution derived from real subscriptions, plans, and PPPoE accounts.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">Last {period} days</span>
      </div>

      {error && (
        <p role="status" className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {error}
        </p>
      )}
      {warnings.length > 0 && (
        <p role="status" className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          Some analytics rows were unavailable: {warnings.join("; ")}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <AnalyticsPanel
          title="Revenue mix"
          description={`HotSpot + PPPoE collections, last ${period} days`}
          icon={CreditCard}
          className="lg:col-span-2"
        >
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <div className="text-[11px] font-medium text-muted-foreground">Total revenue</div>
                <div className="tabular mt-0.5 text-lg font-semibold text-foreground">
                  {formatKES(summary.total)}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-muted-foreground">HotSpot revenue</div>
                <div className="tabular mt-0.5 text-lg font-semibold text-success">
                  {formatKES(summary.hotspot)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {hotspotPct}% of total · {summary.hotspotPaymentCount} payments + voucher value
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-muted-foreground">PPPoE revenue</div>
                <div className="tabular mt-0.5 text-lg font-semibold text-primary">
                  {formatKES(summary.pppoe)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {pppoePct}% of total · {summary.pppoePaymentCount} payments
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-muted-foreground">ARPU</div>
                <div className="tabular mt-0.5 text-lg font-semibold text-foreground">
                  {formatKES(arpu)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {stats?.activeSubscribers ?? 0} active subscribers
                </div>
              </div>
            </div>

            <ShareBar
              hotspot={summary.hotspot}
              pppoe={summary.pppoe}
              unattributed={summary.unattributed}
            />

            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
                HotSpot
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                PPPoE
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" aria-hidden="true" />
                Unattributed {formatKES(summary.unattributed)}
              </span>
            </div>

            {summary.unattributed > 0 && (
              <p className="text-xs text-muted-foreground">
                {summary.unattributedPaymentCount} payment(s) had no overlapping plan subscription, so they were not
                assigned to HotSpot or PPPoE. Voucher face value in this window: {formatKES(summary.voucherFaceValue)}.
              </p>
            )}
          </div>
        </AnalyticsPanel>

        <AnalyticsPanel
          title="Network snapshot"
          description="Counts used for ARPU and router attribution"
          icon={Activity}
        >
          <div className="grid grid-cols-2 gap-2.5 p-4 text-xs">
            <div className="rounded-md border border-border bg-surface-subtle/50 p-2.5">
              <div className="text-[11px] text-muted-foreground">Successful transactions</div>
              <div className="tabular mt-0.5 text-base font-semibold">{summary.paymentCount}</div>
              <div className="text-[11px] text-muted-foreground">
                {summary.hotspotPaymentCount} HS · {summary.pppoePaymentCount} PPPoE
              </div>
            </div>
            <div className="rounded-md border border-border bg-surface-subtle/50 p-2.5">
              <div className="text-[11px] text-muted-foreground">Routers known</div>
              <div className="tabular mt-0.5 text-base font-semibold">{liveRouterCount}</div>
              <div className="text-[11px] text-muted-foreground">From the fleet inventory</div>
            </div>
            <div className="rounded-md border border-border bg-surface-subtle/50 p-2.5">
              <div className="text-[11px] text-muted-foreground">PPPoE accounts</div>
              <div className="tabular mt-0.5 text-base font-semibold">{raw.pppoeAccounts.length}</div>
              <div className="text-[11px] text-muted-foreground">
                {activeAccounts} marked online in demo data
              </div>
            </div>
            <div className="rounded-md border border-border bg-surface-subtle/50 p-2.5">
              <div className="text-[11px] text-muted-foreground">Recorded usage</div>
              <div className="tabular mt-0.5 text-base font-semibold">{formatBytes(liveBytes)}</div>
              <div className="text-[11px] text-muted-foreground">Cumulative PPPoE counters</div>
            </div>
          </div>
        </AnalyticsPanel>
      </div>

      <AnalyticsPanel
        title="Revenue per router"
        description="HotSpot + PPPoE, attributed through the customer's PPPoE router mapping"
        icon={RouterIcon}
        action={
          <span className="text-[11px] text-muted-foreground">
            Every router keeps its own revenue row
          </span>
        }
      >
        {routers.length === 0 ? (
          <EmptyState
            icon={RouterIcon}
            title="No routers or payments in this period"
            description="Add a router and record completed payments to see per-router revenue."
            className="py-8"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th scope="col" className="px-4 py-2 font-medium">Router</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">HotSpot</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">PPPoE</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Unattributed</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Total</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Sessions</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Usage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {routers.map((r) => (
                  <tr key={r.routerId} className="hover:bg-surface-subtle">
                    <td className="px-4 py-2">
                      <div className="font-medium">{r.routerName}</div>
                      {r.siteName && (
                        <div className="text-xs text-muted-foreground">{r.siteName}</div>
                      )}
                    </td>
                    <td className="tabular px-2 py-2 text-right text-success">{formatKES(r.hotspot)}</td>
                    <td className="tabular px-2 py-2 text-right text-primary">{formatKES(r.pppoe)}</td>
                    <td className="tabular px-2 py-2 text-right text-muted-foreground">
                      {formatKES(r.unattributed)}
                    </td>
                    <td className="tabular px-2 py-2 text-right font-semibold">{formatKES(r.total)}</td>
                    <td className="tabular px-2 py-2 text-right">{r.sessions || "—"}</td>
                    <td className="tabular px-4 py-2 text-right text-muted-foreground">
                      {r.downloadBytes + r.uploadBytes > 0
                        ? formatBytes(r.downloadBytes + r.uploadBytes)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AnalyticsPanel>

      <div className="grid gap-4 lg:grid-cols-3">
        <AnalyticsPanel
          title="Data consumption per day"
          description="Everything routers carried, HotSpot and PPPoE together"
          icon={ArrowDownToLine}
          action={
            <RangeButtons
              values={USAGE_RANGES}
              value={usageDays}
              onChange={setUsageDays}
              label="Data consumption range"
            />
          }
        >
          {usage.totalBytes === 0 ? (
            <EmptyState
              icon={ArrowDownToLine}
              title="No daily usage history yet"
              description="Per-day totals need accounting snapshots. Cumulative PPPoE counters are shown in the network snapshot; no daily values are invented."
              className="py-8"
            />
          ) : (
            <div className="space-y-3 p-4">
              <MiniBars
                values={usage.buckets.map((b) => ({
                  label: b.label,
                  value: b.totalBytes,
                  tooltip: `${b.label}: ↓ ${formatBytes(b.downloadBytes)} · ↑ ${formatBytes(b.uploadBytes)}`,
                  color: "bg-primary",
                }))}
                ariaLabel={`Data consumption over the last ${usageDays} days`}
              />
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
                <span>Total <strong className="tabular text-foreground">{formatBytes(usage.totalBytes)}</strong></span>
                <span>
                  Daily average <strong className="tabular text-foreground">{formatBytes(usage.dailyAverageBytes)}</strong>
                </span>
                <span>
                  Busiest day{" "}
                  <strong className="tabular text-foreground">
                    {usage.busiestDay ? `${usage.busiestDay.label} · ${formatBytes(usage.busiestDay.totalBytes)}` : "—"}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <ArrowDownToLine className="h-3 w-3 text-success" aria-hidden="true" />
                  Download {formatBytes(usage.downloadBytes)}
                </span>
                <span className="flex items-center gap-1.5">
                  <ArrowUpFromLine className="h-3 w-3 text-primary" aria-hidden="true" />
                  Upload {formatBytes(usage.uploadBytes)}
                </span>
              </div>
            </div>
          )}
        </AnalyticsPanel>

        <AnalyticsPanel
          title="Top users"
          description={`Largest collections in the last ${period} days`}
          icon={Users}
          action={
            <div role="group" aria-label="Top users service" className="inline-flex rounded-md border border-border p-0.5">
              {TOP_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={topFilter === f.value}
                  onClick={() => setTopFilter(f.value)}
                  className={cn(
                    "h-7 rounded px-2 text-[11px] font-medium transition-colors",
                    topFilter === f.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          }
        >
          {topUsers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No customers to rank"
              description="Completed payments linked to a customer will appear here. Data-usage rankings require per-user accounting history."
              className="py-8"
            />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {topUsers.map((u) => (
                <li key={u.customerId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{u.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {u.detail} · {u.payments} payment{u.payments === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="tabular shrink-0 text-sm font-semibold">{formatKES(u.amount)}</div>
                </li>
              ))}
            </ul>
          )}
        </AnalyticsPanel>

        <AnalyticsPanel
          title="Signal Clock"
          description="When customers connect, by hour of day"
          icon={Clock}
        >
          {signal.busiestHour === null ? (
            <EmptyState
              icon={Clock}
              title="No hourly session history"
              description="Signal Clock needs periodic session snapshots. Live sessions are not yet sampled by hour, so no pattern is shown."
              className="py-8"
            />
          ) : (
            <div className="space-y-3 p-4">
              <MiniBars
                values={signal.buckets.map((b) => ({
                  label: b.label,
                  value: b.total,
                  tooltip: `${b.label}: ${b.onlineHotspot} HotSpot · ${b.onlinePppoe} PPPoE`,
                  color: "bg-success",
                }))}
                ariaLabel="Average online users by hour of day"
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  Busiest hour{" "}
                  <strong className="tabular text-foreground">
                    {signal.busiestHour.label} · {signal.busiestHour.total} users
                  </strong>
                </span>
                <span>Quiet → Busy</span>
              </div>
            </div>
          )}
        </AnalyticsPanel>
      </div>
    </section>
  );
}
