"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  Activity,
  Bell,
  Cpu,
  HardDrive,
  Users,
  ShieldCheck,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Server,
} from "lucide-react";
import { MikroTikService, LiveInterfaceMetric } from "@/lib/network/mikrotik";
import { getSeedNOCStats, SEED_ROUTERS } from "@/lib/db/mock-db";
import type { NetworkAlert, NOCStats, Router } from "@/types";
import { useAuth } from "@/lib/auth/auth-context";
import { cn, formatShortDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/States";
import { TopologyAndAutomationPanels } from "@/components/monitoring/TopologyAndAutomationPanels";

const SEVERITY_BADGE_STYLES: Record<NetworkAlert["severity"], string> = {
  CRITICAL: "border-danger/30 bg-danger-soft text-danger",
  WARNING: "border-warning/30 bg-warning-soft text-warning",
  INFO: "border-info/30 bg-info-soft text-info",
};

const SEVERITY_DOT_STYLES: Record<NetworkAlert["severity"], string> = {
  CRITICAL: "bg-danger",
  WARNING: "bg-warning",
  INFO: "bg-info",
};

function computeRouterMemoryUsedPct(router: Router): number {
  const freeMb = Number(router.freeMemoryMb ?? 0);
  if (freeMb <= 0) return 0;
  const totalMb =
    freeMb <= 256
      ? 256
      : freeMb <= 512
      ? 512
      : freeMb <= 1024
      ? 1024
      : freeMb <= 2048
      ? 2048
      : 4096;
  return Math.max(0, Math.min(100, Math.round(((totalMb - freeMb) / totalMb) * 100)));
}

export default function MonitoringPage() {
  const { isDemoMode, isLoading: authLoading, user } = useAuth();

  const [nocStats, setNocStats] = useState<NOCStats | null>(null);
  const [routers, setRouters] = useState<Router[]>([]);
  const [interfaces, setInterfaces] = useState<LiveInterfaceMetric[]>([]);
  const [alerts, setAlerts] = useState<NetworkAlert[]>([]);
  const [selectedRouterId, setSelectedRouterId] = useState<string>("ALL");
  const [showInterfaceDetails, setShowInterfaceDetails] = useState(false);
  const [alertFilter, setAlertFilter] = useState<"OPEN" | "ALL">("OPEN");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    if (isDemoMode) {
      const seedStats = getSeedNOCStats();
      const seedIfaces = await MikroTikService.getInterfaceMetrics("rtr-01");
      setNocStats(seedStats);
      setRouters(SEED_ROUTERS);
      setInterfaces(seedIfaces);
      setAlerts(seedStats.recentAlerts);
      setLoading(false);
      return;
    }

    try {
      const [nocRes, routersRes] = await Promise.all([
        fetch("/api/v1/monitoring/noc"),
        fetch("/api/v1/mikrotik-fleet"),
      ]);
      const [nocJson, routersJson] = await Promise.all([
        nocRes.json().catch(() => null),
        routersRes.json().catch(() => null),
      ]);

      if (nocJson?.success && nocJson.data) {
        setNocStats(nocJson.data);
        setAlerts(nocJson.data.recentAlerts ?? []);
      } else {
        setError("Network monitoring telemetry could not be loaded.");
      }

      if (routersJson?.success && Array.isArray(routersJson.data)) {
        setRouters(routersJson.data);
      } else {
        setRouters([]);
      }

      // Real accounts only display live interface telemetry when a router stream is connected
      setInterfaces([]);
    } catch {
      setError("Network monitoring telemetry could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    load();
  }, [authLoading, load, user?.id]);

  // Filter routers by selection
  const activeRouter = useMemo(() => {
    if (selectedRouterId === "ALL") return null;
    return routers.find((r) => r.id === selectedRouterId) ?? null;
  }, [routers, selectedRouterId]);

  const scopedRouters = useMemo(() => {
    return activeRouter ? [activeRouter] : routers;
  }, [activeRouter, routers]);

  const totalRouters = routers.length;
  const onlineRouters = routers.filter((r) => r.status === "ONLINE").length;
  const hasRouterTelemetry = totalRouters > 0 && onlineRouters > 0;

  // 1. Network Health %
  const openAlerts = useMemo(
    () => alerts.filter((a) => !a.isResolved),
    [alerts]
  );
  const criticalAlertsCount = openAlerts.filter(
    (a) => a.severity === "CRITICAL"
  ).length;
  const warningAlertsCount = openAlerts.filter(
    (a) => a.severity === "WARNING"
  ).length;

  const healthPct = useMemo(() => {
    if (!hasRouterTelemetry) return null;
    const baseRatio = (onlineRouters / totalRouters) * 100;
    const penalty = criticalAlertsCount * 10 + warningAlertsCount * 2;
    return Math.max(0, Math.min(100, Math.round(baseRatio - penalty)));
  }, [hasRouterTelemetry, onlineRouters, totalRouters, criticalAlertsCount, warningAlertsCount]);

  // 2. CPU % (Peak across online routers or selected router)
  const cpuPct = useMemo(() => {
    const online = scopedRouters.filter((r) => r.status === "ONLINE");
    if (online.length === 0) return null;
    if (activeRouter) return Math.round(activeRouter.cpuLoad || 0);
    return Math.round(Math.max(...online.map((r) => r.cpuLoad || 0)));
  }, [scopedRouters, activeRouter]);

  // 3. Memory %
  const memoryPct = useMemo(() => {
    const online = scopedRouters.filter((r) => r.status === "ONLINE");
    if (online.length === 0) return null;
    if (activeRouter) return computeRouterMemoryUsedPct(activeRouter);
    const maxMem = Math.max(...online.map(computeRouterMemoryUsedPct));
    return maxMem;
  }, [scopedRouters, activeRouter]);

  // 4. Active Users
  const activeUsersData = useMemo(() => {
    if (!nocStats) {
      return { count: null as number | null, subLabel: "No telemetry", pct: 0 };
    }
    if (isDemoMode || nocStats.sessionsAvailable) {
      const totalOnline = nocStats.onlinePppoe + nocStats.onlineHotspot;
      const cap = Math.max(totalOnline, nocStats.totalSubscribers || 100);
      return {
        count: totalOnline,
        subLabel: `${nocStats.onlinePppoe} PPPoE · ${nocStats.onlineHotspot} Hotspot`,
        pct: Math.min(100, Math.round((totalOnline / cap) * 100)),
      };
    }
    const activeSubs = nocStats.activeSubscribers ?? 0;
    const totalSubs = Math.max(activeSubs, nocStats.totalSubscribers || 1);
    return {
      count: activeSubs,
      subLabel:
        activeSubs > 0
          ? `${activeSubs} Active subscriber${activeSubs === 1 ? "" : "s"}`
          : "No active sessions",
      pct: activeSubs > 0 ? Math.min(100, Math.round((activeSubs / totalSubs) * 100)) : 0,
    };
  }, [nocStats, isDemoMode]);

  // 5. Uptime display
  const primaryUptime = useMemo(() => {
    if (!hasRouterTelemetry) return "—";
    if (activeRouter) return activeRouter.uptime || "—";
    return routers[0]?.uptime || "—";
  }, [hasRouterTelemetry, activeRouter, routers]);

  // Traffic calculations from interfaces (or NOCStats bandwidth if present)
  const hasTrafficTelemetry = interfaces.length > 0;
  const totalRxMbps = useMemo(() => {
    if (!hasTrafficTelemetry) return null;
    // Primary WAN interface or sum of WAN rx
    const wan = interfaces[0];
    return wan ? Number((wan.rxBps / 1_000_000).toFixed(1)) : 0;
  }, [hasTrafficTelemetry, interfaces]);

  const totalTxMbps = useMemo(() => {
    if (!hasTrafficTelemetry) return null;
    const wan = interfaces[0];
    return wan ? Number((wan.txBps / 1_000_000).toFixed(1)) : 0;
  }, [hasTrafficTelemetry, interfaces]);

  const linkCapacityMbps = 500; // Reference capacity for visual utilization bars when traffic exists
  const utilizationPct =
    totalRxMbps !== null
      ? Math.min(100, Math.round((totalRxMbps / linkCapacityMbps) * 100))
      : null;
  const peakRxMbps =
    totalRxMbps !== null
      ? Number(
          Math.max(
            totalRxMbps,
            nocStats?.currentBandwidthMbps?.download ?? totalRxMbps
          ).toFixed(1)
        )
      : null;

  const handleResolveAlert = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isResolved: true } : a))
    );
  };

  const displayedAlerts = useMemo(() => {
    return alertFilter === "OPEN"
      ? alerts.filter((a) => !a.isResolved)
      : alerts;
  }, [alerts, alertFilter]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Status tone helpers
  const cpuTone =
    cpuPct === null
      ? "bg-muted"
      : cpuPct > 80
      ? "bg-danger"
      : cpuPct >= 60
      ? "bg-warning"
      : "bg-success";
  const cpuLabel =
    cpuPct === null
      ? "Unavailable"
      : cpuPct > 80
      ? "Critical"
      : cpuPct >= 60
      ? "Elevated"
      : "Normal";

  const memTone =
    memoryPct === null
      ? "bg-muted"
      : memoryPct > 85
      ? "bg-danger"
      : memoryPct >= 70
      ? "bg-warning"
      : "bg-success";
  const memLabel =
    memoryPct === null
      ? "Unavailable"
      : memoryPct > 85
      ? "High"
      : memoryPct >= 70
      ? "Elevated"
      : "Healthy";

  const healthColor =
    healthPct === null
      ? "text-muted-foreground"
      : healthPct >= 90
      ? "text-success"
      : healthPct >= 70
      ? "text-warning"
      : "text-danger";

  const healthBarTone =
    healthPct === null
      ? "bg-muted"
      : healthPct >= 90
      ? "bg-success"
      : healthPct >= 70
      ? "bg-warning"
      : "bg-danger";

  // Radial gauge geometry
  const gaugeRadius = 52;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeProgress = healthPct !== null ? healthPct : 0;
  const gaugeStrokeDashoffset =
    gaugeCircumference - (gaugeProgress / 100) * gaugeCircumference;

  return (
    <AppShell title="Monitoring">
      <PageHeader
        title="Network Monitoring"
        description="Live NOC health, traffic & alerts"
        actions={
          <div className="flex items-center gap-2">
            {routers.length > 0 && (
              <select
                aria-label="Filter by router"
                value={selectedRouterId}
                onChange={(e) => setSelectedRouterId(e.target.value)}
                className="h-8 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
              >
                <option value="ALL">All Routers ({routers.length})</option>
                {routers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.managementIp})
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                load();
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-subtle"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {error && (
        <ErrorState
          title="Could not load monitoring data"
          detail={error}
          onRetry={load}
        />
      )}

      {/* TOP KPI CARDS (5 Compact Visual Cards) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* 1. Network Health */}
        <button
          type="button"
          onClick={() => scrollToSection("noc-health-row")}
          className="group flex flex-col justify-between rounded-lg border border-border bg-surface p-3.5 text-left shadow-xs transition-colors hover:border-primary/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Network Health
            </span>
            <ShieldCheck className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="tabular font-mono text-2xl font-bold text-foreground">
              {loading ? "…" : healthPct !== null ? `${healthPct}%` : "—"}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
            <div
              className={cn("h-full rounded-full transition-all", healthBarTone)}
              style={{ width: `${healthPct ?? 0}%` }}
            />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                healthPct === null
                  ? "bg-muted-foreground/40"
                  : healthPct >= 90
                  ? "bg-success"
                  : healthPct >= 70
                  ? "bg-warning"
                  : "bg-danger"
              )}
            />
            <span>
              {healthPct === null
                ? "No telemetry"
                : healthPct >= 90
                ? "Online"
                : healthPct >= 70
                ? "Degraded"
                : "Critical"}
            </span>
          </div>
        </button>

        {/* 2. CPU */}
        <button
          type="button"
          onClick={() => scrollToSection("noc-health-row")}
          className="group flex flex-col justify-between rounded-lg border border-border bg-surface p-3.5 text-left shadow-xs transition-colors hover:border-primary/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">CPU</span>
            <Cpu className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="tabular font-mono text-2xl font-bold text-foreground">
              {loading ? "…" : cpuPct !== null ? `${cpuPct}%` : "—"}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
            <div
              className={cn("h-full rounded-full transition-all", cpuTone)}
              style={{ width: `${cpuPct ?? 0}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{cpuLabel}</span>
            {cpuPct !== null && !activeRouter && routers.length > 1 && (
              <span className="font-mono text-[10px]">Peak node</span>
            )}
          </div>
        </button>

        {/* 3. Memory */}
        <button
          type="button"
          onClick={() => scrollToSection("noc-health-row")}
          className="group flex flex-col justify-between rounded-lg border border-border bg-surface p-3.5 text-left shadow-xs transition-colors hover:border-primary/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Memory
            </span>
            <HardDrive className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="tabular font-mono text-2xl font-bold text-foreground">
              {loading ? "…" : memoryPct !== null ? `${memoryPct}%` : "—"}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
            <div
              className={cn("h-full rounded-full transition-all", memTone)}
              style={{ width: `${memoryPct ?? 0}%` }}
            />
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">{memLabel}</div>
        </button>

        {/* 4. Active Users */}
        <button
          type="button"
          onClick={() => scrollToSection("noc-traffic-row")}
          className="group flex flex-col justify-between rounded-lg border border-border bg-surface p-3.5 text-left shadow-xs transition-colors hover:border-primary/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Active Users
            </span>
            <Users className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="tabular font-mono text-2xl font-bold text-foreground">
              {loading
                ? "…"
                : activeUsersData.count !== null
                ? activeUsersData.count
                : "—"}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${activeUsersData.pct}%` }}
            />
          </div>
          <div className="mt-2 truncate text-[11px] text-muted-foreground">
            {activeUsersData.subLabel}
          </div>
        </button>

        {/* 5. Alerts */}
        <button
          type="button"
          onClick={() => scrollToSection("noc-alerts-row")}
          className="col-span-2 flex flex-col justify-between rounded-lg border border-border bg-surface p-3.5 text-left shadow-xs transition-colors hover:border-primary/40 sm:col-span-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Alerts
            </span>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="tabular font-mono text-2xl font-bold text-foreground">
              {loading ? "…" : openAlerts.length}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                criticalAlertsCount > 0
                  ? "bg-danger"
                  : warningAlertsCount > 0
                  ? "bg-warning"
                  : "bg-success"
              )}
              style={{
                width:
                  openAlerts.length === 0
                    ? "100%"
                    : `${Math.min(100, openAlerts.length * 35)}%`,
              }}
            />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                criticalAlertsCount > 0
                  ? "bg-danger"
                  : warningAlertsCount > 0
                  ? "bg-warning"
                  : "bg-success"
              )}
            />
            <span>
              {openAlerts.length === 0
                ? "All clear"
                : criticalAlertsCount > 0
                ? `${criticalAlertsCount} Critical`
                : `${warningAlertsCount} Warning`}
            </span>
          </div>
        </button>
      </div>

      {/* ROW 1: NETWORK HEALTH GAUGE + TRAFFIC OVERVIEW */}
      <div
        id="noc-health-row"
        className="grid grid-cols-1 gap-4 lg:grid-cols-12"
      >
        {/* Network Health Radial Gauge Card (5 cols on lg) */}
        <section className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4 shadow-xs lg:col-span-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Network Health
            </h3>
            <span className="font-mono text-xs text-muted-foreground">
              {totalRouters > 0
                ? `${onlineRouters}/${totalRouters} Routers`
                : "0 Routers"}
            </span>
          </div>

          <div className="my-3 flex flex-col items-center justify-center sm:flex-row sm:gap-6">
            {/* Radial SVG Gauge */}
            <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
              <svg
                className="h-full w-full -rotate-90 transform"
                viewBox="0 0 120 120"
              >
                <circle
                  cx="60"
                  cy="60"
                  r={gaugeRadius}
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="10"
                  className="text-surface-subtle"
                />
                <circle
                  cx="60"
                  cy="60"
                  r={gaugeRadius}
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeDasharray={gaugeCircumference}
                  strokeDashoffset={gaugeStrokeDashoffset}
                  strokeLinecap="round"
                  className={cn("transition-all duration-500", healthColor)}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="tabular font-mono text-2xl font-bold text-foreground">
                  {healthPct !== null ? `${healthPct}%` : "—"}
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      healthPct === null
                        ? "bg-muted-foreground/40"
                        : healthPct >= 90
                        ? "bg-success"
                        : healthPct >= 70
                        ? "bg-warning"
                        : "bg-danger"
                    )}
                  />
                  {healthPct === null
                    ? "No telemetry"
                    : healthPct >= 90
                    ? "Healthy"
                    : healthPct >= 70
                    ? "Degraded"
                    : "Critical"}
                </span>
              </div>
            </div>

            {/* Compact System Vitals alongside Gauge */}
            <div className="mt-3 grid w-full grid-cols-2 gap-2 sm:mt-0 sm:grid-cols-1">
              <div className="rounded-md border border-border-subtle bg-surface-subtle/50 px-3 py-2">
                <div className="text-[11px] text-muted-foreground">Uptime</div>
                <div className="mt-0.5 font-mono text-xs font-semibold text-foreground">
                  {primaryUptime}
                </div>
              </div>
              <div className="rounded-md border border-border-subtle bg-surface-subtle/50 px-3 py-2">
                <div className="text-[11px] text-muted-foreground">
                  Active Router
                </div>
                <div className="mt-0.5 truncate font-mono text-xs font-semibold text-foreground">
                  {activeRouter
                    ? activeRouter.name
                    : routers.length > 0
                    ? `${onlineRouters} Online`
                    : "None configured"}
                </div>
              </div>
            </div>
          </div>

          {/* Router Quick Chips if multiple routers exist */}
          {routers.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-border-subtle pt-3">
              {routers.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() =>
                    setSelectedRouterId((prev) =>
                      prev === r.id ? "ALL" : r.id
                    )
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                    selectedRouterId === r.id
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-surface-subtle/60 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      r.status === "ONLINE" ? "bg-success" : "bg-danger"
                    )}
                  />
                  <span className="truncate max-w-[9rem]">{r.name}</span>
                  <span className="font-mono text-[10px] opacity-80">
                    {r.cpuLoad}%
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between border-t border-border-subtle pt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Server className="h-3.5 w-3.5" />
                No routers connected
              </span>
              <span className="font-mono">Unavailable</span>
            </div>
          )}
        </section>

        {/* Traffic Overview Card (7 cols on lg) */}
        <section className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4 shadow-xs lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              Traffic Overview
            </h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1 font-mono font-semibold text-primary">
                <ArrowDownLeft className="h-3.5 w-3.5" />
                RX {totalRxMbps !== null ? `${totalRxMbps} Mbps` : "—"}
              </span>
              <span className="inline-flex items-center gap-1 font-mono font-semibold text-info">
                <ArrowUpRight className="h-3.5 w-3.5" />
                TX {totalTxMbps !== null ? `${totalTxMbps} Mbps` : "—"}
              </span>
            </div>
          </div>

          {!hasTrafficTelemetry ? (
            <div className="my-6 flex flex-col items-center justify-center rounded-md border border-dashed border-border py-6 text-center">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <p className="mt-1.5 text-xs font-medium text-foreground">
                No traffic telemetry
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Connect a MikroTik router to stream live RX/TX throughput
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {interfaces.map((iface) => {
                const rxMbps = Number((iface.rxBps / 1_000_000).toFixed(1));
                const txMbps = Number((iface.txBps / 1_000_000).toFixed(1));
                const combinedMbps = Number((rxMbps + txMbps).toFixed(1));
                const maxScale = 300;
                const rxWidth = Math.min(100, Math.round((rxMbps / maxScale) * 100));
                const txWidth = Math.min(
                  100 - rxWidth,
                  Math.round((txMbps / maxScale) * 100)
                );

                return (
                  <div key={iface.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-medium text-foreground">
                        {iface.name}
                      </span>
                      <span className="tabular font-mono text-muted-foreground">
                        <span className="text-foreground font-semibold">
                          {rxMbps}
                        </span>{" "}
                        ↓ /{" "}
                        <span className="text-foreground font-semibold">
                          {txMbps}
                        </span>{" "}
                        ↑ Mbps{" "}
                        <span className="text-[11px] opacity-75">
                          ({combinedMbps} Mbps)
                        </span>
                      </span>
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${ Math.max(rxMbps > 0 ? 3 : 0, rxWidth) }%` }}
                        title={`RX: ${rxMbps} Mbps`}
                      />
                      <div
                        className="h-full bg-info transition-all"
                        style={{ width: `${ Math.max(txMbps > 0 ? 3 : 0, txWidth) }%` }}
                        title={`TX: ${txMbps} Mbps`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-2.5 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Download (RX)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-info" />
                Upload (TX)
              </span>
            </div>
            <span className="font-mono">
              {hasTrafficTelemetry
                ? `${interfaces.filter((i) => i.running).length}/${interfaces.length} interfaces active`
                : "No interfaces polled"}
            </span>
          </div>
        </section>
      </div>

      {/* ROW 2: INTERFACE STATUS + ACTIVE ALERTS */}
      <div
        id="noc-alerts-row"
        className="grid grid-cols-1 gap-4 lg:grid-cols-12"
      >
        {/* Interface Status Card (6 cols) */}
        <section className="rounded-lg border border-border bg-surface p-4 shadow-xs lg:col-span-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Interface Status
              </h3>
              {interfaces.length > 0 && (
                <span className="rounded-full bg-surface-subtle px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {interfaces.length}
                </span>
              )}
            </div>
            {interfaces.length > 0 && (
              <button
                type="button"
                onClick={() => setShowInterfaceDetails((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-subtle px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-surface"
              >
                {showInterfaceDetails ? "Hide details" : "View details"}
                {showInterfaceDetails ? (
                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            )}
          </div>

          {interfaces.length === 0 ? (
            <div className="mt-3 rounded-md border border-border-subtle bg-surface-subtle/50 px-3 py-6 text-center text-xs text-muted-foreground">
              No interface telemetry available
            </div>
          ) : (
            <div className="mt-3 divide-y divide-border-subtle">
              {interfaces.map((iface) => {
                const rxMbps = (iface.rxBps / 1_000_000).toFixed(1);
                const txMbps = (iface.txBps / 1_000_000).toFixed(1);
                const hasErrors = iface.rxErrors + iface.txErrors > 0;
                return (
                  <div key={iface.name} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            !iface.running
                              ? "bg-danger"
                              : hasErrors
                              ? "bg-warning"
                              : "bg-success"
                          )}
                        />
                        <span className="truncate font-mono font-medium text-foreground">
                          {iface.name}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="tabular font-mono text-muted-foreground">
                          {rxMbps} Mbps ↓ · {txMbps} Mbps ↑
                        </span>
                        <StatusBadge
                          status={iface.running ? "ONLINE" : "OFFLINE"}
                          label={iface.running ? "Running" : "Down"}
                        />
                      </div>
                    </div>

                    {showInterfaceDetails && (
                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded bg-surface-subtle/60 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                        <span>
                          Type: {iface.type} · MAC: {iface.macAddress}
                        </span>
                        <span
                          className={cn(
                            hasErrors && "font-semibold text-danger"
                          )}
                        >
                          Pkts: {iface.rxPackets.toLocaleString()} RX /{" "}
                          {iface.txPackets.toLocaleString()} TX · Err:{" "}
                          {iface.rxErrors}/{iface.txErrors}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Active Alerts Card (6 cols) */}
        <section className="rounded-lg border border-border bg-surface p-4 shadow-xs lg:col-span-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Active Alerts
              </h3>
              <span className="rounded-full bg-surface-subtle px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {openAlerts.length}
              </span>
            </div>
            {alerts.length > 0 && (
              <div className="inline-flex rounded-md border border-border bg-surface-subtle p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setAlertFilter("OPEN")}
                  className={cn(
                    "rounded px-2 py-0.5 font-medium transition-colors",
                    alertFilter === "OPEN"
                      ? "bg-surface text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Open ({openAlerts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAlertFilter("ALL")}
                  className={cn(
                    "rounded px-2 py-0.5 font-medium transition-colors",
                    alertFilter === "ALL"
                      ? "bg-surface text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All ({alerts.length})
                </button>
              </div>
            )}
          </div>

          {displayedAlerts.length === 0 ? (
            <div className="mt-3 flex items-center justify-center gap-2 rounded-md border border-success/20 bg-success-soft/40 px-3 py-6 text-xs font-medium text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>All Clear — No active alerts</span>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-border-subtle">
              {displayedAlerts.map((alert) => (
                <li
                  key={alert.id}
                  className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold",
                          SEVERITY_BADGE_STYLES[alert.severity]
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            SEVERITY_DOT_STYLES[alert.severity]
                          )}
                        />
                        {alert.severity}
                      </span>
                      <span className="truncate text-xs font-semibold text-foreground">
                        {alert.title}
                      </span>
                      {alert.routerName && (
                        <span className="font-mono text-[11px] text-muted-foreground">
                          · {alert.routerName}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {alert.message}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <time className="font-mono text-[11px] text-muted-foreground">
                      {formatShortDate(alert.createdAt)}
                    </time>
                    {!alert.isResolved ? (
                      <button
                        type="button"
                        onClick={() => handleResolveAlert(alert.id)}
                        className="rounded border border-border bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-surface"
                      >
                        Ack
                      </button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        Resolved
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ROW 3: BANDWIDTH / TRAFFIC ANALYTICS */}
      <section
        id="noc-traffic-row"
        className="rounded-lg border border-border bg-surface p-4 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Bandwidth &amp; Traffic Analytics
            </h3>
            <p className="text-xs text-muted-foreground">
              Aggregate WAN throughput and link capacity utilization
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="rounded-md border border-border-subtle bg-surface-subtle/60 px-2.5 py-1">
              <span className="text-muted-foreground">Peak: </span>
              <span className="font-mono font-semibold text-foreground">
                {peakRxMbps !== null ? `${peakRxMbps} Mbps` : "—"}
              </span>
            </div>
            <div className="rounded-md border border-border-subtle bg-surface-subtle/60 px-2.5 py-1">
              <span className="text-muted-foreground">Utilization: </span>
              <span className="font-mono font-semibold text-foreground">
                {utilizationPct !== null ? `${utilizationPct}%` : "—"}
              </span>
            </div>
          </div>
        </div>

        {!hasTrafficTelemetry ? (
          <div className="mt-3 rounded-md border border-border-subtle bg-surface-subtle/40 px-4 py-6 text-center text-xs text-muted-foreground">
            No traffic data
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Download / Upload Bars (5 cols) */}
            <div className="flex flex-col justify-center space-y-3 lg:col-span-5">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    Download (RX)
                  </span>
                  <span className="tabular font-mono font-semibold text-primary">
                    {totalRxMbps} Mbps
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(((totalRxMbps ?? 0) / linkCapacityMbps) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    Upload (TX)
                  </span>
                  <span className="tabular font-mono font-semibold text-info">
                    {totalTxMbps} Mbps
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                  <div
                    className="h-full rounded-full bg-info transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(((totalTxMbps ?? 0) / linkCapacityMbps) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Compact Visual Throughput Sparkline / Area Chart (7 cols) */}
            <div className="rounded-md border border-border-subtle bg-surface-subtle/30 p-3 lg:col-span-7">
              <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>WAN Throughput Profile (RX vs TX)</span>
                <span className="font-mono">Peak {peakRxMbps} Mbps</span>
              </div>
              <svg
                viewBox="0 0 400 72"
                className="h-16 w-full overflow-visible"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* RX Area & Line */}
                <path
                  d="M0,52 L50,46 L100,38 L150,42 L200,26 L250,18 L300,24 L350,14 L400,20 L400,70 L0,70 Z"
                  fill="url(#rxGrad)"
                  className="text-primary"
                />
                <path
                  d="M0,52 L50,46 L100,38 L150,42 L200,26 L250,18 L300,24 L350,14 L400,20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-primary"
                />
                {/* TX Line */}
                <path
                  d="M0,62 L50,58 L100,55 L150,57 L200,48 L250,44 L300,47 L350,42 L400,45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeDasharray="4 2"
                  className="text-info"
                />
              </svg>
            </div>
          </div>
        )}
      </section>

      {/* ROW 4: COMPACT NETWORK TOPOLOGY & AUTOMATION CARDS */}
      <TopologyAndAutomationPanels />
    </AppShell>
  );
}
