"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Plus,
  X,
} from "lucide-react";
import { cn, formatKES, formatShortDate } from "@/lib/utils";
import { btnClass } from "@/components/ui/PageHeader";
import {
  JournalEntry,
  computeTrialBalance,
  computeArAgingBuckets,
  computeExecutiveRevenueMetrics,
  postCreditNoteToLedger,
} from "@/lib/ledger/ledger";
import {
  ApprovalRequestRecord,
  PaymentReconciliationResult,
  decideApprovalRequest,
} from "@/lib/payments/reconciliation";
import {
  SEED_CUSTOMERS,
  SEED_PAYMENTS,
  SEED_ORGANIZATION,
} from "@/lib/db/mock-db";
import {
  SEED_INVOICES_2027,
  SEED_APPROVAL_REQUESTS,
  getSeedJournalEntries,
  getSeedReconciliationQueue,
} from "@/lib/db/os-2027-seed";
import { useAuth } from "@/lib/auth/auth-context";
import type { Customer, Payment } from "@/types";

export type BillingTabMode =
  | "PAYMENTS"
  | "LEDGER"
  | "REVENUE_INTELLIGENCE"
  | "RECONCILIATION_APPROVALS";

export function BillingModeTabs({
  mode,
  onChange,
}: {
  mode: BillingTabMode;
  onChange: (m: BillingTabMode) => void;
}) {
  const tabs: Array<{ id: BillingTabMode; label: string }> = [
    { id: "PAYMENTS", label: "Payments & M-Pesa" },
    { id: "LEDGER", label: "Double-Entry Ledger & Trial Balance" },
    { id: "REVENUE_INTELLIGENCE", label: "Revenue & AR Aging" },
    { id: "RECONCILIATION_APPROVALS", label: "Reconciliation & Maker-Checker" },
  ];

  return (
    <div
      role="tablist"
      aria-label="Financial system views"
      className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-surface p-1.5 shadow-xs"
    >
      {tabs.map((t) => {
        const active = mode === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function FinancialOsPanels({ mode }: { mode: BillingTabMode }) {
  const { isDemoMode, user, profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>(() =>
    isDemoMode ? SEED_CUSTOMERS : []
  );
  const [payments, setPayments] = useState<Payment[]>(() =>
    isDemoMode ? SEED_PAYMENTS : []
  );
  const [entries, setEntries] = useState<JournalEntry[]>(() =>
    isDemoMode ? getSeedJournalEntries() : []
  );
  const [reconQueue, setReconQueue] = useState<PaymentReconciliationResult[]>(
    () => (isDemoMode ? getSeedReconciliationQueue() : [])
  );
  const [approvals, setApprovals] = useState<ApprovalRequestRecord[]>(
    () => (isDemoMode ? SEED_APPROVAL_REQUESTS : [])
  );
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [creditCustomerId, setCreditCustomerId] = useState(
    isDemoMode ? SEED_CUSTOMERS[0].id : ""
  );
  const [creditAmount, setCreditAmount] = useState("500");
  const [creditReason, setCreditReason] = useState(
    "SLA downtime credit adjustment"
  );
  const [actionBanner, setActionBanner] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode) {
      setCustomers(SEED_CUSTOMERS);
      setPayments(SEED_PAYMENTS);
      setEntries(getSeedJournalEntries());
      setReconQueue(getSeedReconciliationQueue());
      setApprovals(SEED_APPROVAL_REQUESTS);
      setCreditCustomerId(SEED_CUSTOMERS[0].id);
      return;
    }

    setEntries([]);
    setReconQueue([]);
    setApprovals([]);

    let cancelled = false;
    (async () => {
      try {
        const [subRes, payRes] = await Promise.all([
          fetch("/api/v1/subscribers-api"),
          fetch("/api/v1/payments"),
        ]);
        const subJson = await subRes.json();
        const payJson = await payRes.json();
        if (cancelled) return;
        const liveCustomers: Customer[] = Array.isArray(subJson?.data)
          ? subJson.data
          : [];
        const livePayments: Payment[] = Array.isArray(payJson?.data)
          ? payJson.data
          : [];
        setCustomers(liveCustomers);
        setPayments(livePayments);
        if (liveCustomers[0]) {
          setCreditCustomerId(liveCustomers[0].id);
        }
      } catch {
        // Keep empty on error for real accounts
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isDemoMode]);

  const trialBalance = useMemo(() => computeTrialBalance(entries), [entries]);
  const arAging = useMemo(
    () =>
      computeArAgingBuckets(
        isDemoMode
          ? SEED_INVOICES_2027
          : customers
              .filter((c) => Number(c.balanceDue || 0) > 0)
              .map((c) => ({
                id: `inv-${c.id}`,
                organizationId: c.organizationId,
                invoiceNumber: `INV-${c.accountNumber}`,
                customerId: c.id,
                customerName: c.fullName,
                accountNumber: c.accountNumber,
                subtotalAmount: Number(c.balanceDue || 0),
                taxRatePercent: 0,
                taxAmount: 0,
                totalAmount: Number(c.balanceDue || 0),
                amountPaid: 0,
                balanceDue: Number(c.balanceDue || 0),
                currency: "KES" as const,
                status: "OVERDUE" as const,
                dueDate: c.createdAt,
                createdAt: c.createdAt,
              }))
      ),
    [isDemoMode, customers]
  );
  const execMetrics = useMemo(
    () =>
      computeExecutiveRevenueMetrics({
        customers: customers.map((c) => ({
          id: c.id,
          status: c.status,
          balanceDue: c.balanceDue,
          planPrice: isDemoMode ? 2500 : 0,
        })),
        payments,
        trialBalance,
        arAging,
      }),
    [customers, payments, isDemoMode, trialBalance, arAging]
  );

  if (mode === "PAYMENTS") return null;

  const handleCreateCreditNote = (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find((c) => c.id === creditCustomerId) || customers[0];
    if (!cust) return;
    const amt = Number(creditAmount) || 0;
    if (amt <= 0) return;

    const je = postCreditNoteToLedger({
      organizationId: cust.organizationId || SEED_ORGANIZATION.id,
      entryNumber: `JE-CN-${Math.floor(1000 + Math.random() * 9000)}`,
      creditNoteId: `CN-${Date.now().toString().slice(-4)}`,
      customerId: cust.id,
      customerName: cust.fullName,
      amount: amt,
      reason: creditReason,
      postedBy: profile?.full_name || "ISP Operator",
    });

    setEntries((prev) => [je, ...prev]);
    setIsCreditModalOpen(false);
    setActionBanner(
      `Posted balanced Credit Note ${je.entryNumber} (DR 5100 / CR 1200 ${formatKES(
        amt
      )}) for ${cust.fullName}.`
    );
  };

  const handleManualResolve = (reference: string, customerId: string) => {
    const cust = customers.find((c) => c.id === customerId) || customers[0];
    if (!cust) return;
    setReconQueue((prev) =>
      prev.map((item) =>
        item.transactionReference === reference
          ? {
              ...item,
              matchStatus: "MANUALLY_RESOLVED",
              matchedCustomerId: cust.id,
              matchedCustomerName: cust.fullName,
              matchedAccountNumber: cust.accountNumber,
              allocatedToInvoice: item.amount,
              discrepancyReason: `Manually reconciled to ${cust.accountNumber} (${cust.fullName}).`,
            }
          : item
      )
    );
    setActionBanner(
      `Manually matched payment ${reference} to ${cust.fullName} (${cust.accountNumber}).`
    );
  };

  const handleApprovalDecision = (
    reqId: string,
    decision: "APPROVED" | "REJECTED"
  ) => {
    setApprovals((prev) =>
      prev.map((r) => {
        if (r.id !== reqId || r.status !== "PENDING") return r;
        return decideApprovalRequest({
          request: r,
          decision,
          decidedById: user?.id || "user-owner",
          decidedByName: profile?.full_name || "ISP Owner",
          decidedByRole: "isp_owner",
          decisionNote:
            decision === "APPROVED"
              ? "Dual-authorization approved by ISP Owner"
              : "Rejected by ISP Owner",
        });
      })
    );
    setActionBanner(`Maker-Checker request ${decision.toLowerCase()}.`);
  };

  return (
    <div className="space-y-4">
      {actionBanner && (
        <div
          role="status"
          className="flex items-center justify-between rounded-lg border border-success/30 bg-success-soft px-4 py-2.5 text-xs font-medium text-success"
        >
          <span>
            <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
            {actionBanner}
          </span>
          <button
            type="button"
            onClick={() => setActionBanner(null)}
            className="text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {mode === "LEDGER" && (
        <div className="space-y-4">
          {/* Trial Balance Verification Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">
                    Immutable Double-Entry Trial Balance
                  </h3>
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-[11px] font-semibold",
                      trialBalance.isBalanced
                        ? "bg-success-soft text-success"
                        : "bg-danger-soft text-danger"
                    )}
                  >
                    {trialBalance.isBalanced
                      ? "BALANCED · DR = CR"
                      : "UNBALANCED"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Total Debits: {formatKES(trialBalance.totalDebits)} · Total
                  Credits: {formatKES(trialBalance.totalCredits)} · Discrepancy:{" "}
                  {formatKES(trialBalance.discrepancy)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsCreditModalOpen(true)}
              className={btnClass("primary", "h-8 text-xs")}
            >
              <Plus className="h-3.5 w-3.5" />
              Issue Credit Note / Waiver
            </button>
          </div>

          {/* Chart of Accounts Table */}
          <section className="rounded-lg border border-border bg-surface shadow-xs">
            <header className="border-b border-border px-4 py-2.5">
              <h3 className="text-sm font-semibold">
                Chart of Accounts &amp; Trial Balance
              </h3>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-surface-subtle text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Code</th>
                    <th className="px-3 py-2 font-medium">Account Name</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Total Debits
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Total Credits
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Net Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {trialBalance.rows.map((row) => (
                    <tr key={row.code} className="hover:bg-surface-subtle">
                      <td className="px-3 py-2 font-mono text-xs font-semibold text-primary">
                        {row.code}
                      </td>
                      <td className="px-3 py-2 font-medium">{row.name}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {row.category} ({row.normalBalance})
                      </td>
                      <td className="tabular px-3 py-2 text-right">
                        {formatKES(row.totalDebits)}
                      </td>
                      <td className="tabular px-3 py-2 text-right">
                        {formatKES(row.totalCredits)}
                      </td>
                      <td className="tabular px-3 py-2 text-right font-semibold">
                        {formatKES(row.netBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Posted Journal Entries */}
          <section className="rounded-lg border border-border bg-surface shadow-xs">
            <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <h3 className="text-sm font-semibold">
                Posted Journal Entries ({entries.length})
              </h3>
              <span className="text-xs text-muted-foreground">
                Append-only · Reversals only
              </span>
            </header>
            <div className="divide-y divide-border-subtle">
              {entries.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No ledger journal entries recorded yet.
                </div>
              ) : (
                entries.map((je) => (
                  <div key={je.id} className="p-4 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-foreground">
                        <span className="font-mono text-primary">
                          {je.entryNumber}
                        </span>{" "}
                        · <span className="rounded border border-border px-1.5 py-0.5 text-[11px]">{je.referenceType}</span> ·{" "}
                        {je.description}
                      </div>
                      <span className="text-muted-foreground">
                        {formatShortDate(je.postedAt)}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1 rounded border border-border bg-surface-subtle p-2.5 font-mono text-[11px]">
                      {je.lines.map((l) => (
                        <div
                          key={l.id}
                          className="flex items-center justify-between"
                        >
                          <span>
                            {l.accountCode} — {l.accountName}
                          </span>
                          <span>
                            {l.debit > 0
                              ? `DR ${formatKES(l.debit)}`
                              : `CR ${formatKES(l.credit)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {mode === "REVENUE_INTELLIGENCE" && (
        <div className="space-y-4">
          {/* Executive KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                label: "Monthly Recurring Revenue (MRR)",
                value: formatKES(execMetrics.mrr),
                sub: `ARR: ${formatKES(execMetrics.arr)}`,
              },
              {
                label: "Average Revenue Per User (ARPU)",
                value: formatKES(execMetrics.arpu),
                sub: `${execMetrics.activePayingSubscribers} active subscribers`,
              },
              {
                label: "Collection Efficiency",
                value: `${execMetrics.collectionRatePercent}%`,
                sub: `${formatKES(execMetrics.collectedThisPeriod)} collected`,
              },
              {
                label: "Net Revenue Retention (NRR)",
                value: `${execMetrics.netRevenueRetentionPercent}%`,
                sub: `VAT Payable: ${formatKES(execMetrics.taxPayableBalance)}`,
              },
            ].map((k) => (
              <div
                key={k.label}
                className="rounded-lg border border-border bg-surface p-3.5 shadow-xs"
              >
                <div className="text-xs font-medium text-muted-foreground">
                  {k.label}
                </div>
                <div className="tabular mt-1 text-xl font-semibold">
                  {k.value}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {k.sub}
                </div>
              </div>
            ))}
          </div>

          {/* AR Aging Buckets */}
          <section className="rounded-lg border border-border bg-surface p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">
                  Accounts Receivable (AR) Aging Analysis
                </h3>
                <p className="text-xs text-muted-foreground">
                  Total Outstanding Receivable:{" "}
                  <strong className="text-foreground">
                    {formatKES(arAging.totalOutstanding)}
                  </strong>{" "}
                  across {arAging.overdueCount} open invoice(s).
                </p>
              </div>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
              {arAging.buckets.map((b) => (
                <div
                  key={b.bucket}
                  className="rounded-lg border border-border bg-surface-subtle p-3"
                >
                  <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                    <span>{b.label}</span>
                    <span className="font-mono">{b.invoiceCount} inv</span>
                  </div>
                  <div className="tabular mt-1 text-lg font-semibold">
                    {formatKES(b.totalBalanceDue)}
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        b.bucket === "90+"
                          ? "bg-danger"
                          : b.bucket === "61-90"
                          ? "bg-warning"
                          : "bg-primary"
                      )}
                      style={{ width: `${Math.min(100, b.sharePercent)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {b.sharePercent}% of AR
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {mode === "RECONCILIATION_APPROVALS" && (
        <div className="space-y-4">
          {/* Multi-Channel Payment Reconciliation Queue */}
          <section className="rounded-lg border border-border bg-surface shadow-xs">
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold">
                  Multi-Channel Payment Reconciliation Queue
                </h3>
                <p className="text-xs text-muted-foreground">
                  Automated account/phone/name matching, overpayment wallet
                  allocation, and unmatched callback resolution.
                </p>
              </div>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-surface-subtle text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Reference</th>
                    <th className="px-3 py-2 font-medium">Channel</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Match Status</th>
                    <th className="px-3 py-2 font-medium">Subscriber</th>
                    <th className="px-3 py-2 font-medium">Allocation Note</th>
                    <th className="px-3 py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {reconQueue.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-8 text-center text-xs text-muted-foreground"
                      >
                        No unmatched or pending reconciliation callbacks.
                      </td>
                    </tr>
                  ) : (
                    reconQueue.map((item) => (
                      <tr
                        key={item.transactionReference}
                        className="hover:bg-surface-subtle"
                      >
                        <td className="px-3 py-2 font-mono text-xs font-semibold">
                          {item.transactionReference}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {item.channel}
                        </td>
                        <td className="tabular px-3 py-2 text-right font-medium">
                          {formatKES(item.amount)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "rounded px-2 py-0.5 text-xs font-semibold",
                              item.matchStatus === "MATCHED" ||
                                item.matchStatus === "MANUALLY_RESOLVED"
                                ? "bg-success-soft text-success"
                                : item.matchStatus === "UNMATCHED"
                                ? "bg-danger-soft text-danger"
                                : "bg-warning-soft text-warning"
                            )}
                          >
                            {item.matchStatus} ({item.matchConfidence}%)
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {item.matchedCustomerName ? (
                            <>
                              <div className="font-medium">
                                {item.matchedCustomerName}
                              </div>
                              <div className="font-mono text-muted-foreground">
                                {item.matchedAccountNumber}
                              </div>
                            </>
                          ) : (
                            <span className="text-danger">Unmatched</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {item.discrepancyReason ||
                            `Allocated ${formatKES(item.allocatedToInvoice)} to invoice · Auto-reconnect ready`}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {item.matchStatus === "UNMATCHED" ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleManualResolve(
                                  item.transactionReference,
                                  "cust-03"
                                )
                              }
                              className={btnClass("secondary", "h-7 px-2 text-xs")}
                            >
                              Assign to Subscriber
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Reconciled
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Maker-Checker Approval Queue */}
          <section className="rounded-lg border border-border bg-surface shadow-xs">
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <div>
                  <h3 className="text-sm font-semibold">
                    Maker-Checker Dual Authorization Queue
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Refunds, balance overrides, and waivers &ge; KES 1,000
                    require secondary supervisor approval.
                  </p>
                </div>
              </div>
            </header>
            <div className="divide-y divide-border-subtle">
              {approvals.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No pending Maker-Checker authorization requests.
                </div>
              ) : (
                approvals.map((req) => (
                  <div
                    key={req.id}
                    className="flex flex-col justify-between gap-3 p-4 text-xs sm:flex-row sm:items-center"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-semibold text-primary">
                          {req.requestNumber}
                        </span>
                        <span className="rounded border border-border px-1.5 py-0.5 font-medium">
                          {req.actionType}
                        </span>
                        <span className="font-semibold text-foreground">
                          {req.targetLabel}
                        </span>
                        {req.amount && (
                          <span className="font-mono font-bold text-foreground">
                            {formatKES(req.amount)}
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground">{req.reason}</p>
                      <div className="text-[11px] text-muted-foreground">
                        Requested by <strong>{req.requestedByName}</strong> ·{" "}
                        {formatShortDate(req.createdAt)}
                        {req.decidedByName &&
                          ` · Decided by ${req.decidedByName} (${req.decisionNote})`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {req.status === "PENDING" ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              handleApprovalDecision(req.id, "APPROVED")
                            }
                            className={btnClass("primary", "h-8 px-3 text-xs")}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleApprovalDecision(req.id, "REJECTED")
                            }
                            className={btnClass("secondary", "h-8 px-3 text-xs")}
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span
                          className={cn(
                            "rounded px-2 py-1 text-xs font-semibold",
                            req.status === "APPROVED"
                              ? "bg-success-soft text-success"
                              : "bg-danger-soft text-danger"
                          )}
                        >
                          {req.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* Credit Note Modal */}
      {isCreditModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Issue Credit Note"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-pop)]">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-semibold">
                Post Double-Entry Credit Note / Waiver
              </h3>
              <button
                type="button"
                onClick={() => setIsCreditModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCreditNote} className="mt-3 space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-medium">Subscriber</label>
                <select
                  value={creditCustomerId}
                  onChange={(e) => setCreditCustomerId(e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-surface px-3 text-xs"
                >
                  {customers.length === 0 ? (
                    <option value="">No subscribers configured</option>
                  ) : (
                    customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.accountNumber})
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-medium">Amount (KES)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-surface px-3 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium">Reason / Memo</label>
                <input
                  type="text"
                  required
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-surface px-3 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreditModalOpen(false)}
                  className={btnClass("secondary", "h-8 text-xs")}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={customers.length === 0}
                  className={btnClass("primary", "h-8 text-xs")}
                >
                  Post Balanced Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
