"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  Plus,
  X,
  Send,
  Ban,
  Coins,
  RefreshCw,
  ShieldAlert,
  MessageSquareWarning,
  Receipt,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassBadge } from "@/components/ui/GlassBadge";
import { useAuth } from "@/lib/auth/auth-context";
import { formatKES, formatShortDate } from "@/lib/utils";

interface IspOption {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  currency: string;
  sharePct: number;
  isActive: boolean;
}

interface IspInvoice {
  id: string;
  organizationId: string;
  invoiceNumber: string;
  year: number;
  month: number;
  sharePct: number;
  baseAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
  dueDate: string;
  notes: string | null;
  paymentReference: string | null;
  sentAt: string | null;
  sentTo: string | null;
  paidAt: string | null;
  createdAt: string;
  ispName: string;
  ispSlug: string;
  ispPhone: string;
  hotspotPayments: number;
  voucherFaceValue: number;
  pppoeUsers: number;
  pppoeRateUsd: number;
  fxRate: number;
  customAmount: number;
  customLabel: string | null;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function defaultPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function defaultDue(): string {
  const d = new Date(Date.now() + 14 * 86400000);
  return d.toISOString().slice(0, 10);
}

function statusVariant(status: string): "success" | "primary" | "neutral" {
  if (status === "PAID") return "success";
  if (status === "SENT" || status === "PARTIALLY_PAID") return "primary";
  return "neutral";
}

export default function IspBillingPage() {
  const { isDemoMode, profile } = useAuth();
  const isSuperAdmin = isDemoMode || profile?.role === "super_admin";

  const [invoices, setInvoices] = useState<IspInvoice[]>([]);
  const [isps, setIsps] = useState<IspOption[]>([]);
  const [smsConfigured, setSmsConfigured] = useState(true);
  const [smsSandbox, setSmsSandbox] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  // Create form
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [cIsp, setCIsp] = useState("");
  const [cPeriod, setCPeriod] = useState(defaultPeriod());
  const [cShare, setCShare] = useState("");
  const [cPppoeRate, setCPppoeRate] = useState("0.25");
  const [cFx, setCFx] = useState("129");
  const [cCustom, setCCustom] = useState("");
  const [cCustomLabel, setCCustomLabel] = useState("");
  const [cDue, setCDue] = useState(defaultDue());
  const [cNotes, setCNotes] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Payment form
  const [payId, setPayId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payRef, setPayRef] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState("");

  const load = useCallback(async () => {
    if (isDemoMode) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/admin/billing", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || "Could not load invoices.");
      setInvoices(json.data as IspInvoice[]);
      setIsps(json.isps as IspOption[]);
      setSmsConfigured(Boolean(json.sms?.configured));
      setSmsSandbox(Boolean(json.sms?.sandbox));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load invoices.");
    } finally {
      setIsLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    return invoices
      .filter((i) => i.status !== "VOID")
      .reduce(
        (acc, i) => ({
          outstanding: acc.outstanding + i.balanceDue,
          collected: acc.collected + i.amountPaid,
          overdue:
            acc.overdue +
            (i.balanceDue > 0 && new Date(i.dueDate) < new Date() && i.status !== "PAID" ? 1 : 0),
        }),
        { outstanding: 0, collected: 0, overdue: 0 }
      );
  }, [invoices]);

  const selectedIsp = isps.find((i) => i.id === cIsp);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;
    setIsCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/v1/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: cIsp,
          period: cPeriod,
          sharePct: cShare === "" ? undefined : Number(cShare),
          pppoeRateUsd: Number(cPppoeRate),
          fxRate: Number(cFx),
          customAmount: cCustom === "" ? 0 : Number(cCustom),
          customLabel: cCustomLabel,
          dueDate: cDue,
          notes: cNotes,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || json?.message || "Could not create the invoice.");
      setInvoices((prev) => {
        const next = json.data as IspInvoice;
        if (prev.some((p) => p.id === next.id)) return prev.map((p) => (p.id === next.id ? next : p));
        return [next, ...prev];
      });
      setIsCreateOpen(false);
      setCNotes("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create the invoice.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSend = async (id: string) => {
    setActingId(id);
    setActionError("");
    try {
      const res = await fetch(`/api/v1/admin/billing/${id}/send`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || json?.message || "Could not send the SMS.");
      setInvoices((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: json.status ?? "SENT", sentAt: json.sentAt ?? i.sentAt, sentTo: json.sentTo ?? i.sentTo } : i
        )
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not send the SMS.");
    } finally {
      setActingId(null);
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payId || isPaying) return;
    setIsPaying(true);
    setPayError("");
    try {
      const res = await fetch(`/api/v1/admin/billing/${payId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay", amount: Number(payAmount), reference: payRef }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || json?.message || "Could not record the payment.");
      setInvoices((prev) =>
        prev.map((i) =>
          i.id === payId
            ? { ...i, status: json.data.status, amountPaid: json.data.amountPaid, balanceDue: json.data.balanceDue }
            : i
        )
      );
      setPayId(null);
      setPayAmount("");
      setPayRef("");
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Could not record the payment.");
    } finally {
      setIsPaying(false);
    }
  };

  const handleVoid = async (id: string) => {
    if (!window.confirm("Void this invoice? It can no longer be sent or paid.")) return;
    setActingId(id);
    setActionError("");
    try {
      const res = await fetch(`/api/v1/admin/billing/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "void" }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || json?.message || "Could not void the invoice.");
      setInvoices((prev) => prev.map((i) => (i.id === id ? { ...i, status: "VOID" } : i)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not void the invoice.");
    } finally {
      setActingId(null);
    }
  };

  if (!isSuperAdmin) {
    return (
      <AppShell title="ISP Billing">
        <GlassCard>
          <div className="p-10 text-center">
            <ShieldAlert className="w-8 h-8 mx-auto text-amber-500" />
            <h2 className="mt-3 text-base font-extrabold text-foreground">SaaS owner only</h2>
            <p className="mt-1 text-xs text-muted-foreground">Platform billing is restricted to the SaaS owner.</p>
          </div>
        </GlassCard>
      </AppShell>
    );
  }

  return (
    <AppShell title="ISP Billing">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">ISP Billing</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Revenue-share invoices to ISPs — draft, SMS, track payment.
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
            <span>New invoice</span>
          </button>
        </div>
      </div>

      {!smsConfigured && !isDemoMode && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-semibold">
          <MessageSquareWarning className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            SMS is not configured — invoice SMS will fail until AFRICASTALKING_USERNAME and
            AFRICASTALKING_API_KEY are set on the billing service in Coolify and redeployed.
          </span>
        </div>
      )}
      {smsConfigured && smsSandbox && (
        <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-700 dark:text-sky-400 text-xs font-semibold">
          SMS is in sandbox (test) mode — messages go to the test gateway, not real phones.
        </div>
      )}

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

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-surface border border-border shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Outstanding</div>
          <div className="text-xl font-extrabold text-foreground mt-1">{formatKES(totals.outstanding)}</div>
        </div>
        <div className="p-4 rounded-2xl bg-surface border border-border shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Collected</div>
          <div className="text-xl font-extrabold text-emerald-500 mt-1">{formatKES(totals.collected)}</div>
        </div>
        <div className="p-4 rounded-2xl bg-surface border border-border shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Overdue</div>
          <div className="text-xl font-extrabold text-foreground mt-1">{totals.overdue}</div>
        </div>
      </div>

      <GlassCard>
        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Loading invoices…</div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No invoices yet. Draft the first one to bill an ISP for a month.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-foreground">
              <thead className="border-b border-border text-[11px] uppercase text-muted-foreground font-bold bg-surface-elevated/50">
                <tr>
                  <th className="py-3 px-4">Invoice</th>
                  <th className="py-3 px-4">ISP / Period</th>
                  <th className="py-3 px-4">Lines</th>
                  <th className="py-3 px-4">Paid / Balance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Due</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface-elevated/40 transition">
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-extrabold text-primary tracking-wider bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                        {inv.invoiceNumber}
                      </span>
                      {inv.sentTo && (
                        <div className="text-[10px] text-muted-foreground mt-1">SMS → {inv.sentTo}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold">{inv.ispName}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {MONTH_NAMES[inv.month - 1]} {inv.year}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">
                      <div title={`Payments ${formatKES(inv.hotspotPayments)} + vouchers ${formatKES(inv.voucherFaceValue)}`}>
                        H: {inv.sharePct}% × {formatKES(inv.baseAmount)}
                      </div>
                      <div>
                        P: {inv.pppoeUsers} × ${inv.pppoeRateUsd} × {inv.fxRate}
                      </div>
                      {inv.customAmount > 0 && (
                        <div>
                          C: {formatKES(inv.customAmount)}{inv.customLabel ? ` (${inv.customLabel})` : ""}
                        </div>
                      )}
                      <div className="font-extrabold text-foreground">= {formatKES(inv.totalAmount)}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-emerald-500 font-bold">{formatKES(inv.amountPaid)}</span>
                      {" / "}
                      <span className="font-bold">{formatKES(inv.balanceDue)}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <GlassBadge variant={statusVariant(inv.status)} size="sm">
                        <span>{inv.status.replace("_", " ")}</span>
                      </GlassBadge>
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">{formatShortDate(inv.dueDate)}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {(inv.status === "DRAFT" || inv.status === "SENT") && (
                          <button
                            onClick={() => handleSend(inv.id)}
                            disabled={actingId === inv.id}
                            title={inv.status === "DRAFT" ? "Send invoice SMS" : "Resend invoice SMS"}
                            className="p-2 rounded-lg hover:bg-surface-elevated text-muted-foreground hover:text-foreground transition disabled:opacity-50"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        {inv.status !== "PAID" && inv.status !== "VOID" && (
                          <button
                            onClick={() => {
                              setPayId(inv.id);
                              setPayAmount(String(inv.balanceDue));
                              setPayRef("");
                              setPayError("");
                            }}
                            title="Record payment"
                            className="p-2 rounded-lg hover:bg-surface-elevated text-muted-foreground hover:text-foreground transition"
                          >
                            <Coins className="w-4 h-4" />
                          </button>
                        )}
                        {inv.status !== "PAID" && inv.status !== "VOID" && (
                          <button
                            onClick={() => handleVoid(inv.id)}
                            disabled={actingId === inv.id}
                            title="Void invoice"
                            className="p-2 rounded-lg hover:bg-surface-elevated text-muted-foreground hover:text-foreground transition disabled:opacity-50"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Create modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated/70">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" />
                <h3 className="font-extrabold text-foreground text-base">New ISP invoice</h3>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  ISP *
                </label>
                <select
                  value={cIsp}
                  onChange={(e) => {
                    setCIsp(e.target.value);
                    const isp = isps.find((i) => i.id === e.target.value);
                    if (isp) setCShare(String(isp.sharePct));
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground font-semibold focus:outline-none focus:border-primary"
                >
                  <option value="">Select ISP…</option>
                  {isps.filter((i) => i.isActive).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.sharePct}%)
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Period *
                  </label>
                  <input
                    type="month"
                    value={cPeriod}
                    onChange={(e) => setCPeriod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground font-semibold focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Hotspot share %
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={cShare}
                    onChange={(e) => setCShare(e.target.value)}
                    placeholder="ISP default"
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground font-semibold focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    PPPoE $/user
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={cPppoeRate}
                    onChange={(e) => setCPppoeRate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground font-semibold focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    FX (KES per $)
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={0.5}
                    value={cFx}
                    onChange={(e) => setCFx(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground font-semibold focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Custom (KES)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={cCustom}
                    onChange={(e) => setCCustom(e.target.value)}
                    placeholder="Enterprise / adj."
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground font-semibold focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Custom label
                  </label>
                  <input
                    value={cCustomLabel}
                    onChange={(e) => setCCustomLabel(e.target.value)}
                    placeholder="e.g. Enterprise fee"
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground font-semibold focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Due date *
                </label>
                <input
                  type="date"
                  value={cDue}
                  onChange={(e) => setCDue(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground font-semibold focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Notes
                </label>
                <input
                  value={cNotes}
                  onChange={(e) => setCNotes(e.target.value)}
                  placeholder="Optional memo"
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground font-semibold focus:outline-none focus:border-primary"
                />
              </div>
              {selectedIsp && (
                <p className="text-[11px] text-muted-foreground">
                  Hotspot {cShare || selectedIsp.sharePct}% of hotspot revenue + PPPoE users × ${cPppoeRate} × {cFx}.
                  SMS goes to {selectedIsp.phone} on send.
                </p>
              )}
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
                  disabled={isCreating || !cIsp}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold shadow-brand-btn transition disabled:opacity-60"
                >
                  {isCreating ? "Drafting…" : "Draft invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {payId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated/70">
              <h3 className="font-extrabold text-foreground text-base">Record payment</h3>
              <button onClick={() => setPayId(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handlePay} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Amount (KES) *
                </label>
                <input
                  type="number"
                  min={1}
                  step={0.01}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground font-semibold focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  M-Pesa / bank reference
                </label>
                <input
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. QHX7AB2CDE"
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground font-semibold focus:outline-none focus:border-primary"
                />
              </div>
              {payError && (
                <p className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold">
                  {payError}
                </p>
              )}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPayId(null)}
                  className="px-4 py-2 rounded-xl bg-surface hover:bg-surface-elevated border border-border text-foreground text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPaying}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition disabled:opacity-60"
                >
                  {isPaying ? "Saving…" : "Save payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
