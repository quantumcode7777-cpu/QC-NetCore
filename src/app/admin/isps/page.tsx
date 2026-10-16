"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  Building2,
  Plus,
  X,
  Eye,
  Power,
  PowerOff,
  Users,
  Router as RouterIcon,
  Ticket,
  CreditCard,
  Wifi,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassBadge } from "@/components/ui/GlassBadge";
import { useAuth } from "@/lib/auth/auth-context";
import { formatKES, formatShortDate } from "@/lib/utils";

interface IspStats {
  routers: number;
  customers: number;
  users: number;
  hotspotPlans: number;
  pppoePlans: number;
  vouchersAvailable: number;
  vouchersUsed: number;
  revenueCompleted: number;
  portalPublished: boolean;
}

interface Isp {
  id: string;
  name: string;
  slug: string;
  businessNumber: string | null;
  email: string;
  phone: string;
  currency: string;
  timezone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
  stats: IspStats;
}

interface IspDetail extends Isp {
  routers: Array<{ id: string; name: string; managementIp: string | null; status: string; lastSeenAt: string | null }>;
  plans: Array<{ id: string; name: string; serviceType: string; price: number; isActive: boolean }>;
  users: Array<{ id: string; fullName: string | null; role: string; isActive: boolean; createdAt: string }>;
  portalConfigs: Array<{ id: string; status: string; version: number; updatedAt: string }>;
  recentPayments: Array<{ id: string; amount: number; status: string; createdAt: string }>;
}

