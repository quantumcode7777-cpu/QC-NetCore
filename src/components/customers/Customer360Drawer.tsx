"use client";

import React, { useState } from "react";
import {
  X,
  Activity,
  Radio,
  CreditCard,
  Send,
  RefreshCw,
  CheckCircle2,
  Wifi,
  Terminal,
} from "lucide-react";
import { Customer } from "@/types";
import { cn, formatKES, formatShortDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { btnClass } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth/auth-context";
import { buildCustomer360Dossier } from "@/lib/db/os-2027-seed";
import {
  classifyOpticalPower,
  buildSubscriberControlCommand,
} from "@/lib/network/olt-cpe";
import {
  DEFAULT_NOTIFICATION_TEMPLATES,
  buildNotificationDispatch,
  NotificationDispatchLog,
} from "@/lib/communications/notifier";
import { formatPhoneForDisplay } from "@/lib/sms/phone";

interface Customer360DrawerProps {
  customer: Customer | null;
  onClose: () => void;
  onToggleSuspend?: (customerId: string) => void;
}

type DrawerTab = "OVERVIEW" | "NETWORK_ONT" | "LEDGER" | "COMMUNICATIONS";

export function Customer360Drawer({
  customer,
  onClose,
  onToggleSuspend,
}: Customer360DrawerProps) {
  const { isDemoMode } = useAuth();
  const [activeTab, setActiveTab] = useState<DrawerTab>("OVERVIEW");
  const [controlOutput, setControlOutput] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    DEFAULT_NOTIFICATION_TEMPLATES[0].id
  );
  const [sentLogs, setSentLogs] = useState<NotificationDispatchLog[]>([]);

  if (!customer) return null;

  const dossier = isDemoMode ? buildCustomer360Dossier(customer.id) : null;
  const rxDbm = dossier?.ont?.rxPowerDbm ?? null;
  const opticalHealth = rxDbm !== null ? classifyOpticalPower(rxDbm) : null;

  const handleRunControlCommand = (
    action: "DISCONNECT_SESSION" | "COA_RATE_LIMIT" | "REBOOT_ONT" | "PROVISION_ONT_VLAN"
  ) => {
    if (!isDemoMode && !dossier?.pppoe && !dossier?.ont) {
      setControlOutput("No active NAS router or OLT session bound to this subscriber.");
      return;
    }
    const cmd = buildSubscriberControlCommand({
      action,
      username: dossier?.pppoe?.username || customer.accountNumber.toLowerCase(),
      nasIpAddress: "10.200.1.2",
      framedIpAddress: dossier?.pppoe?.currentIp || "0.0.0.0",
      rateLimit: "10M/20M",
      ontSerial: dossier?.ont?.serialNumber || "UNASSIGNED",
      ponPortLabel: dossier?.ont?.ponPortLabel || "UNASSIGNED",
      vlanId: dossier?.ont?.serviceVlan || 100,
    });
    setControlOutput(`[${cmd.protocol}] ${cmd.summary}\n$ ${cmd.commandPayload}`);
  };

  const handleDispatchNotice = (e: React.FormEvent) => {
    e.preventDefault();
    const tpl =
      DEFAULT_NOTIFICATION_TEMPLATES.find((t) => t.id === selectedTemplateId) ||
      DEFAULT_NOTIFICATION_TEMPLATES[0];
    const log = buildNotificationDispatch({
      template: tpl,
      recipient: customer.phoneNumber,
      customerId: customer.id,
      customerName: customer.fullName,
      variables: {
        customer_name: customer.fullName,
        account_number: customer.accountNumber,
        amount: customer.balanceDue.toLocaleString(),
        reference: "N/A",
        plan_name: dossier?.subscription?.planName || "Active Plan",
        expiry_date: dossier?.subscription?.endTime
          ? formatShortDate(dossier.subscription.endTime)
          : "—",
        paybill: "—",
        support_phone: "—",
        site_name: customer.siteName || "—",
        eta: "—",
      },
    });
    setSentLogs((prev) => [log, ...prev]);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={`Subscriber 360 View — ${customer.fullName}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-border bg-surface text-foreground shadow-[var(--shadow-pop)]">
        {/* Top Header */}
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded border border-primary/30 bg-primary-soft px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                {customer.accountNumber}
              </span>
              <StatusBadge status={customer.status} />
              <span className="text-xs text-muted-foreground">
                Customer 360° Command View
              </span>
            </div>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              {customer.fullName}
            </h2>
            <p className="text-xs text-muted-foreground">
              {customer.physicalAddress || customer.siteName || "Address not set"} ·{" "}
              <span className="font-mono font-semibold text-foreground">
                {formatPhoneForDisplay(customer.phoneNumber)}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onToggleSuspend && (
              <button
                type="button"
                onClick={() => onToggleSuspend(customer.id)}
                className={btnClass("secondary", "h-8 px-2.5 text-xs")}
              >
                {customer.status === "ACTIVE" ? "Suspend Service" : "Reactivate Service"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Subscriber 360 drawer"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-elevated"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Sub-navigation Tabs */}
        <div className="flex gap-1 border-b border-border bg-surface-subtle px-5 pt-2">
          {(
            [
              { id: "OVERVIEW", label: "360° Intelligence", icon: Activity },
              { id: "NETWORK_ONT", label: "PPPoE, OLT & ONT", icon: Radio },
              { id: "LEDGER", label: "Ledger & Billing", icon: CreditCard },
              { id: "COMMUNICATIONS", label: "SMS & WhatsApp", icon: Send },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
          {activeTab === "OVERVIEW" && (
            <>
              {dossier && (
                <>
                  {/* QoE & Churn Intelligence Cards */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-border bg-surface-subtle p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          Connection Quality Score (QoE)
                        </span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[11px] font-semibold",
                            dossier.quality.score >= 80
                              ? "bg-success-soft text-success"
                              : dossier.quality.score >= 60
                              ? "bg-warning-soft text-warning"
                              : "bg-danger-soft text-danger"
                          )}
                        >
                          {dossier.quality.tier}
                        </span>
                      </div>
                      <div className="tabular mt-1 text-2xl font-bold">
                        {dossier.quality.score}
                        <span className="text-sm font-normal text-muted-foreground">/100</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {dossier.quality.summary}
                      </p>
                    </div>

                    <div className="rounded-lg border border-border bg-surface-subtle p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          Predictive Churn Risk
                        </span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[11px] font-semibold",
                            dossier.churn.riskTier === "LOW"
                              ? "bg-success-soft text-success"
                              : dossier.churn.riskTier === "MODERATE"
                              ? "bg-warning-soft text-warning"
                              : "bg-danger-soft text-danger"
                          )}
                        >
                          {dossier.churn.riskTier} RISK
                        </span>
                      </div>
                      <div className="tabular mt-1 text-2xl font-bold">
                        {dossier.churn.riskScore}
                        <span className="text-sm font-normal text-muted-foreground">%</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {dossier.churn.primaryDrivers.join(" · ")}
                      </p>
                    </div>
                  </div>

                  {/* Next-Best Action Recommendation */}
                  <div className="rounded-lg border border-primary/25 bg-primary-soft p-3.5 text-xs">
                    <div className="font-semibold text-primary">
                      Recommended Operator Action
                    </div>
                    <p className="mt-0.5 text-foreground">
                      {dossier.churn.recommendedAction}
                    </p>
                  </div>
                </>
              )}

              {/* Service & Account Summary */}
              <div className="rounded-lg border border-border bg-surface p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Subscription &amp; Network Summary
                </h3>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd className="mt-0.5 font-mono font-semibold text-foreground">
                      {formatPhoneForDisplay(customer.phoneNumber)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Service</dt>
                    <dd className="mt-0.5 font-semibold text-foreground">
                      {dossier?.pppoe ? "PPPoE" : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Package</dt>
                    <dd className="mt-0.5 font-semibold text-foreground">
                      {dossier?.subscription?.planName || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Balance Due</dt>
                    <dd
                      className={cn(
                        "tabular mt-0.5 font-semibold",
                        customer.balanceDue > 0 ? "text-danger" : "text-success"
                      )}
                    >
                      {formatKES(customer.balanceDue)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Renewal Date</dt>
                    <dd className="mt-0.5 font-medium text-foreground">
                      {dossier?.subscription?.endTime
                        ? formatShortDate(dossier.subscription.endTime)
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">PPPoE Username</dt>
                    <dd className="mt-0.5 font-mono text-foreground">
                      {dossier?.pppoe?.username || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Framed WAN IP</dt>
                    <dd className="mt-0.5 font-mono text-foreground">
                      {dossier?.pppoe?.currentIp || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">ONT Optical RX</dt>
                    <dd className="mt-0.5 font-mono font-semibold text-foreground">
                      {rxDbm !== null && opticalHealth
                        ? `${rxDbm.toFixed(1)} dBm (${opticalHealth.status})`
                        : "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            </>
          )}

          {activeTab === "NETWORK_ONT" && (
            <div className="space-y-4">
              {dossier?.ont && opticalHealth && rxDbm !== null ? (
                <div className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">
                        FTTH GPON ONT &amp; TR-369 USP Telemetry
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {dossier.ont.vendorModel} · Serial{" "}
                        <span className="font-mono font-semibold text-foreground">
                          {dossier.ont.serialNumber}
                        </span>
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-semibold",
                        opticalHealth.badgeTone === "success"
                          ? "bg-success-soft text-success"
                          : opticalHealth.badgeTone === "warning"
                          ? "bg-warning-soft text-warning"
                          : "bg-danger-soft text-danger"
                      )}
                    >
                      {opticalHealth.label}
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs sm:grid-cols-4">
                    <div>
                      <dt className="text-muted-foreground">OLT PON Port</dt>
                      <dd className="mt-0.5 font-mono font-semibold">
                        {dossier.ont.ponPortLabel}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">ONU RX / TX</dt>
                      <dd className="mt-0.5 font-mono font-semibold">
                        {rxDbm.toFixed(1)} / {dossier.ont.txPowerDbm.toFixed(1)} dBm
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Fiber Distance</dt>
                      <dd className="mt-0.5 font-mono">
                        {dossier.ont.distanceMeters} m (VLAN{" "}
                        {dossier.ont.serviceVlan})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Wi-Fi SSID / Hosts</dt>
                      <dd className="mt-0.5 font-mono">
                        {dossier.ont.wifiSsid || "—"} ({dossier.ont.connectedClients})
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 rounded border border-border bg-surface-subtle p-2.5 text-xs text-muted-foreground">
                    <Wifi className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
                    {opticalHealth.recommendation}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-surface p-6 text-center text-xs text-muted-foreground">
                  No ONT optical telemetry or active PPPoE session bound to this subscriber yet.
                </div>
              )}

              {/* Remote Control Actions */}
              <div className="rounded-lg border border-border bg-surface p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Live Control-Plane Actions (FreeRADIUS CoA &amp; OLT OMCI)
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleRunControlCommand("DISCONNECT_SESSION")}
                    className={btnClass("secondary", "h-8 text-xs")}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reset PPPoE Session (CoA)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunControlCommand("COA_RATE_LIMIT")}
                    className={btnClass("secondary", "h-8 text-xs")}
                  >
                    <Activity className="h-3.5 w-3.5" />
                    Push Live Speed Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunControlCommand("REBOOT_ONT")}
                    className={btnClass("secondary", "h-8 text-xs")}
                  >
                    <Terminal className="h-3.5 w-3.5" />
                    Reboot ONT via OMCI
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunControlCommand("PROVISION_ONT_VLAN")}
                    className={btnClass("secondary", "h-8 text-xs")}
                  >
                    Re-Bind Service VLAN
                  </button>
                </div>

                {controlOutput && (
                  <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-surface-subtle p-3 font-mono text-xs text-foreground">
                    {controlOutput}
                  </pre>
                )}
              </div>
            </div>
          )}

          {activeTab === "LEDGER" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    Subscriber Double-Entry Ledger Statement
                  </h3>
                  <span className="font-mono text-xs text-muted-foreground">
                    AR Balance: {formatKES(customer.balanceDue)}
                  </span>
                </div>

                {(dossier?.journalEntries ?? []).length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    No posted journal entries for this subscriber yet.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2.5">
                    {(dossier?.journalEntries ?? []).map((je) => (
                      <div
                        key={je.id}
                        className="rounded-md border border-border bg-surface-subtle p-3 text-xs"
                      >
                        <div className="flex items-center justify-between font-medium">
                          <span>
                            <span className="font-mono text-primary">{je.entryNumber}</span> ·{" "}
                            {je.description}
                          </span>
                          <span className="text-muted-foreground">
                            {formatShortDate(je.postedAt)}
                          </span>
                        </div>
                        <div className="mt-2 divide-y divide-border-subtle border-t border-border pt-1.5 font-mono text-[11px]">
                          {je.lines.map((line) => (
                            <div
                              key={line.id}
                              className="flex items-center justify-between py-1"
                            >
                              <span>
                                {line.accountCode} {line.accountName}
                              </span>
                              <span>
                                {line.debit > 0
                                  ? `DR ${formatKES(line.debit)}`
                                  : `CR ${formatKES(line.credit)}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "COMMUNICATIONS" && (
            <div className="space-y-4">
              <form
                onSubmit={handleDispatchNotice}
                className="rounded-lg border border-border bg-surface p-4 space-y-3"
              >
                <h3 className="text-sm font-semibold">
                  Send Automated SMS / WhatsApp Notification
                </h3>
                <div>
                  <label
                    htmlFor="cust-tpl-select"
                    className="mb-1 block text-xs font-medium text-foreground"
                  >
                    Notification Template
                  </label>
                  <select
                    id="cust-tpl-select"
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-surface px-3 text-xs text-foreground"
                  >
                    {DEFAULT_NOTIFICATION_TEMPLATES.map((t) => (
                      <option key={t.id} value={t.id}>
                        [{t.channel}] {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end">
                  <button type="submit" className={btnClass("primary", "h-8 text-xs")}>
                    <Send className="h-3.5 w-3.5" />
                    Dispatch to {customer.phoneNumber}
                  </button>
                </div>
              </form>

              {sentLogs.length > 0 && (
                <div className="space-y-2">
                  {sentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-md border border-success/30 bg-success-soft p-3 text-xs"
                    >
                      <div className="flex items-center justify-between font-semibold text-success">
                        <span>
                          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                          {log.channel} Dispatched ({log.providerReference})
                        </span>
                        <span>{log.status}</span>
                      </div>
                      <p className="mt-1 text-foreground">{log.messageBody}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
