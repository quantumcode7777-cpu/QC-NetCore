"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  Router as RouterIcon,
  Users,
  Wifi,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, btnClass } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { useAuth } from "@/lib/auth/auth-context";
import { getSeedSitesData } from "@/lib/db/mock-db";
import { formatCoordinates, summarizeSites, type PowerBackupType, type SiteSummary } from "@/lib/sites";
import { cn } from "@/lib/utils";

const POWER_OPTIONS: Array<{ value: PowerBackupType | ""; label: string }> = [
  { value: "", label: "None" },
  { value: "UPS", label: "UPS" },
  { value: "SOLAR", label: "Solar" },
  { value: "GENERATOR", label: "Generator" },
  { value: "GRID", label: "Grid" },
];

const inputClass =
  "w-full rounded-md border border-border bg-surface-subtle px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";

export default function SitesPage() {
  const { isDemoMode } = useAuth();
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    locationDescription: "",
    latitude: "",
    longitude: "",
    powerBackupType: "" as PowerBackupType | "",
    isActive: true,
  });

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    if (isDemoMode) {
      const seed = getSeedSitesData();
      setSites(summarizeSites(seed.sites, seed.routers, seed.customers, seed.accessPoints));
      setWarnings([]);
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/v1/sites");
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Could not load sites.");
      setSites(json.data ?? []);
      setWarnings(json.warnings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load sites.");
    } finally {
      setIsLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () =>
      sites.reduce(
        (acc, s) => ({
          routers: acc.routers + s.routerCount,
          customers: acc.customers + s.customerCount,
          accessPoints: acc.accessPoints + s.accessPointCount,
        }),
        { routers: 0, customers: 0, accessPoints: 0 }
      ),
    [sites]
  );

  const createSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/v1/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          locationDescription: form.locationDescription,
          latitude: form.latitude === "" ? null : Number(form.latitude),
          longitude: form.longitude === "" ? null : Number(form.longitude),
          powerBackupType: form.powerBackupType || null,
          isActive: form.isActive,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Could not create the site.");
      setForm({ name: "", locationDescription: "", latitude: "", longitude: "", powerBackupType: "", isActive: true });
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create the site.");
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (site: SiteSummary) => {
    if (!window.confirm(`Deactivate "${site.name}"? Routers and customers will be kept.`)) return;
    try {
      const res = await fetch(`/api/v1/sites/${encodeURIComponent(site.id)}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Could not deactivate the site.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not deactivate the site.");
    }
  };

  return (
    <AppShell title="Network Sites">
      <PageHeader
        title="Network Sites"
        description="Points of presence, coverage, and the equipment at each location"
        actions={
          <>
            <button type="button" onClick={() => void load()} disabled={isLoading} className={btnClass("secondary")}>
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} aria-hidden="true" />
              Refresh
            </button>
            <button type="button" onClick={() => setFormOpen((v) => !v)} className={btnClass("primary")}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add site
            </button>
          </>
        }
      />

      {error && <ErrorState title="Sites could not be loaded" detail={error} onRetry={() => void load()} />}
      {warnings.length > 0 && (
        <p role="status" className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {warnings.join("; ")}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Sites", value: sites.length, icon: MapPin },
          { label: "Routers", value: totals.routers, icon: RouterIcon },
          { label: "Subscribers", value: totals.customers, icon: Users },
          { label: "Access points", value: totals.accessPoints, icon: Wifi },
        ].map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="rounded-lg border border-border bg-surface p-3 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {m.label}
              </div>
              <div className="tabular mt-1 text-xl font-semibold">{m.value}</div>
            </div>
          );
        })}
      </div>

      {formOpen && (
        <form onSubmit={createSite} className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-xs">
          <h2 className="text-sm font-semibold">New site</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Site name</span>
              <input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Kilimani Tower POP" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Location</span>
              <input className={inputClass} value={form.locationDescription} onChange={(e) => setForm({ ...form, locationDescription: e.target.value })} placeholder="Street / building / mast" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Latitude</span>
              <input className={inputClass} inputMode="decimal" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="-1.286389" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Longitude</span>
              <input className={inputClass} inputMode="decimal" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="36.817223" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Power backup</span>
              <select className={inputClass} value={form.powerBackupType} onChange={(e) => setForm({ ...form, powerBackupType: e.target.value as PowerBackupType | "" })}>
                {POWER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-2 pb-1.5 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active site
            </label>
          </div>
          {formError && <p role="alert" className="text-xs text-danger">{formError}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className={btnClass("primary")}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
              Save site
            </button>
            <button type="button" onClick={() => setFormOpen(false)} className={btnClass("secondary")}>Cancel</button>
          </div>
        </form>
      )}

      {isLoading && !sites.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : sites.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No network sites yet"
          description="Add a POP to group routers, subscribers, and access points by physical location."
          action={<button type="button" onClick={() => setFormOpen(true)} className={btnClass("primary")}>Add site</button>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sites.map((site) => (
            <section key={site.id} className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">{site.name}</h3>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{site.locationDescription || "No location description"}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    site.isActive === false
                      ? "border-border bg-surface-subtle text-muted-foreground"
                      : "border-success/30 bg-success/10 text-success"
                  )}
                >
                  {site.isActive === false ? "Inactive" : "Active"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md border border-border bg-surface-subtle/50 p-2">
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><RouterIcon className="h-3 w-3" aria-hidden="true" />Routers</div>
                  <div className="tabular mt-0.5 font-semibold">{site.onlineRouters}/{site.routerCount}</div>
                </div>
                <div className="rounded-md border border-border bg-surface-subtle/50 p-2">
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Users className="h-3 w-3" aria-hidden="true" />Active subs</div>
                  <div className="tabular mt-0.5 font-semibold">{site.activeCustomers}/{site.customerCount}</div>
                </div>
                <div className="rounded-md border border-border bg-surface-subtle/50 p-2">
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Wifi className="h-3 w-3" aria-hidden="true" />APs</div>
                  <div className="tabular mt-0.5 font-semibold">{site.accessPointCount}</div>
                </div>
              </div>

              <div className="space-y-1 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5"><Navigation className="h-3 w-3" aria-hidden="true" />{formatCoordinates(site.latitude, site.longitude)}</div>
                <div className="flex items-center gap-1.5"><Zap className="h-3 w-3" aria-hidden="true" />Power: {site.powerBackupType || "Not recorded"}</div>
              </div>

              {site.isActive !== false && (
                <button type="button" onClick={() => void deactivate(site)} className="text-[11px] font-medium text-muted-foreground hover:text-danger">
                  Deactivate site
                </button>
              )}
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
