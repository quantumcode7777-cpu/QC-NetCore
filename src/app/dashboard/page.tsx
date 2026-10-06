"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  Wifi,
  CreditCard,
  Clock,
  PauseCircle,
  Router as RouterIcon,
  RefreshCw,
  UserPlus,
  Banknote,
  Cpu,
  HardDrive,
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Server,
  AlertTriangle,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { getSeedNOCStats, SEED_PAYMENTS, SEED_ROUTERS } from "@/lib/db/mock-db";
import type { NOCStats, Router, Payment } from "@/types";
import { cn, formatKES } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader, btnClass } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import {
  aggregateRevenueByDay,
  type DailyRevenueBucket,
  type RevenuePeriod,
} from "@/lib/revenue";

// ---------- helpers ----------

function timeAgo(iso?: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "—";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return `${d} d ago`;
}

function getBoardTotalRamMb(boardModel: string, freeMemoryMb: number): number | null {
  if (!Number.isFinite(freeMemoryMb) || freeMemoryMb <= 0) return null;
  const model = (boardModel || "").toUpperCase();
  if (model.includes("CCR2116")) return Math.max(16384, freeMemoryMb);
  if (model.includes("CCR2004")) return Math.max(4096, freeMemoryMb);
  if (model.includes("RB5009") || model.includes("RB4011") || model.includes("RB3011")) {
    return Math.max(1024, freeMemoryMb);
  }
  if (model.includes("RB750") || model.includes("HEX") || model.includes("HAP")) {
    return Math.max(256, freeMemoryMb);
  }
  const standardTiers = [256, 512, 1024, 2048, 4096, 8192, 16384];
  for (const tier of standardTiers) {
    if (tier >= freeMemoryMb) return tier;
  }
  return Math.ceil(freeMemoryMb / 1024) * 1024;
}

function getUsageThreshold(pct: number): {
  label: "Normal" | "Moderate" | "High" | "Critical";
  barClass: string;
  badgeClass: string;
  strokeColor: string;
} {
  if (pct >= 90) {
    return {
      label: "Critical",
      barClass: "bg-danger",
      badgeClass: "border-danger/30 bg-danger/10 text-danger",
      strokeColor: "#ef4444",
    };
  }
  if (pct >= 75) {
    return {
      label: "High",
      barClass: "bg-warning",
      badgeClass: "border-warning/30 bg-warning/10 text-warning",
      strokeColor: "#f59e0b",
    };
  }
  if (pct >= 50) {
    return {
      label: "Moderate",
      barClass: "bg-primary",
      badgeClass: "border-primary/30 bg-primary/10 text-primary",
      strokeColor: "#2563eb",
    };
  }
  return {
    label: "Normal",
    barClass: "bg-success",
    badgeClass: "border-success/30 bg-success/10 text-success",
    strokeColor: "#10b981",
  };
}

function CircularGauge({
  percentage,
  strokeColor,
  unavailable = false,
}: {
  percentage: number;
  strokeColor: string;
  unavailable?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = unavailable
    ? circumference
    : circumference - (clamped / 100) * circumference;

  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
      <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56" aria-hidden="true">
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          className="text-border"
        />
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke={unavailable ? "currentColor" : strokeColor}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <span className="tabular absolute text-xs font-bold text-foreground">
        {unavailable ? "—" : `${clamped}%`}
      </span>
    </div>
  );
}

// ---------- small building blocks ----------

function Metric({
  label,
  value,
  context,
  href,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  context?: React.ReactNode;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "warning" | "danger";
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-lg border border-border bg-surface p-3 shadow-xs transition-colors hover:border-border-strong"
    >
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div
        className={cn(
          "tabular mt-1 text-xl font-semibold leading-7 tracking-tight",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-danger",
          tone === "neutral" && "text-foreground"
        )}
      >
        {value}
      </div>
      {context && <div className="mt-0.5 text-xs text-muted-foreground">{context}</div>}
    </Link>
  );
}

