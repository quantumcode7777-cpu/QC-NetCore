"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import {
  ArrowLeft,
  Building2,
  Power,
  PowerOff,
  Search,
  ShieldAlert,
  Wifi,
  Plug,
  MessageSquare,
  CreditCard,
  Radio,
  ExternalLink,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassBadge } from "@/components/ui/GlassBadge";
import { useAuth } from "@/lib/auth/auth-context";
import { formatKES, formatShortDate } from "@/lib/utils";

interface WorkspaceStats {
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

interface Workspace {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  currency: string;
  sharePct: number;
  isActive: boolean;
  createdAt: string;
  stats: WorkspaceStats;
  customerTotal: number;
  customers: Array<{
    id: string;
    accountNumber: string;
    fullName: string;
    phoneNumber: string;
    status: string;
    balanceDue: number;
    createdAt: string;
  }>;
  routers: Array<{ id: string; name: string; managementIp: string | null; status: string; lastSeenAt: string | null }>;
  plans: Array<{ id: string; name: string; serviceType: string; price: number; isActive: boolean }>;
  users: Array<{ id: string; fullName: string | null; role: string; isActive: boolean; createdAt: string }>;
  portalConfigs: Array<{ id: string; status: string; version: number; updatedAt: string }>;
  recentPayments: Array<{ id: string; amount: number; status: string; createdAt: string }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    year: number;
    month: number;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
    status: string;
    dueDate: string;
  }>;
  integrations: {
    sms: { configured: boolean; sandbox: boolean; username: string | null };
    mpesa: { configured: boolean };
    radius: { configured: boolean };
  };
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-4 rounded-2xl bg-surface border border-border shadow-xs">
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-extrabold text-foreground mt-1">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function SectionTitle({ icon, text, extra }: { icon: React.ReactNode; text: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h4 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
        {icon} {text}
      </h4>
      {extra}
    </div>
  );
}

