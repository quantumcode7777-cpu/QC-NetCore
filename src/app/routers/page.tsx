"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Router as RouterIcon, Terminal, Copy, Check, RefreshCw, X } from "lucide-react";
import { SEED_ROUTERS, SEED_ORGANIZATION } from "@/lib/db/mock-db";
import { Router } from "@/types";
import { RouterScriptGenerator } from "@/lib/network/script-generator";
import { MikroTikService } from "@/lib/network/mikrotik";
import { useAuth } from "@/lib/auth/auth-context";
import { cn, formatShortDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader, btnClass } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/States";
import {
  RoutersModeTabs,
  OltAndGisPanels,
  type RoutersViewMode,
} from "@/components/routers/OltAndGisPanels";

export default function RoutersPage() {
  const { isDemoMode, isLoading: authLoading, user, organization } = useAuth();

  const [viewMode, setViewMode] = useState<RoutersViewMode>("MIKROTIK_BNG");
  const [routers, setRouters] = useState<Router[]>([]);
  const [selectedRouterForScript, setSelectedRouterForScript] = useState<Router | null>(null);
  const [copied, setCopied] = useState(false);
  const [testingRouterId, setTestingRouterId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { latency: number; msg: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchRouters = async () => {
    setLoadError(null);
    if (isDemoMode) {
      setRouters(SEED_ROUTERS);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/v1/mikrotik-fleet");
      const data = await res.json();
      if (data?.success && data.data) {
        setRouters(data.data);
      } else {
        setLoadError("Routers could not be loaded. Nothing was changed.");
      }
    } catch (err) {
      console.error("[Routers] Failed to fetch routers:", err);
      setLoadError("Routers could not be loaded. Nothing was changed.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    setIsLoading(true);
    fetchRouters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isDemoMode, user?.id]);

  useEffect(() => {
    if (!selectedRouterForScript) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelectedRouterForScript(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedRouterForScript]);

  const handleTestConnection = async (router: Router) => {
    setTestingRouterId(router.id);
    const res = await MikroTikService.testConnection(router);
    setTestingRouterId(null);
    setTestResults((prev) => ({
      ...prev,
      [router.id]: { latency: res.latencyMs, msg: res.message },
    }));
  };

  const activeScript = selectedRouterForScript
    ? RouterScriptGenerator.generateScript({
        routerName: selectedRouterForScript.name,
        orgName: organization?.name || SEED_ORGANIZATION.name,
        orgSlug: organization?.slug || SEED_ORGANIZATION.slug,
        orgId: organization?.id || SEED_ORGANIZATION.id,
        routerOsVersion: "v7",
        managementTunnelIp: selectedRouterForScript.wireguardTunnelIp || "10.200.1.2",
        saasGatewayHost: "vpn.gtechisp.co.ke",
        saasGatewayPort: 51820,
        saasPublicKey: "aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890=",
        routerPrivateKey: "sEcReT_rOuTeR_pRiVaTe_kEy_8912==",
        radiusSecret: "GtechRadiusSecret2025!",
        radiusAuthPort: 1812,
        radiusAcctPort: 1813,
        hotspotDnsName: "wifi.gtech.local",
      })
    : "";

  const handleCopyScript = () => {
    navigator.clipboard.writeText(activeScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const online = routers.filter((r) => r.status === "ONLINE").length;

  return (
    <AppShell title="Routers">
      <PageHeader
        title="Routers"
        description={
          isLoading
            ? "MikroTik fleet status and provisioning."
            : `${online} of ${routers.length} online · MikroTik fleet status and provisioning.`
        }
        actions={
          <button
            onClick={() => routers.length > 0 && setSelectedRouterForScript(routers[0])}
            disabled={routers.length === 0}
            className={btnClass("primary")}
          >
            <Terminal className="h-4 w-4" aria-hidden="true" />
            Provisioning script
          </button>
        }
      />

      {loadError && <ErrorState title="Could not load routers" detail={loadError} onRetry={fetchRouters} />}

      <RoutersModeTabs mode={viewMode} onChange={setViewMode} />

      <OltAndGisPanels mode={viewMode} />

      {viewMode === "MIKROTIK_BNG" && (
        <section className="rounded-lg border border-border bg-surface shadow-xs">
          {isLoading ? (
            <TableSkeleton rows={4} cols={6} />
          ) : routers.length === 0 ? (
            <EmptyState
              icon={RouterIcon}
              title="No routers yet"
              description="Add your first MikroTik router to monitor its status and sessions. Generate a provisioning script to connect it."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] text-left text-sm">
                <thead className="border-b border-border bg-surface-subtle text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Router</th>
                    <th scope="col" className="px-3 py-2 font-medium">Status</th>
                    <th scope="col" className="px-3 py-2 font-medium">Tunnel / IP</th>
                    <th scope="col" className="px-3 py-2 font-medium">RouterOS</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">CPU</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Free RAM</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Sessions</th>
                    <th scope="col" className="px-3 py-2 font-medium">Uptime</th>
                    <th scope="col" className="px-3 py-2 font-medium">Last seen</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {routers.map((router) => {
                    const result = testResults[router.id];
                    const isTesting = testingRouterId === router.id;
                    return (
                      <React.Fragment key={router.id}>
                        <tr className="hover:bg-surface-subtle">
                          <td className="px-3 py-2">
                            <div className="font-medium leading-5">{router.name}</div>
                            <div className="text-xs text-muted-foreground">{router.boardModel || "MikroTik"}</div>
                          </td>
                          <td className="px-3 py-2"><StatusBadge status={router.status} /></td>
                          <td className="tabular px-3 py-2 font-mono text-xs">{router.wireguardTunnelIp || router.managementIp}</td>
                          <td className="px-3 py-2 text-muted-foreground">{router.routerosVersion || "—"}</td>
                          <td className={cn("tabular px-3 py-2 text-right", router.cpuLoad >= 80 && "font-medium text-danger")}>
                            {router.cpuLoad}%
                          </td>
                          <td className="tabular px-3 py-2 text-right">{router.freeMemoryMb} MB</td>
                          <td className="tabular px-3 py-2 text-right">{router.activeSessions ?? 0}</td>
                          <td className="px-3 py-2 text-muted-foreground">{router.uptime || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{formatShortDate(router.lastSeenAt)}</td>
                          <td className="px-3 py-2">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleTestConnection(router)}
                                disabled={isTesting}
                                className={btnClass("secondary", "h-8 px-2.5")}
                              >
                                <RefreshCw className={cn("h-3.5 w-3.5", isTesting && "animate-spin")} aria-hidden="true" />
                                {isTesting ? "Testing" : "Test"}
                              </button>
                              <button
                                onClick={() => setSelectedRouterForScript(router)}
                                className={btnClass("ghost", "h-8 px-2.5")}
                                aria-label={`Provisioning script for ${router.name}`}
                              >
                                <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
                                Script
                              </button>
                            </div>
                          </td>
                        </tr>
                        {result && (
                          <tr>
                            <td colSpan={10} className="px-3 pb-2">
                              <div
                                role="status"
                                className={cn(
                                  "rounded-md border px-3 py-1.5 text-xs",
                                  result.latency >= 0
                                    ? "border-success/30 bg-success-soft text-success"
                                    : "border-danger/30 bg-danger-soft text-danger"
                                )}
                              >
                                {result.msg}
                                {result.latency >= 0 ? ` · ${result.latency} ms` : ""}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {selectedRouterForScript && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="script-title"
            className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-xl border border-border bg-surface shadow-[var(--shadow-pop)] sm:rounded-lg"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h3 id="script-title" className="text-base font-semibold">RouterOS provisioning script</h3>
                <p className="text-sm text-muted-foreground">
                  Paste into the MikroTik terminal for {selectedRouterForScript.name}.
                </p>
              </div>
              <button
                onClick={() => setSelectedRouterForScript(null)}
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-elevated"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-[14rem] flex-1 overflow-auto bg-surface-subtle p-4 font-mono text-xs leading-5 text-foreground">
              <pre className="whitespace-pre-wrap">{activeScript}</pre>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-muted-foreground">
                Configures the WireGuard management tunnel, RADIUS client and M-Pesa walled garden.
              </span>
              <button onClick={handleCopyScript} className={btnClass("primary")}>
                {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                {copied ? "Copied" : "Copy script"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
