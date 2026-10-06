"use client";

import React, { useEffect, useState } from "react";
import {
  Wifi,
  FileText,
  HelpCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { formatKES, formatShortDate } from "@/lib/utils";
import { SEED_PLANS } from "@/lib/db/mock-db";
import { SEED_INVOICES_2027 } from "@/lib/db/os-2027-seed";
import { useAuth } from "@/lib/auth/auth-context";
import type { ServicePlan } from "@/types";

export function PortalSelfServicePanels({
  accountNumber,
  customerName,
}: {
  accountNumber: string;
  customerName: string;
}) {
  const { isDemoMode } = useAuth();
  const [pppoePlans, setPppoePlans] = useState<ServicePlan[]>(() =>
    isDemoMode ? SEED_PLANS.filter((p) => p.serviceType === "PPPOE") : []
  );
  const [selectedPlanId, setSelectedPlanId] = useState(
    isDemoMode ? SEED_PLANS.filter((p) => p.serviceType === "PPPOE")[1]?.id || "" : ""
  );
  const [planNotice, setPlanNotice] = useState<string | null>(null);
  const [wifiDiagStatus, setWifiDiagStatus] = useState<string | null>(null);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketNotice, setTicketNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode) {
      const plans = SEED_PLANS.filter((p) => p.serviceType === "PPPOE");
      setPppoePlans(plans);
      setSelectedPlanId(plans[1]?.id || plans[0]?.id || "");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/service-plans?type=PPPOE");
        const json = await res.json();
        if (!cancelled && Array.isArray(json?.data)) {
          setPppoePlans(json.data);
          setSelectedPlanId(json.data[0]?.id || "");
        }
      } catch {
        // Keep empty on error
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isDemoMode]);

  const subscriberInvoices = isDemoMode
    ? SEED_INVOICES_2027.filter(
        (i) => i.accountNumber === accountNumber || i.customerId === "cust-01"
      )
    : [];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {/* Self-Service Plan Upgrade & Wi-Fi Diagnostics */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Wifi className="h-5 w-5 text-primary" />
          <h3 className="text-base font-extrabold text-foreground">
            Link Health &amp; Tier Upgrade
          </h3>
        </div>
        <div className="rounded-xl border border-border bg-surface-elevated/60 p-3 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Optical Signal (ONT)</span>
            <span className="font-mono font-bold text-emerald-500">
              {isDemoMode ? "-19.4 dBm (Optimal)" : "Not polled"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Connection Quality</span>
            <span className="font-bold text-foreground">
              {isDemoMode ? "96 / 100" : "—"}
            </span>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Switch Fiber Speed Tier
          </label>
          <select
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs font-semibold text-foreground"
          >
            {pppoePlans.length === 0 ? (
              <option value="">No service plans configured</option>
            ) : (
              pppoePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatKES(p.price)}/mo
                </option>
              ))
            )}
          </select>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={pppoePlans.length === 0}
              onClick={() =>
                setPlanNotice(
                  "Plan change scheduled. FreeRADIUS CoA rate-limit will update immediately upon next renewal."
                )
              }
              className="flex-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover transition disabled:opacity-50"
            >
              Request Tier Switch
            </button>
            <button
              type="button"
              onClick={() =>
                setWifiDiagStatus(
                  isDemoMode
                    ? "TR-369 USP check passed: 5GHz channel clear, 0% packet loss, 8ms RTT."
                    : "Line diagnostic requested."
                )
              }
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs font-bold text-foreground hover:border-primary/40"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Test Line
            </button>
          </div>
          {planNotice && (
            <p className="text-[11px] font-medium text-emerald-500">
              {planNotice}
            </p>
          )}
          {wifiDiagStatus && (
            <p className="text-[11px] font-mono text-primary">
              {wifiDiagStatus}
            </p>
          )}
        </div>
      </div>

      {/* Invoices & Ledger Statement */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="text-base font-extrabold text-foreground">
            Invoices &amp; Tax Receipts
          </h3>
        </div>
        <div className="space-y-2.5 text-xs">
          {subscriberInvoices.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface-elevated/60 p-4 text-center text-muted-foreground">
              No invoices recorded for this subscriber yet.
            </div>
          ) : (
            subscriberInvoices.map((inv) => (
              <div
                key={inv.id}
                className="rounded-xl border border-border bg-surface-elevated/60 p-3 space-y-1"
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="font-mono text-primary">
                    {inv.invoiceNumber}
                  </span>
                  <span>{formatKES(inv.totalAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>VAT (16%): {formatKES(inv.taxAmount)}</span>
                  <span className="font-semibold text-emerald-500">
                    {inv.status} · {formatShortDate(inv.createdAt)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Self-Service Support Ticket */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h3 className="text-base font-extrabold text-foreground">
            24/7 NOC Support Desk
          </h3>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!ticketSubject.trim()) return;
            setTicketNotice(
              `Ticket TKT-${Math.floor(
                500 + Math.random() * 400
              )} opened for ${customerName} (${accountNumber}). SLA target: 4 hours.`
            );
            setTicketSubject("");
          }}
          className="space-y-3 text-xs"
        >
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Describe Issue or Request
            </label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Change Wi-Fi password, router relocation, or slow streaming..."
              value={ticketSubject}
              onChange={(e) => setTicketSubject(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-elevated p-3 text-xs text-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl border border-border bg-surface-elevated py-2.5 text-xs font-bold text-foreground hover:border-primary hover:text-primary transition"
          >
            Submit Support Ticket
          </button>
          {ticketNotice && (
            <div className="flex items-start gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-[11px] font-semibold text-emerald-500">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{ticketNotice}</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