export default function IspWorkspacePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { isDemoMode, profile } = useAuth();
  const isSuperAdmin = isDemoMode || profile?.role === "super_admin";

  const [ws, setWs] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [actionError, setActionError] = useState("");
  const [acting, setActing] = useState(false);
  const [shareInput, setShareInput] = useState("");
  const [isSavingShare, setIsSavingShare] = useState(false);

  const load = useCallback(
    async (q?: string) => {
      if (isDemoMode) {
        setIsLoading(false);
        return;
      }
      if (q === undefined) setIsLoading(true);
      else setIsSearching(true);
      setError("");
      try {
        const res = await fetch(`/api/v1/admin/isps/${id}${q ? `?search=${encodeURIComponent(q)}` : ""}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok || !json?.success) throw new Error(json?.error || "Could not load the ISP workspace.");
        setWs(json.data as Workspace);
        setShareInput(String((json.data as Workspace).sharePct ?? 3));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load the ISP workspace.");
      } finally {
        setIsLoading(false);
        setIsSearching(false);
      }
    },
    [id, isDemoMode]
  );

  useEffect(() => {
    load();
  }, [load]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(search.trim());
  };

  const setActive = async (isActive: boolean) => {
    if (!ws || acting) return;
    setActing(true);
    setActionError("");
    try {
      const res = await fetch(`/api/v1/admin/isps/${ws.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || json?.message || "Could not update the ISP.");
      setWs({ ...ws, isActive: json.data.isActive });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update the ISP.");
    } finally {
      setActing(false);
    }
  };

  const saveShare = async () => {
    if (!ws || isSavingShare) return;
    setIsSavingShare(true);
    setActionError("");
    try {
      const res = await fetch(`/api/v1/admin/isps/${ws.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revenue_share_pct: Number(shareInput) }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || json?.message || "Could not save the share.");
      setWs({ ...ws, sharePct: json.data.sharePct });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not save the share.");
    } finally {
      setIsSavingShare(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <AppShell title="ISP Workspace">
        <GlassCard>
          <div className="p-10 text-center">
            <ShieldAlert className="w-8 h-8 mx-auto text-amber-500" />
            <h2 className="mt-3 text-base font-extrabold text-foreground">SaaS owner only</h2>
          </div>
        </GlassCard>
      </AppShell>
    );
  }

  return (
    <AppShell title={ws ? ws.name : "ISP Workspace"}>
      <Link
        href="/admin/isps"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition"
      >
        <ArrowLeft className="w-4 h-4" /> All ISPs
      </Link>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading ISP workspace…</p>
      ) : error || !ws ? (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold">
          {error || "ISP not found."}
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                <Building2 className="w-5 h-5 text-primary" />
              </span>
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">{ws.name}</h2>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  /{ws.slug} · {ws.email} · {ws.phone} · since {formatShortDate(ws.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <GlassBadge variant={ws.isActive ? "success" : "neutral"} size="sm">
                <span>{ws.isActive ? "Active" : "Suspended"}</span>
              </GlassBadge>
              <button
                onClick={() => setActive(!ws.isActive)}
                disabled={acting}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition disabled:opacity-60 border ${
                  ws.isActive
                    ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                    : "bg-emerald-600 border-emerald-600 text-white"
                }`}
              >
                {ws.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                <span>{acting ? "Working…" : ws.isActive ? "Suspend" : "Resume"}</span>
              </button>
            </div>
          </div>

          {actionError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold">
              {actionError}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Subscribers" value={String(ws.customerTotal)} sub={`${ws.stats.users} team members`} />
            <Stat
              label="Routers"
              value={String(ws.stats.routers)}
              sub={ws.routers.some((r) => r.status === "ONLINE") ? "Fleet has live nodes" : "No live nodes"}
            />
            <Stat label="Collected revenue" value={formatKES(ws.stats.revenueCompleted)} sub="Completed payments" />
            <Stat
              label="Vouchers"
              value={`${ws.stats.vouchersAvailable} open`}
              sub={`${ws.stats.vouchersUsed} redeemed`}
            />
          </div>

          {/* Customers */}
          <GlassCard>
            <SectionTitle
              icon={<Building2 className="w-3.5 h-3.5" />}
              text={`Customers (${ws.customerTotal})`}
              extra={
                <form onSubmit={onSearch} className="flex items-center gap-1.5">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, phone, account…"
                    className="px-3 py-1.5 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:outline-none focus:border-primary w-52"
                  />
                  <button
                    type="submit"
                    className="p-1.5 rounded-lg hover:bg-surface-elevated text-muted-foreground hover:text-foreground transition"
                    aria-label="Search customers"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </form>
              }
            />
            {isSearching ? (
              <p className="text-xs text-muted-foreground p-2">Searching…</p>
            ) : ws.customers.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">No customers found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-foreground">
                  <thead className="border-b border-border text-[11px] uppercase text-muted-foreground font-bold">
                    <tr>
                      <th className="py-2 px-3">Customer</th>
                      <th className="py-2 px-3">Phone</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ws.customers.map((c) => (
                      <tr key={c.id} className="hover:bg-surface-elevated/40">
                        <td className="py-2.5 px-3">
                          <div className="font-bold">{c.fullName}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{c.accountNumber}</div>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">{c.phoneNumber}</td>
                        <td className="py-2.5 px-3">
                          <GlassBadge variant={c.status === "ACTIVE" ? "success" : "neutral"} size="sm">
                            <span>{c.status}</span>
                          </GlassBadge>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold">{formatKES(c.balanceDue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {ws.customerTotal > ws.customers.length && (
                  <p className="text-[11px] text-muted-foreground p-2">
                    Showing {ws.customers.length} of {ws.customerTotal} — use search to narrow down.
                  </p>
                )}
              </div>
            )}
          </GlassCard>

          {/* Routers */}
          <GlassCard>
            <SectionTitle icon={<Radio className="w-3.5 h-3.5" />} text={`Routers (${ws.routers.length})`} />
            {ws.routers.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">No routers registered for this ISP.</p>
            ) : (
              <ul className="space-y-1.5">
                {ws.routers.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-surface-elevated/50 border border-border text-xs"
                  >
                    <span className="font-bold text-foreground">{r.name}</span>
                    <span className="text-muted-foreground font-mono">
                      {r.managementIp ?? "—"} · {r.status}
                      {r.lastSeenAt ? ` · seen ${formatShortDate(r.lastSeenAt)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>

          {/* Invoices */}
          <GlassCard>
            <SectionTitle
              icon={<CreditCard className="w-3.5 h-3.5" />}
              text={`Platform invoices (${ws.invoices.length})`}
              extra={
                <Link href="/admin/billing" className="text-[11px] font-bold text-primary hover:underline">
                  Open ISP Billing
                </Link>
              }
            />
            {ws.invoices.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">No invoices issued to this ISP yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {ws.invoices.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-surface-elevated/50 border border-border text-xs"
                  >
                    <span className="font-mono font-bold text-foreground">{v.invoiceNumber}</span>
                    <span className="text-muted-foreground">
                      {v.year}-{String(v.month).padStart(2, "0")} · {formatKES(v.totalAmount)} · {v.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>

          {/* Integrations on their behalf */}
          <GlassCard>
            <SectionTitle icon={<Plug className="w-3.5 h-3.5" />} text="Integrations" />
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-surface-elevated/50 border border-border">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Wifi className="w-4 h-4 text-primary" /> Captive portal
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {ws.stats.portalPublished ? "Published design is live." : "No published design yet."}
                </p>
                <a
                  href={`/captive?org=${encodeURIComponent(ws.slug)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline mt-1.5"
                >
                  Preview portal <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="p-3 rounded-xl bg-surface-elevated/50 border border-border">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <MessageSquare className="w-4 h-4 text-primary" /> SMS
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {!ws.integrations.sms.configured
                    ? "Not configured — invoice SMS will fail."
                    : ws.integrations.sms.sandbox
                      ? "Sandbox (test) mode."
                      : "Production sender ready."}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">Platform key — set in Coolify env.</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-elevated/50 border border-border">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <CreditCard className="w-4 h-4 text-primary" /> M-Pesa Daraja
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {ws.integrations.mpesa.configured ? "Credentials present." : "Not configured — STK push disabled."}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">Platform key — set in Coolify env.</p>
              </div>
            </div>
          </GlassCard>

          {/* Platform fee + team */}
          <div className="grid md:grid-cols-2 gap-3">
            <GlassCard>
              <SectionTitle icon={<Building2 className="w-3.5 h-3.5" />} text="Platform fee" />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={shareInput}
                  onChange={(e) => setShareInput(e.target.value)}
                  className="w-24 px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground font-semibold focus:outline-none focus:border-primary"
                />
                <span className="text-xs text-muted-foreground">% of hotspot revenue</span>
                <button
                  onClick={saveShare}
                  disabled={isSavingShare}
                  className="ml-auto px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold transition disabled:opacity-60"
                >
                  {isSavingShare ? "Saving…" : "Save"}
                </button>
              </div>
            </GlassCard>
            <GlassCard>
              <SectionTitle icon={<Building2 className="w-3.5 h-3.5" />} text={`Team (${ws.users.length})`} />
              {ws.users.length === 0 ? (
                <p className="text-xs text-muted-foreground">No operators yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {ws.users.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-surface-elevated/50 border border-border text-xs"
                    >
                      <span className="font-bold text-foreground">{u.fullName ?? "Unnamed"}</span>
                      <span className="text-muted-foreground font-mono">{u.role}</span>
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>
          </div>
        </>
      )}
    </AppShell>
  );
}
