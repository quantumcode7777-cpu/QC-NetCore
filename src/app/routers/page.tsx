"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  Router as RouterIcon,
  Terminal,
  Copy,
  Check,
  RefreshCw,
  X,
  Download,
  AlertCircle,
  Plus,
} from "lucide-react";
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

interface ActiveScriptModalState {
  title: string;
  subtitle: string;
  script: string;
  filename: string;
  expiresAt?: string;
  isFirstRouter?: boolean;
}

export default function RoutersPage() {
  const { isDemoMode, isLoading: authLoading, user, organization } = useAuth();

  const [viewMode, setViewMode] = useState<RoutersViewMode>("MIKROTIK_BNG");
  const [routers, setRouters] = useState<Router[]>([]);
  const [activeModalScript, setActiveModalScript] = useState<ActiveScriptModalState | null>(null);
  const [copied, setCopied] = useState(false);
  const [testingRouterId, setTestingRouterId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { latency: number; msg: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // First-router / bootstrap modal form state
  const [isBootstrapModalOpen, setIsBootstrapModalOpen] = useState(false);
  const [bootstrapRouterName, setBootstrapRouterName] = useState("");
  const [bootstrapRouterOsVersion, setBootstrapRouterOsVersion] = useState<"v7" | "v6">("v7");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [scriptGenError, setScriptGenError] = useState<string | null>(null);

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
    if (!activeModalScript && !isBootstrapModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveModalScript(null);
        setIsBootstrapModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeModalScript, isBootstrapModalOpen]);

  const handleTestConnection = async (router: Router) => {
    setTestingRouterId(router.id);
    const res = await MikroTikService.testConnection(router, isDemoMode);
    setTestingRouterId(null);
    setTestResults((prev) => ({
      ...prev,
      [router.id]: { latency: res.latencyMs, msg: res.message },
    }));
  };

  /**
   * Generates or retrieves script for an existing router.
   * In Demo mode: generates isolated mock script via RouterScriptGenerator.
   * In Production mode: requests secure server-side script generation via /api/v1/mikrotik-provisioning/bootstrap.
   */
  const handleOpenScriptForExistingRouter = async (router: Router) => {
    setScriptGenError(null);

    if (isDemoMode) {
      const demoScript = RouterScriptGenerator.generateScript({
        routerName: router.name,
        orgName: organization?.name || SEED_ORGANIZATION.name,
        orgSlug: organization?.slug || SEED_ORGANIZATION.slug,
        orgId: organization?.id || SEED_ORGANIZATION.id,
        routerOsVersion: router.routerosVersion?.startsWith("v6") ? "v6" : "v7",
        managementTunnelIp: router.wireguardTunnelIp || "10.200.1.2",
        saasGatewayHost: "vpn.qcnetcore.internal",
        saasGatewayPort: 51820,
        saasPublicKey: "dGVzdC1wdWJsaWMta2V5LWRlbW8tb25seS0xMjM0NTY3ODk=",
        radiusSecret: "DemoRadiusSecret123!",
        radiusAuthPort: 1812,
        radiusAcctPort: 1813,
        hotspotDnsName: "wifi.qcnetcore.local",
      });

      setActiveModalScript({
        title: "RouterOS provisioning script",
        subtitle: `Paste into the MikroTik terminal for ${router.name}.`,
        script: demoScript,
        filename: `qc-netcore-${router.name.replace(/[^A-Za-z0-9._-]+/g, "-")}.rsc`,
        isFirstRouter: false,
      });
      return;
    }

    // Production mode: Server-side bootstrap generation for existing router
    setIsGeneratingScript(true);
    try {
      const res = await fetch("/api/v1/mikrotik-provisioning/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routerId: router.id,
          routerOsVersion: router.routerosVersion?.startsWith("v6") ? "v6" : "v7",
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        setScriptGenError(resData.error || "Failed to generate router provisioning script.");
        return;
      }

      setActiveModalScript({
        title: "RouterOS provisioning script",
        subtitle: `Paste into the MikroTik terminal for ${router.name}.`,
        script: resData.data.script,
        filename: resData.data.filename || `qc-netcore-${router.name}.rsc`,
        expiresAt: resData.data.expiresAt,
        isFirstRouter: false,
      });
    } catch (err) {
      console.error("[Routers] Script request failed:", err);
      setScriptGenError("Network error: Could not contact provisioning service.");
    } finally {
      setIsGeneratingScript(false);
    }
  };

  /**
   * Initiates first-router / zero-touch provisioning modal flow.
   */
  const handleOpenProvisioningAction = () => {
    setScriptGenError(null);
    if (routers.length > 0) {
      // If routers exist, select the first router or let user select
      handleOpenScriptForExistingRouter(routers[0]);
    } else {
      // Empty fleet: open first-router onboarding bootstrap dialog
      setBootstrapRouterName("");
      setBootstrapRouterOsVersion("v7");
      setIsBootstrapModalOpen(true);
    }
  };

  const handleGenerateBootstrapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setScriptGenError(null);
    const trimmedName = bootstrapRouterName.trim();
    if (!trimmedName) {
      setScriptGenError("Please enter a valid router name.");
      return;
    }

    if (isDemoMode) {
      const demoScript = RouterScriptGenerator.generateScript({
        routerName: trimmedName,
        orgName: organization?.name || SEED_ORGANIZATION.name,
        orgSlug: organization?.slug || SEED_ORGANIZATION.slug,
        orgId: organization?.id || SEED_ORGANIZATION.id,
        routerOsVersion: bootstrapRouterOsVersion,
        managementTunnelIp: "10.200.1.2",
        saasGatewayHost: "vpn.qcnetcore.internal",
        saasGatewayPort: 51820,
        saasPublicKey: "dGVzdC1wdWJsaWMta2V5LWRlbW8tb25seS0xMjM0NTY3ODk=",
        radiusSecret: "DemoRadiusSecret123!",
        radiusAuthPort: 1812,
        radiusAcctPort: 1813,
        hotspotDnsName: "wifi.qcnetcore.local",
      });

      setIsBootstrapModalOpen(false);
      setActiveModalScript({
        title: "First router provisioning script",
        subtitle: `Paste into your new MikroTik router's terminal to onboard it to the fleet.`,
        script: demoScript,
        filename: `qc-netcore-${trimmedName.replace(/[^A-Za-z0-9._-]+/g, "-")}.rsc`,
        isFirstRouter: true,
      });
      return;
    }

    setIsGeneratingScript(true);
    try {
      const res = await fetch("/api/v1/mikrotik-provisioning/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routerName: trimmedName,
          routerOsVersion: bootstrapRouterOsVersion,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        setScriptGenError(resData.error || "Failed to generate first-router bootstrap script.");
        return;
      }

      setIsBootstrapModalOpen(false);
      setActiveModalScript({
        title: "First router provisioning script",
        subtitle: `Paste into your new MikroTik router terminal to securely onboard it to the fleet.`,
        script: resData.data.script,
        filename: resData.data.filename || `qc-netcore-${trimmedName}.rsc`,
        expiresAt: resData.data.expiresAt,
        isFirstRouter: true,
      });
    } catch (err) {
      console.error("[Routers] First router bootstrap failed:", err);
      setScriptGenError("Network error: Could not contact provisioning service.");
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleCopyScript = () => {
    if (!activeModalScript) return;
    navigator.clipboard.writeText(activeModalScript.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadScript = () => {
    if (!activeModalScript) return;
    const blob = new Blob([activeModalScript.script], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = activeModalScript.filename || "mikrotik-provisioning.rsc";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
            onClick={handleOpenProvisioningAction}
            disabled={isLoading || isGeneratingScript}
            className={btnClass("primary")}
            aria-label="Open MikroTik provisioning script workflow"
          >
            {isGeneratingScript ? (
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : routers.length === 0 ? (
              <Plus className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Terminal className="h-4 w-4" aria-hidden="true" />
            )}
            Provisioning script
          </button>
        }
      />

      {loadError && <ErrorState title="Could not load routers" detail={loadError} onRetry={fetchRouters} />}
      {scriptGenError && (
        <div className="mb-4">
          <ErrorState
            title="Provisioning Script Error"
            detail={scriptGenError}
            onRetry={() => setScriptGenError(null)}
          />
        </div>
      )}

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
              description="Connect your first MikroTik router to begin monitoring and network provisioning."
              action={
                <button
                  onClick={handleOpenProvisioningAction}
                  disabled={isGeneratingScript}
                  className={btnClass("primary")}
                >
                  <Terminal className="h-4 w-4" aria-hidden="true" />
                  Provisioning script
                </button>
              }
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
                                onClick={() => handleOpenScriptForExistingRouter(router)}
                                disabled={isGeneratingScript}
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

      {/* First-Router / Bootstrap Onboarding Modal */}
      {isBootstrapModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bootstrap-modal-title"
            className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-xl border border-border bg-surface shadow-[var(--shadow-pop)] sm:rounded-lg"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h3 id="bootstrap-modal-title" className="text-base font-semibold">
                  Add MikroTik Router
                </h3>
                <p className="text-sm text-muted-foreground">
                  Generate a zero-touch onboarding script for your first router.
                </p>
              </div>
              <button
                onClick={() => setIsBootstrapModalOpen(false)}
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-elevated"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleGenerateBootstrapSubmit} className="flex flex-col p-4 gap-4">
              {scriptGenError && (
                <div className="rounded-md border border-danger/30 bg-danger-soft p-3 text-xs text-danger flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{scriptGenError}</span>
                </div>
              )}

              <div>
                <label htmlFor="router-name-input" className="block text-xs font-medium text-foreground mb-1">
                  Router Name / Identity *
                </label>
                <input
                  id="router-name-input"
                  type="text"
                  required
                  placeholder="e.g. Core-BNG-01 or Pop-Nairobi-North"
                  value={bootstrapRouterName}
                  onChange={(e) => setBootstrapRouterName(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  autoFocus
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Identifies this router in your fleet monitoring and FreeRADIUS sessions.
                </p>
              </div>

              <div>
                <label htmlFor="routeros-version-select" className="block text-xs font-medium text-foreground mb-1">
                  RouterOS Version
                </label>
                <select
                  id="routeros-version-select"
                  value={bootstrapRouterOsVersion}
                  onChange={(e) => setBootstrapRouterOsVersion(e.target.value as "v7" | "v6")}
                  className="w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="v7">RouterOS v7 (Recommended - WireGuard Tunnel AAA)</option>
                  <option value="v6">RouterOS v6 (Legacy FreeRADIUS & PPPoE)</option>
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  RouterOS v7 automatically configures the encrypted WireGuard management overlay.
                </p>
              </div>

              <div className="rounded-md border border-border bg-surface-subtle p-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Zero-Touch Provisioning:</span> Secrets and management IP allocation are handled securely by QC NetCore server-side. No infrastructure credentials will be exposed.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsBootstrapModalOpen(false)}
                  className={btnClass("secondary")}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGeneratingScript || !bootstrapRouterName.trim()}
                  className={btnClass("primary")}
                >
                  {isGeneratingScript ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Terminal className="h-4 w-4" aria-hidden="true" />
                      Generate script
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Script Viewing Modal (Existing or New Router) */}
      {activeModalScript && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="script-title"
            className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-xl border border-border bg-surface shadow-[var(--shadow-pop)] sm:rounded-lg"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h3 id="script-title" className="text-base font-semibold">
                  {activeModalScript.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {activeModalScript.subtitle}
                </p>
              </div>
              <button
                onClick={() => setActiveModalScript(null)}
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-elevated"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-[14rem] flex-1 overflow-auto bg-surface-subtle p-4 font-mono text-xs leading-5 text-foreground">
              <pre className="whitespace-pre-wrap">{activeModalScript.script}</pre>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-muted-foreground">
                {activeModalScript.isFirstRouter
                  ? "Run this in your MikroTik terminal to connect and register with QC NetCore."
                  : "Configures WireGuard management, RADIUS AAA and payment walled gardens."}
              </span>
              <div className="flex items-center gap-2">
                <button onClick={handleDownloadScript} className={btnClass("secondary")}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download .rsc
                </button>
                <button onClick={handleCopyScript} className={btnClass("primary")}>
                  {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                  {copied ? "Copied" : "Copy script"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
