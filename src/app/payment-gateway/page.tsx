"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Inbox, Loader2, Radio, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, btnClass } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";

interface GatewayView {
  organizationId: string;
  provider: string;
  environment: "sandbox" | "production";
  shortcode: string;
  callbackUrl: string;
  confirmationUrl: string;
  validationUrl: string;
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  isEnabled: boolean;
  c2bRegisteredAt?: string | null;
  source?: "organization" | "platform" | "none";
  missing?: string[];
  canEdit?: boolean;
}

interface Unmatched {
  id: string;
  transactionReference: string;
  providerReceipt?: string | null;
  amount: number;
  paymentMethod: string;
  msisdnPhone: string;
  senderName?: string | null;
  accountReference?: string | null;
  customerName?: string | null;
  suggestedCustomerId?: string;
  suggestedCustomerName?: string;
  suggestedInvoiceId?: string;
  matchBy?: string;
  matchConfidence?: number;
  note?: string;
  createdAt: string;
}

interface CustomerOption { id: string; label: string }
interface InvoiceOption { id: string; customerId: string; label: string }

const inputClass =
  "w-full rounded-md border border-border bg-surface-subtle px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";

const blank: GatewayView = {
  organizationId: "",
  provider: "MPESA_DARAJA",
  environment: "sandbox",
  shortcode: "",
  callbackUrl: "/api/v1/mpesa-callback",
  confirmationUrl: "/api/v1/mpesa-c2b/confirmation",
  validationUrl: "/api/v1/mpesa-c2b/validation",
  consumerKey: "",
  consumerSecret: "",
  passkey: "",
  isEnabled: false,
  source: "none",
};