const emptyStats: IspStats = {
  routers: 0,
  customers: 0,
  users: 0,
  hotspotPlans: 0,
  pppoePlans: 0,
  vouchersAvailable: 0,
  vouchersUsed: 0,
  revenueCompleted: 0,
  portalPublished: false,
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-4 rounded-2xl bg-surface border border-border shadow-xs">
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-extrabold text-foreground mt-1">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export default function IspManagementPage() {
  const { isDemoMode, profile } = useAuth();
  const isSuperAdmin = isDemoMode || profile?.role === "super_admin";

  const [isps, setIsps] = useState<Isp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IspDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  // Create form
  const [fName, setFName] = useState("");
  const [fSlug, setFSlug] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fCurrency, setFCurrency] = useState("KES");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const load = useCallback(async () => {
    if (isDemoMode) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/admin/isps", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || "Could not load ISPs.");
      setIsps(json.data as Isp[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load ISPs.");
    } finally {
      setIsLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    return isps.reduce(
      (acc, isp) => ({
        routers: acc.routers + isp.stats.routers,
        customers: acc.customers + isp.stats.customers,
        revenue: acc.revenue + isp.stats.revenueCompleted,
        active: acc.active + (isp.isActive ? 1 : 0),
      }),
      { routers: 0, customers: 0, revenue: 0, active: 0 }
    );
  }, [isps]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailError("");
    setIsDetailLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/isps/${id}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || "Could not load ISP details.");
      setDetail(json.data as IspDetail);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Could not load ISP details.");
    } finally {
      setIsDetailLoading(false);
    }
  };

  const setActive = async (id: string, isActive: boolean) => {
    setActingId(id);
    setActionError("");
    try {
      const res = await fetch(`/api/v1/admin/isps/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || "Could not update the ISP.");
      setIsps((prev) => prev.map((i) => (i.id === id ? { ...i, isActive: json.data.isActive } : i)));
      setDetail((prev) => (prev && prev.id === id ? { ...prev, isActive: json.data.isActive } : prev));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update the ISP.");
    } finally {
      setActingId(null);
    }
  };

  const slugify = (name: string) =>
    name
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;
    setIsCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/v1/admin/isps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fName, slug: fSlug || undefined, email: fEmail, phone: fPhone, currency: fCurrency }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || json?.message || "Could not create the ISP.");
      setIsps((prev) => [...prev, { ...json.data, stats: emptyStats }]);
      setFName("");
      setFSlug("");
      setFEmail("");
      setFPhone("");
      setFCurrency("KES");
      setIsCreateOpen(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create the ISP.");
    } finally {
      setIsCreating(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <AppShell title="ISP Management">
        <GlassCard>
          <div className="p-10 text-center">
            <ShieldAlert className="w-8 h-8 mx-auto text-amber-500" />
            <h2 className="mt-3 text-base font-extrabold text-foreground">SaaS owner only</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              ISP management is restricted to the platform owner. ISP operators only see their own organization.
            </p>
          </div>
        </GlassCard>
      </AppShell>
    );
  }

  return (
    <AppShell title="ISP Management">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">Internet Service Providers</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Every tenant on the platform — onboard, inspect, suspend or resume.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface hover:bg-surface-elevated text-foreground text-xs font-bold border border-border transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold shadow-brand-btn transition"
          >
            <Plus className="w-4 h-4" />
            <span>Onboard ISP</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold">
          {error}
        </div>
      )}
      {actionError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold">
          {actionError}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="ISPs" value={String(isps.length)} sub={`${totals.active} active`} />
        <StatCard label="Routers (fleet)" value={String(totals.routers)} sub="All tenants" />
        <StatCard label="Subscribers" value={String(totals.customers)} sub="All tenants" />
        <StatCard label="Revenue collected" value={formatKES(totals.revenue)} sub="Completed, all tenants" />
      </div>

      <GlassCard>
        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Loading ISPs…</div>
        ) : isps.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No ISPs yet. Onboard the first one to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-foreground">
              <thead className="border-b border-border text-[11px] uppercase text-muted-foreground font-bold bg-surface-elevated/50">
                <tr>
                  <th className="py-3 px-4">ISP</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Routers</th>
                  <th className="py-3 px-4">Subs</th>
                  <th className="py-3 px-4">Vouchers</th>
                  <th className="py-3 px-4">Revenue</th>
                  <th className="py-3 px-4">Portal</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isps.map((isp) => (
                  <tr key={isp.id} className="hover:bg-surface-elevated/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                          <Building2 className="w-4 h-4 text-primary" />
                        </span>
                        <div>
                          <div className="font-bold">{isp.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">/{isp.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">
                      <div>{isp.email}</div>
                      <div className="text-[10px]">{isp.phone}</div>
                    </td>
                    <td className="py-3.5 px-4 font-bold">{isp.stats.routers}</td>
                    <td className="py-3.5 px-4 font-bold">{isp.stats.customers}</td>
                    <td className="py-3.5 px-4 text-muted-foreground">
                      <span className="text-emerald-500 font-bold">{isp.stats.vouchersAvailable}</span>
                      {" / "}
                      <span>{isp.stats.vouchersUsed} used</span>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-emerald-500">
                      {formatKES(isp.stats.revenueCompleted)}
                    </td>
                    <td className="py-3.5 px-4">
                      <GlassBadge variant={isp.stats.portalPublished ? "success" : "neutral"} size="sm">
                        <Wifi className="w-3 h-3" />
                        <span>{isp.stats.portalPublished ? "Live" : "None"}</span>
                      </GlassBadge>
                    </td>
                    <td className="py-3.5 px-4">
                      <GlassBadge variant={isp.isActive ? "success" : "neutral"} size="sm">
                        <span>{isp.isActive ? "Active" : "Suspended"}</span>
                      </GlassBadge>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openDetail(isp.id)}
                          title="Inspect ISP"
                          className="p-2 rounded-lg hover:bg-surface-elevated text-muted-foreground hover:text-foreground transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setActive(isp.id, !isp.isActive)}
                          disabled={actingId === isp.id}
                          title={isp.isActive ? "Suspend ISP" : "Resume ISP"}
                          className="p-2 rounded-lg hover:bg-surface-elevated text-muted-foreground hover:text-foreground transition disabled:opacity-50"
                        >
                          {isp.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Detail drawer */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm" onClick={() => setSelectedId(null)}>
          <div
            className="w-full max-w-xl h-full overflow-y-auto bg-surface border-l border-border p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h3 className="font-extrabold text-foreground text-base">
                {detail ? detail.name : "Loading ISP…"}
              </h3>
              <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            {isDetailLoading && <p className="text-xs text-muted-foreground">Loading details…</p>}
            {detailError && (
              <p className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold">
                {detailError}
              </p>
            )}
            {detail && (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <GlassBadge variant={detail.isActive ? "success" : "neutral"} size="sm">
                    <span>{detail.isActive ? "Active" : "Suspended"}</span>
                  </GlassBadge>
                  <span className="text-[11px] text-muted-foreground font-mono">/{detail.slug}</span>
                  <span className="text-[11px] text-muted-foreground">
                    Since {formatShortDate(detail.createdAt)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Routers" value={String(detail.stats.routers)} />
                  <StatCard label="Subscribers" value={String(detail.stats.customers)} />
                  <StatCard label="Team members" value={String(detail.stats.users)} />
                  <StatCard label="Revenue" value={formatKES(detail.stats.revenueCompleted)} />
                </div>

                <section>
                  <h4 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-2">
                    <RouterIcon className="w-3.5 h-3.5" /> Routers ({detail.routers.length})
                  </h4>
                  {detail.routers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No routers registered.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {detail.routers.map((r) => (
                        <li key={r.id} className="flex items-center justify-between p-2.5 rounded-xl bg-surface-elevated/50 border border-border text-xs">
                          <span className="font-bold text-foreground">{r.name}</span>
                          <span className="text-muted-foreground font-mono">{r.managementIp ?? "—"} · {r.status}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <h4 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-2">
                    <Ticket className="w-3.5 h-3.5" /> Packages ({detail.plans.length})
                  </h4>
                  {detail.plans.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No packages defined.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {detail.plans.map((p) => (
                        <li key={p.id} className="flex items-center justify-between p-2.5 rounded-xl bg-surface-elevated/50 border border-border text-xs">
                          <span className="font-bold text-foreground">{p.name}</span>
                          <span className="text-muted-foreground">{p.serviceType} · {formatKES(p.price)}{p.isActive ? "" : " · off"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <h4 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-2">
                    <Users className="w-3.5 h-3.5" /> Team ({detail.users.length})
                  </h4>
                  {detail.users.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No operators yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {detail.users.map((u) => (
                        <li key={u.id} className="flex items-center justify-between p-2.5 rounded-xl bg-surface-elevated/50 border border-border text-xs">
                          <span className="font-bold text-foreground">{u.fullName ?? "Unnamed"}</span>
                          <span className="text-muted-foreground font-mono">{u.role}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <h4 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-2">
                    <CreditCard className="w-3.5 h-3.5" /> Recent payments
                  </h4>
                  {detail.recentPayments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No payments recorded.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {detail.recentPayments.map((p) => (
                        <li key={p.id} className="flex items-center justify-between p-2.5 rounded-xl bg-surface-elevated/50 border border-border text-xs">
                          <span className="font-bold text-foreground">{formatKES(p.amount)}</span>
                          <span className="text-muted-foreground">{p.status} · {formatShortDate(p.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <button
                  onClick={() => setActive(detail.id, !detail.isActive)}
                  disabled={actingId === detail.id}
                  className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-60 ${
                    detail.isActive
                      ? "bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400"
                      : "bg-emerald-600 text-white"
                  }`}
                >
                  {actingId === detail.id
                    ? "Working…"
                    : detail.isActive
                      ? "Suspend ISP (blocks portal + new redemptions)"
                      : "Resume ISP"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Create modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated/70">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <h3 className="font-extrabold text-foreground text-base">Onboard ISP</h3>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Business name *
                </label>
                <input
                  value={fName}
                  onChange={(e) => {
                    setFName(e.target.value);
                    setFSlug((s) => (s === "" || s === slugify(fName) ? slugify(e.target.value) : s));
                  }}
                  placeholder="e.g. Rift Valley Networks"
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground font-semibold focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  URL slug *
                </label>
                <input
                  value={fSlug}
                  onChange={(e) => setFSlug(e.target.value.toLowerCase())}
                  placeholder="rift-valley-networks"
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground font-mono focus:outline-none focus:border-primary"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Portal address: /captive?org={fSlug || "…"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={fEmail}
                    onChange={(e) => setFEmail(e.target.value)}
                    placeholder="ops@example.co.ke"
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground font-semibold focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Phone *
                  </label>
                  <input
                    value={fPhone}
                    onChange={(e) => setFPhone(e.target.value)}
                    placeholder="+2547…"
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground font-semibold focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Currency
                </label>
                <input
                  value={fCurrency}
                  onChange={(e) => setFCurrency(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground font-semibold focus:outline-none focus:border-primary"
                />
              </div>
              {createError && (
                <p className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold">
                  {createError}
                </p>
              )}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface hover:bg-surface-elevated border border-border text-foreground text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold shadow-brand-btn transition disabled:opacity-60"
                >
                  {isCreating ? "Creating…" : "Create ISP"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