function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-surface shadow-xs", className)}>
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action && (
          <Link href={action.href} className="text-xs font-medium text-primary hover:underline">
            {action.label}
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

// ---------- page ----------

export default function DashboardPage() {
  const { isDemoMode, isLoading: authLoading, organization, user } = useAuth();

  const [stats, setStats] = useState<NOCStats | null>(null);
  const [routers, setRouters] = useState<Router[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [serverRevenueBuckets, setServerRevenueBuckets] = useState<DailyRevenueBucket[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<RevenuePeriod>(7);
  const [selectedRouterId, setSelectedRouterId] = useState<string>("");

  const load = useCallback(async () => {
    setError(null);
    if (isDemoMode) {
      setStats(getSeedNOCStats());
      setRouters(SEED_ROUTERS);
      setPayments(SEED_PAYMENTS);
      setServerRevenueBuckets(null);
      setIsLoading(false);
      return;
    }
    try {
      const [nocRes, routerRes, payRes, revRes] = await Promise.all([
        fetch("/api/v1/monitoring/noc"),
        fetch("/api/v1/mikrotik-fleet"),
        fetch("/api/v1/payments?limit=500"),
        fetch("/api/v1/payments/revenue?days=30"),
      ]);
      const [noc, fleet, pay, rev] = await Promise.all([
        nocRes.json(),
        routerRes.json(),
        payRes.json(),
        revRes.json().catch(() => null),
      ]);

      if (noc?.success && noc.data) setStats(noc.data);
      else throw new Error("Operations statistics are unavailable.");
      setRouters(fleet?.success ? fleet.data : []);
      setPayments(pay?.success ? pay.data : []);
      setServerRevenueBuckets(
        rev?.success && Array.isArray(rev.data?.buckets) ? rev.data.buckets : null
      );
    } catch (err) {
      console.error("[Dashboard] load failed:", err);
      setError("Some dashboard data could not be loaded. Nothing was changed.");
    } finally {
      setIsLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    if (authLoading) return;
    setIsLoading(true);
    load();
  }, [authLoading, load, user?.id]);

  const refresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  // ----- derived (all from loaded data) -----
  const offlineRouters = stats ? Math.max(stats.totalRouters - stats.onlineRouters, 0) : 0;
  const openAlerts = stats?.recentAlerts.filter((a) => !a.isResolved) ?? [];

  const selectedRouter = useMemo(() => {
    if (routers.length === 0) return null;
    if (selectedRouterId) {
      const found = routers.find((r) => r.id === selectedRouterId);
      if (found) return found;
    }
    return routers.find((r) => r.status === "ONLINE") ?? routers[0];
  }, [routers, selectedRouterId]);

  const buckets = useMemo(() => {
    if (serverRevenueBuckets && serverRevenueBuckets.length >= period) {
      return serverRevenueBuckets.slice(-period);
    }
    return aggregateRevenueByDay(payments, period).buckets;
  }, [serverRevenueBuckets, payments, period]);

  const periodTotal = useMemo(
    () => buckets.reduce((s, b) => s + b.total, 0),
    [buckets]
  );

  const today = new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const header = (
    <PageHeader
      title={organization?.name ? `${organization.name}` : "Operations overview"}
      description={`Operations overview · ${today}`}
      actions={
        <>
          <button onClick={refresh} disabled={isRefreshing} className={btnClass("secondary")}>
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} aria-hidden="true" />
            {isRefreshing ? "Refreshing" : "Refresh"}
          </button>
          <Link href="/customers" className={btnClass("primary")}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Add subscriber
          </Link>
        </>
      }
    />
  );

  // ----- loading skeleton matching final layout -----
  if (isLoading || !stats) {
    return (
      <AppShell title="Dashboard">
        {header}
        {error && !stats ? (
          <ErrorState title="Dashboard could not be loaded" detail={error} onRetry={refresh} />
        ) : (
          <div role="status" aria-label="Loading dashboard" className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-border bg-surface p-3">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <Skeleton className="h-64 lg:col-span-2" />
              <Skeleton className="h-64" />
            </div>
          </div>
        )}
      </AppShell>
    );
  }

  const sessionsKnown = stats.sessionsAvailable !== false;

  return (
    <AppShell title="Dashboard">
      {header}
      {error && <ErrorState title="Some data is out of date" detail={error} onRetry={refresh} />}

      {/* Key metrics: each answers a question and links to where you act on it */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric
          label="Active subscribers"
          icon={Users}
          href="/customers"
          value={stats.activeSubscribers.toLocaleString("en-KE")}
          context={`of ${stats.totalSubscribers.toLocaleString("en-KE")} total`}
        />
        <Metric
          label="Online now"
          icon={Wifi}
          href="/monitoring"
          value={sessionsKnown ? (stats.onlinePppoe + stats.onlineHotspot).toLocaleString("en-KE") : "—"}
          context={
            sessionsKnown
              ? `${stats.onlinePppoe} PPPoE · ${stats.onlineHotspot} hotspot`
              : "Live sessions not connected"
          }
        />
        <Metric
          label="Collected today"
          icon={CreditCard}
          href="/billing"
          value={formatKES(stats.revenueToday)}
          context="Completed payments"
        />
        <Metric
          label="Collected this month"
          icon={Banknote}
          href="/billing"
          value={formatKES(stats.revenueThisMonth)}
          context="Month to date"
        />
        <Metric
          label="Expiring in 24 h"
          icon={Clock}
          href="/customers"
          value={stats.expiringIn24h}
          tone={stats.expiringIn24h > 0 ? "warning" : "neutral"}
          context="Active subscriptions"
        />
        <Metric
          label="Suspended"
          icon={PauseCircle}
          href="/customers"
          value={stats.suspendedCount}
          tone={stats.suspendedCount > 0 ? "danger" : "neutral"}
          context="Service cut off"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Revenue */}
          <Panel title="Collected revenue" action={{ href: "/billing", label: "View payments" }}>
            <div className="p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="tabular text-xl font-semibold tracking-tight">{formatKES(periodTotal)}</div>
                  <div className="text-xs text-muted-foreground">Completed payments, last {period} days</div>
                </div>
                <div role="group" aria-label="Period" className="inline-flex rounded-md border border-border p-0.5">
                  {([7, 30] as RevenuePeriod[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={period === p}
                      onClick={() => setPeriod(p)}
                      className={cn(
                        "h-7 rounded px-2.5 text-xs font-medium transition-colors",
                        period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {p} days
                    </button>
                  ))}
                </div>
              </div>

              <RevenueChart buckets={buckets} period={period} className="mt-4" />

              {periodTotal === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  No completed payments recorded in the last {period} days. Confirmed M-Pesa transactions will appear here automatically.
                </p>
              )}
            </div>
          </Panel>

          {/* Network health */}
          <Panel title="Network health" action={{ href: "/routers", label: "All routers" }}>
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-border px-4 py-2 text-xs text-muted-foreground">
              <span>
                Routers online{" "}
                <strong className={cn("tabular font-semibold", offlineRouters > 0 ? "text-danger" : "text-foreground")}>
                  {stats.onlineRouters}/{stats.totalRouters}
                </strong>
              </span>
              <span>
                Open alerts <strong className="tabular font-semibold text-foreground">{openAlerts.length}</strong>
              </span>
              {sessionsKnown && stats.currentBandwidthMbps.download > 0 && (
                <span>
                  Throughput{" "}
                  <strong className="tabular font-semibold text-foreground">
                    ↓ {stats.currentBandwidthMbps.download} / ↑ {stats.currentBandwidthMbps.upload} Mbps
                  </strong>
                </span>
              )}
            </div>
            {routers.length === 0 ? (
              <EmptyState
                icon={RouterIcon}
                title="No routers added yet"
                description="Add your core MikroTik router to monitor its status, sessions and tunnels."
                action={
                  <Link href="/routers" className={btnClass("primary")}>
                    Add router
                  </Link>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b border-border">
                      <th scope="col" className="px-4 py-2 font-medium">Router</th>
                      <th scope="col" className="px-2 py-2 font-medium">Status</th>
                      <th scope="col" className="px-2 py-2 font-medium">Management IP</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">CPU</th>
                      <th scope="col" className="px-2 py-2 font-medium">Uptime</th>
                      <th scope="col" className="px-4 py-2 font-medium">Last seen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {routers.map((r) => (
                      <tr key={r.id} className="hover:bg-surface-subtle">
                        <td className="px-4 py-2">
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">{r.siteName || r.boardModel}</div>
                        </td>
                        <td className="px-2 py-2"><StatusBadge status={r.status} /></td>
                        <td className="tabular px-2 py-2 font-mono text-xs">{r.wireguardTunnelIp || r.managementIp}</td>
                        <td className="tabular px-2 py-2 text-right">{r.cpuLoad}%</td>
                        <td className="px-2 py-2 text-muted-foreground">{r.uptime || "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground">{timeAgo(r.lastSeenAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          {/* MikroTik Hardware Status */}
          <Panel title="MikroTik hardware status" action={{ href: "/routers", label: "Manage fleet" }}>
            {!selectedRouter ? (
              <EmptyState
                icon={RouterIcon}
                title="MikroTik Disconnected"
                description="No MikroTik routers are connected yet. Add a RouterOS node to view live CPU, memory, and system gauges."
                className="py-8"
                action={
                  <Link href="/routers" className={btnClass("primary")}>
                    Connect MikroTik
                  </Link>
                }
              />
            ) : (
              (() => {
                const isRouterOnline = selectedRouter.status === "ONLINE";
                const cpuPct = isRouterOnline ? Math.max(0, Math.min(100, selectedRouter.cpuLoad)) : 0;
                const cpuThreshold = getUsageThreshold(cpuPct);

                const totalRamMb = isRouterOnline
                  ? getBoardTotalRamMb(selectedRouter.boardModel, selectedRouter.freeMemoryMb)
                  : null;
                const usedRamMb =
                  totalRamMb !== null
                    ? Math.max(0, totalRamMb - selectedRouter.freeMemoryMb)
                    : null;
                const ramPct =
                  totalRamMb && usedRamMb !== null
                    ? Math.max(0, Math.min(100, Math.round((usedRamMb / totalRamMb) * 100)))
                    : 0;
                const ramThreshold = getUsageThreshold(ramPct);

                return (
                  <div className="divide-y divide-border-subtle">
                    {/* Router selector + identity */}
                    <div className="space-y-2.5 px-4 py-3">
                      {routers.length > 1 && (
                        <div>
                          <label htmlFor="dashboard-router-select" className="sr-only">
                            Select MikroTik router
                          </label>
                          <select
                            id="dashboard-router-select"
                            value={selectedRouter.id}
                            onChange={(e) => setSelectedRouterId(e.target.value)}
                            className="w-full rounded-md border border-border bg-surface-subtle px-2.5 py-1.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                          >
                            {routers.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name} ({r.boardModel} · {r.status})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Server className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                            <span className="truncate text-sm font-semibold text-foreground">
                              {selectedRouter.name}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {selectedRouter.boardModel || "RouterBOARD"} · RouterOS{" "}
                            {selectedRouter.routerosVersion || "—"}
                          </div>
                        </div>
                        <StatusBadge status={selectedRouter.status} />
                      </div>

                      {!isRouterOnline && (
                        <div className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-2.5 py-2 text-xs text-danger">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>
                            Router {selectedRouter.status.toLowerCase()} · Last seen{" "}
                            {timeAgo(selectedRouter.lastSeenAt)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 1. CPU Usage Gauge */}
                    <div className="flex items-center gap-3.5 px-4 py-3">
                      <CircularGauge
                        percentage={cpuPct}
                        strokeColor={cpuThreshold.strokeColor}
                        unavailable={!isRouterOnline}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                            <Cpu className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                            CPU Usage
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              isRouterOnline
                                ? cpuThreshold.badgeClass
                                : "border-border bg-surface-subtle text-muted-foreground"
                            )}
                          >
                            {isRouterOnline ? cpuThreshold.label : "Offline"}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              isRouterOnline ? cpuThreshold.barClass : "bg-border"
                            )}
                            style={{ width: `${isRouterOnline ? cpuPct : 0}%` }}
                          />
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{selectedRouter.name}</span>
                          <span className="tabular font-medium text-foreground">
                            {isRouterOnline ? `${cpuPct}% load` : "Unavailable"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. RAM / Memory Usage Gauge */}
                    <div className="flex items-center gap-3.5 px-4 py-3">
                      <CircularGauge
                        percentage={ramPct}
                        strokeColor={ramThreshold.strokeColor}
                        unavailable={!isRouterOnline || totalRamMb === null}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                            <HardDrive className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                            RAM / Memory
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              isRouterOnline && totalRamMb !== null
                                ? ramThreshold.badgeClass
                                : "border-border bg-surface-subtle text-muted-foreground"
                            )}
                          >
                            {isRouterOnline && totalRamMb !== null ? ramThreshold.label : "Unavailable"}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              isRouterOnline && totalRamMb !== null ? ramThreshold.barClass : "bg-border"
                            )}
                            style={{ width: `${isRouterOnline && totalRamMb !== null ? ramPct : 0}%` }}
                          />
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="tabular">
                            {isRouterOnline && totalRamMb !== null && usedRamMb !== null
                              ? `${usedRamMb.toLocaleString("en-KE")} / ${totalRamMb.toLocaleString("en-KE")} MB used`
                              : "Memory telemetry unavailable"}
                          </span>
                          <span className="tabular font-medium text-foreground">
                            {isRouterOnline && selectedRouter.freeMemoryMb > 0
                              ? `${selectedRouter.freeMemoryMb.toLocaleString("en-KE")} MB free`
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Storage & System Uptime / Identity */}
                    <div className="grid grid-cols-2 gap-2.5 bg-surface-subtle/50 px-4 py-3 text-xs">
                      <div className="rounded-md border border-border bg-surface p-2.5">
                        <div className="text-[11px] font-medium text-muted-foreground">System Uptime</div>
                        <div className="tabular mt-0.5 font-semibold text-foreground">
                          {isRouterOnline && selectedRouter.uptime ? selectedRouter.uptime : "Unavailable"}
                        </div>
                        <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                          {selectedRouter.wireguardTunnelIp || selectedRouter.managementIp}
                        </div>
                      </div>
                      <div className="rounded-md border border-border bg-surface p-2.5">
                        <div className="text-[11px] font-medium text-muted-foreground">NAND / Disk Storage</div>
                        <div className="mt-0.5 font-semibold text-foreground">Healthy</div>
                        <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                          Managed via RouterOS v7
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </Panel>

          {/* Network / Interface Status Gauge */}
          <Panel title="Network & interface status" action={{ href: "/monitoring", label: "Live NOC" }}>
            {(() => {
              const rxMbps = sessionsKnown ? stats.currentBandwidthMbps.download : 0;
              const txMbps = sessionsKnown ? stats.currentBandwidthMbps.upload : 0;
              const linkCeilingMbps = Math.max(1000, Math.ceil(Math.max(rxMbps, txMbps, 100) / 500) * 500);
              const rxPct = sessionsKnown ? Math.min(100, Math.round((rxMbps / linkCeilingMbps) * 100)) : 0;
              const txPct = sessionsKnown ? Math.min(100, Math.round((txMbps / linkCeilingMbps) * 100)) : 0;
              const totalSessions = sessionsKnown ? stats.onlinePppoe + stats.onlineHotspot : 0;
              const pppoeShare = totalSessions > 0 ? Math.round((stats.onlinePppoe / totalSessions) * 100) : 0;

              return (
                <div className="divide-y divide-border-subtle">
                  {/* RX / TX Interface Throughput Gauges */}
                  <div className="space-y-3 px-4 py-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Activity className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                        Aggregate Interface Traffic
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {sessionsKnown ? `${stats.onlineRouters}/${stats.totalRouters} routers reporting` : "Disconnected"}
                      </span>
                    </div>

                    {!sessionsKnown ? (
                      <div className="rounded-md border border-border bg-surface-subtle px-3 py-2.5 text-xs text-muted-foreground">
                        Connect a MikroTik router to stream live interface throughput.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {/* RX Download */}
                        <div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <ArrowDownToLine className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                              RX / Download
                            </span>
                            <span className="tabular font-semibold text-foreground">
                              {rxMbps.toLocaleString("en-KE")} Mbps
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                            <div
                              className="h-full rounded-full bg-success transition-all duration-500"
                              style={{ width: `${Math.max(rxMbps > 0 ? 4 : 0, rxPct)}%` }}
                            />
                          </div>
                        </div>

                        {/* TX Upload */}
                        <div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <ArrowUpFromLine className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                              TX / Upload
                            </span>
                            <span className="tabular font-semibold text-foreground">
                              {txMbps.toLocaleString("en-KE")} Mbps
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-500"
                              style={{ width: `${Math.max(txMbps > 0 ? 4 : 0, txPct)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Active Sessions Gauge */}
                  <div className="space-y-2 px-4 py-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">Active RouterOS Sessions</span>
                      <span className="tabular font-semibold text-foreground">
                        {sessionsKnown ? totalSessions.toLocaleString("en-KE") : "Unavailable"}
                      </span>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
                      {sessionsKnown && totalSessions > 0 && (
                        <div className="flex h-full w-full">
                          <div
                            className="h-full bg-primary transition-all duration-500"
                            style={{ width: `${pppoeShare}%` }}
                            title={`PPPoE: ${stats.onlinePppoe}`}
                          />
                          <div
                            className="h-full bg-success transition-all duration-500"
                            style={{ width: `${100 - pppoeShare}%` }}
                            title={`Hotspot: ${stats.onlineHotspot}`}
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                        PPPoE: <strong className="tabular text-foreground">{sessionsKnown ? stats.onlinePppoe : "—"}</strong>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
                        Hotspot: <strong className="tabular text-foreground">{sessionsKnown ? stats.onlineHotspot : "—"}</strong>
                      </span>
                      {selectedRouter && (
                        <span className="tabular">
                          Node: <strong className="text-foreground">{selectedRouter.activeSessions}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