export default function PaymentGatewayPage() {
  const { isDemoMode } = useAuth();
  const [gateway, setGateway] = useState<GatewayView | null>(null);
  const [unmatched, setUnmatched] = useState<Unmatched[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [gwRes, unmatchedRes] = await Promise.all([
        fetch("/api/v1/payment-gateway", { cache: "no-store" }),
        fetch("/api/v1/payment-gateway/unmatched", { cache: "no-store" }),
      ]);
      const gwJson = await gwRes.json().catch(() => null);
      const unmatchedJson = await unmatchedRes.json().catch(() => null);
      if (!gwRes.ok || !gwJson?.success) throw new Error(gwJson?.error || "Could not load gateway settings.");
      setGateway(gwJson.data ?? blank);
      if (!unmatchedRes.ok || !unmatchedJson?.success) {
        setWarning(unmatchedJson?.error || "Could not load the unmatched payments inbox.");
      } else {
        setUnmatched(unmatchedJson.data ?? []);
        setCustomers(unmatchedJson.customers ?? []);
        setInvoices(unmatchedJson.invoices ?? []);
        setWarning(unmatchedJson.warnings?.join("; ") ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load payment gateway settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = (patch: Partial<GatewayView>) =>
    setGateway((prev) => ({ ...(prev ?? blank), ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gateway) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/v1/payment-gateway", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: gateway.environment,
          shortcode: gateway.shortcode,
          callbackUrl: gateway.callbackUrl,
          confirmationUrl: gateway.confirmationUrl,
          validationUrl: gateway.validationUrl,
          consumerKey: gateway.consumerKey,
          consumerSecret: gateway.consumerSecret,
          passkey: gateway.passkey,
          isEnabled: gateway.isEnabled,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Could not save gateway settings.");
      setGateway((prev) => ({
        ...(prev ?? blank),
        ...json.data,
        source: "organization",
        missing: [],
      }));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save gateway settings.");
    } finally {
      setSaving(false);
    }
  };

  const registerC2B = async () => {
    setRegistering(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/payment-gateway/c2b/register", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "C2B registration failed.");
      setGateway((prev) => (prev ? { ...prev, c2bRegisteredAt: new Date().toISOString() } : prev));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "C2B registration failed.");
    } finally {
      setRegistering(false);
    }
  };

  const resolve = async (payment: Unmatched, customerId: string, invoiceId: string) => {
    if (!customerId && !invoiceId) return;
    try {
      const res = await fetch("/api/v1/payment-gateway/unmatched", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: payment.id, customerId: customerId || null, invoiceId: invoiceId || null }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Could not reconcile the payment.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reconcile the payment.");
    }
  };

  const status = useMemo(() => {
    if (!gateway) return "Loading";
    if (gateway.source === "organization" && gateway.isEnabled) return "ISP gateway active";
    if (gateway.source === "platform") return "Platform fallback";
    return "Not configured";
  }, [gateway]);

  return (
    <AppShell title="Payment Gateway">
      <PageHeader
        title="Payment Gateway"
        description="M-Pesa Daraja credentials, C2B callbacks, and the unmatched payments queue"
        actions={
          <button type="button" onClick={() => void load()} disabled={loading} className={btnClass("secondary")}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      {isDemoMode && (
        <p role="status" className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          Demo mode: credentials are read-only and no Daraja request will be sent.
        </p>
      )}
      {error && <ErrorState title="Payment gateway error" detail={error} onRetry={() => void load()} />}
      {warning && <p role="status" className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">{warning}</p>}

      {loading && !gateway ? (
        <Skeleton className="h-96" />
      ) : (
        <form onSubmit={save} className="space-y-4">
          <section className="rounded-lg border border-border bg-surface p-4 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-semibold">M-Pesa Daraja configuration</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Credentials are encrypted server-side with APP_ENCRYPTION_KEY and never returned to the browser.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                <span className="font-medium">{status}</span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Environment</span>
                <select
                  className={inputClass}
                  value={gateway?.environment ?? "sandbox"}
                  onChange={(e) => update({ environment: e.target.value as "sandbox" | "production" })}
                >
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Production</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Paybill / Till shortcode</span>
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={gateway?.shortcode ?? ""}
                  onChange={(e) => update({ shortcode: e.target.value })}
                  placeholder="174379"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Consumer key</span>
                <input
                  type="password"
                  className={inputClass}
                  value={gateway?.consumerKey ?? ""}
                  onChange={(e) => update({ consumerKey: e.target.value })}
                  placeholder="••••••••"
                  autoComplete="off"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Consumer secret</span>
                <input
                  type="password"
                  className={inputClass}
                  value={gateway?.consumerSecret ?? ""}
                  onChange={(e) => update({ consumerSecret: e.target.value })}
                  placeholder="••••••••"
                  autoComplete="off"
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-medium text-muted-foreground">Passkey</span>
                <input
                  type="password"
                  className={inputClass}
                  value={gateway?.passkey ?? ""}
                  onChange={(e) => update({ passkey: e.target.value })}
                  placeholder="••••••••"
                  autoComplete="off"
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-medium text-muted-foreground">STK callback URL</span>
                <input className={inputClass} value={gateway?.callbackUrl ?? ""} onChange={(e) => update({ callbackUrl: e.target.value })} />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">C2B confirmation URL</span>
                <input className={inputClass} value={gateway?.confirmationUrl ?? ""} onChange={(e) => update({ confirmationUrl: e.target.value })} />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">C2B validation URL</span>
                <input className={inputClass} value={gateway?.validationUrl ?? ""} onChange={(e) => update({ validationUrl: e.target.value })} />
              </label>
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input
                  type="checkbox"
                  checked={gateway?.isEnabled ?? false}
                  onChange={(e) => update({ isEnabled: e.target.checked })}
                />
                Enable this ISP gateway
              </label>
            </div>

            {gateway?.missing && gateway.missing.length > 0 && gateway.source !== "organization" && (
              <p className="mt-3 text-xs text-warning">Missing: {gateway.missing.join(", ")}</p>
            )}
            {saved && <p className="mt-3 flex items-center gap-1 text-xs text-success"><Check className="h-3.5 w-3.5" aria-hidden="true" />Saved.</p>}

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="submit" disabled={saving || isDemoMode || gateway?.canEdit === false} className={btnClass("primary")}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                Save gateway
              </button>
              <button
                type="button"
                onClick={() => void registerC2B()}
                disabled={registering || isDemoMode || gateway?.canEdit === false}
                className={btnClass("secondary")}
              >
                {registering ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Radio className="h-4 w-4" aria-hidden="true" />}
                Register C2B URLs
              </button>
            </div>
            {gateway?.c2bRegisteredAt && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Last registered: {new Date(gateway.c2bRegisteredAt).toLocaleString()}
              </p>
            )}
          </section>
        </form>
      )}

      <section className="mt-4 rounded-lg border border-border bg-surface shadow-xs">
        <header className="border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Inbox className="h-4 w-4 text-primary" aria-hidden="true" />
            Unmatched payments
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Confirmed M-Pesa collections without an invoice. Suggestions are checks, not automatic postings.
          </p>
        </header>

        {unmatched.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No unmatched payments"
            description="M-Pesa collections that cannot be linked to an invoice will appear here for manual review."
            className="py-8"
          />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {unmatched.map((payment) => (
              <UnmatchedRow
                key={payment.id}
                payment={payment}
                customers={customers}
                invoices={invoices}
                disabled={isDemoMode}
                onResolve={resolve}
              />
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}

function UnmatchedRow({
  payment,
  customers,
  invoices,
  disabled,
  onResolve,
}: {
  payment: Unmatched;
  customers: CustomerOption[];
  invoices: InvoiceOption[];
  disabled: boolean;
  onResolve: (payment: Unmatched, customerId: string, invoiceId: string) => Promise<void>;
}) {
  const [customerId, setCustomerId] = useState(payment.suggestedCustomerId ?? "");
  const [invoiceId, setInvoiceId] = useState(payment.suggestedInvoiceId ?? "");
  const [busy, setBusy] = useState(false);

  const availableInvoices = invoices.filter((i) => !customerId || i.customerId === customerId);

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold">{payment.providerReceipt || payment.transactionReference}</span>
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">{payment.paymentMethod}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            KES {payment.amount.toFixed(2)} · {payment.msisdnPhone}
            {payment.customerName ? ` · ${payment.customerName}` : ""}
            {payment.accountReference ? ` · ref ${payment.accountReference}` : ""}
          </p>
          {payment.suggestedCustomerName && (
            <p className="mt-0.5 text-[11px] text-success">
              Suggested: {payment.suggestedCustomerName} ({payment.matchConfidence ?? 0}% via {payment.matchBy?.replaceAll("_", " ").toLowerCase() || "match"})
            </p>
          )}
          {payment.note && <p className="mt-0.5 text-[11px] text-muted-foreground">{payment.note}</p>}
        </div>
        <span className="text-[11px] text-muted-foreground">{new Date(payment.createdAt).toLocaleString()}</span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-52 flex-1 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">Customer</span>
          <select
            className={inputClass}
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setInvoiceId("");
            }}
          >
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="min-w-52 flex-1 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">Invoice (optional)</span>
          <select className={inputClass} value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
            <option value="">Link to customer only</option>
            {availableInvoices.map((i) => (
              <option key={i.id} value={i.id}>{i.label}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={disabled || busy || (!customerId && !invoiceId)}
          onClick={async () => {
            setBusy(true);
            await onResolve(payment, customerId, invoiceId);
            setBusy(false);
          }}
          className={btnClass("secondary")}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
          Link payment
        </button>
      </div>
    </li>
  );
}
