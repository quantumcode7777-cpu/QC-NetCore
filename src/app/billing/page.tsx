"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { CreditCard, Search, Send, Zap, X, ChevronLeft, ChevronRight } from "lucide-react";
import { SEED_PAYMENTS, SEED_ORGANIZATION } from "@/lib/db/mock-db";
import { Payment } from "@/types";
import { MpesaService } from "@/lib/payments/mpesa";
import { cn, formatKES, formatShortDate } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader, btnClass } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/States";
import { usePageSize } from "@/lib/preferences";
import {
  BillingModeTabs,
  FinancialOsPanels,
  type BillingTabMode,
} from "@/components/billing/FinancialOsPanels";

const METHOD_LABEL: Record<Payment["paymentMethod"], string> = {
  MPESA_EXPRESS: "M-Pesa STK",
  MPESA_C2B: "M-Pesa Paybill",
  AIRTEL_MONEY: "Airtel Money",
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
};

type Filter = "ALL" | "COMPLETED" | "PENDING" | "FAILED";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "COMPLETED", label: "Successful" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
];

const inputClass =
  "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";

export default function BillingPage() {
  const { isDemoMode, isLoading: authLoading, user } = useAuth();
  const [PAGE_SIZE] = usePageSize();

  const [activeMode, setActiveMode] = useState<BillingTabMode>("PAYMENTS");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [page, setPage] = useState(1);
  const [isStkModalOpen, setIsStkModalOpen] = useState(false);

  // STK Form State (no pre-filled customer data)
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [accRef, setAccRef] = useState("");
  const [stkMessage, setStkMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [isSending, setIsSending] = useState(false);

  const loadPayments = async () => {
    setLoadError(null);
    if (isDemoMode) {
      setPayments(SEED_PAYMENTS);
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/v1/payments?limit=500");
      const data = await res.json();
      if (data?.success) setPayments(data.data ?? []);
      else setLoadError("Payments could not be loaded. Nothing was changed.");
    } catch (err) {
      console.error("[Billing] Failed to load payments:", err);
      setLoadError("Payments could not be loaded. Nothing was changed.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    setIsLoading(true);
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isDemoMode, user?.id]);

  useEffect(() => setPage(1), [searchTerm, filter, PAGE_SIZE]);

  const bucket = (p: Payment): Filter =>
    p.status === "COMPLETED" ? "COMPLETED" : p.status === "FAILED" ? "FAILED" : p.status === "REVERSED" ? "ALL" : "PENDING";

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { ALL: payments.length, COMPLETED: 0, PENDING: 0, FAILED: 0 };
    for (const p of payments) {
      const b = bucket(p);
      if (b !== "ALL") c[b] += 1;
    }
    return c;
  }, [payments]);

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return payments.filter((p) => {
      const matches =
        p.transactionReference.toLowerCase().includes(term) ||
        p.msisdnPhone.includes(searchTerm) ||
        (p.senderName?.toLowerCase().includes(term) ?? false) ||
        (p.customerName?.toLowerCase().includes(term) ?? false);
      return matches && (filter === "ALL" || bucket(p) === filter);
    });
  }, [payments, searchTerm, filter]);

  const totalCollected = payments.reduce((acc, p) => acc + (p.status === "COMPLETED" ? p.amount : 0), 0);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const closeStk = () => {
    setIsStkModalOpen(false);
    setStkMessage(null);
  };

  const handleSendSTK = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      setStkMessage({ tone: "error", text: "Enter an amount greater than zero." });
      return;
    }
    setIsSending(true);
    setStkMessage(null);

    // Demo dataset keeps the original local simulation.
    if (isDemoMode) {
      const res = await MpesaService.initiateSTKPush({
        phoneNumber: phone,
        amount,
        accountReference: accRef,
        transactionDesc: `Internet Subscription ${accRef}`,
      });
      setIsSending(false);
      if (res.success) {
        setStkMessage({ tone: "ok", text: "M-Pesa STK prompt sent to subscriber phone. Verifying payment..." });
        setTimeout(() => {
          const receipt = MpesaService.generateReceiptNumber();
          const newPayment: Payment = {
            id: `pay-${Date.now()}`,
            organizationId: SEED_ORGANIZATION.id,
            accountNumber: accRef,
            paymentMethod: "MPESA_EXPRESS",
            amount,
            currency: "KES",
            transactionReference: receipt,
            msisdnPhone: MpesaService.formatPhoneNumber(phone),
            status: "COMPLETED",
            processedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          };
          setPayments((prev) => [newPayment, ...prev]);
          closeStk();
        }, 1500);
      }
      return;
    }

    // Real account: use the established API route; never fabricate a payment row.
    // The payment appears in the ledger only when the M-Pesa callback confirms it.
    try {
      const res = await fetch("/api/v1/mpesa-stk-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone, amount, accountReference: accRef }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStkMessage({
          tone: "ok",
          text: "M-Pesa STK prompt sent. Payment will post automatically upon confirmation.",
        });
      } else {
        setStkMessage({ tone: "error", text: data?.error || "The request was not sent. No charge was made." });
      }
    } catch {
      setStkMessage({ tone: "error", text: "The request was not sent. No charge was made. Check your connection and try again." });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AppShell title="Payments">
      <PageHeader
        title="Payments"
        description="Real-time M-Pesa collections, invoicing, and ledger reconciliation."
        actions={
          <button onClick={() => setIsStkModalOpen(true)} className={btnClass("primary")}>
            <Zap className="h-4 w-4" aria-hidden="true" />
            Request M-Pesa payment
          </button>
        }
      />

      {loadError && <ErrorState title="Could not load payments" detail={loadError} onRetry={loadPayments} />}

      <BillingModeTabs mode={activeMode} onChange={setActiveMode} />

      <FinancialOsPanels mode={activeMode} />

      {activeMode === "PAYMENTS" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Collected", value: formatKES(totalCollected), ctx: "Successful payments loaded" },
              { label: "Successful", value: counts.COMPLETED, ctx: "Transactions" },
              { label: "Pending", value: counts.PENDING, ctx: "Awaiting confirmation", tone: counts.PENDING > 0 ? "text-warning" : "" },
              { label: "Failed", value: counts.FAILED, ctx: "Not completed", tone: counts.FAILED > 0 ? "text-danger" : "" },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border border-border bg-surface p-3 shadow-xs">
                <div className="text-xs font-medium text-muted-foreground">{m.label}</div>
                <div className={cn("tabular mt-1 text-xl font-semibold tracking-tight", m.tone)}>{isLoading ? "—" : m.value}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{m.ctx}</div>
              </div>
            ))}
          </div>

          <section className="rounded-lg border border-border bg-surface shadow-xs">
            <div className="flex flex-col gap-3 border-b border-border p-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative lg:w-80">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Search payments"
                  placeholder="Search reference, phone or name"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(inputClass, "pl-8")}
                />
              </div>
              <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    aria-pressed={filter === f.value}
                    onClick={() => setFilter(f.value)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors",
                      filter === f.value
                        ? "border-primary bg-primary-soft font-medium text-primary"
                        : "border-border text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                    )}
                  >
                    {f.label}
                    <span className="tabular text-xs opacity-80">{counts[f.value]}</span>
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <TableSkeleton rows={8} cols={6} />
            ) : filtered.length === 0 ? (
              payments.length === 0 ? (
                <EmptyState
                  icon={CreditCard}
                  title="No payments yet"
                  description="Payments confirmed through M-Pesa will be listed here automatically."
                />
              ) : (
                <EmptyState
                  icon={CreditCard}
                  title="No payments match"
                  description="Try a different search or filter."
                  action={
                    <button
                      onClick={() => {
                        setSearchTerm("");
                        setFilter("ALL");
                      }}
                      className={btnClass("secondary")}
                    >
                      Clear filters
                    </button>
                  }
                />
              )
            ) : (
              <>
                <div className="max-h-[calc(100vh-27rem)] min-h-48 overflow-auto">
                  <table className="w-full min-w-[46rem] text-left text-sm">
                    <thead className="sticky top-0 z-10 border-b border-border bg-surface-subtle text-xs text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-3 py-2 font-medium">Reference</th>
                        <th scope="col" className="px-3 py-2 font-medium">Subscriber</th>
                        <th scope="col" className="px-3 py-2 font-medium">Phone</th>
                        <th scope="col" className="px-3 py-2 font-medium">Method</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Amount</th>
                        <th scope="col" className="px-3 py-2 font-medium">Status</th>
                        <th scope="col" className="px-3 py-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {rows.map((pay) => (
                        <tr key={pay.id} className="hover:bg-surface-subtle">
                          <td className="px-3 py-2 font-mono text-xs font-medium">{pay.transactionReference}</td>
                          <td className="px-3 py-2">
                            <div className="leading-5">{pay.customerName || pay.senderName || "Unmatched"}</div>
                            <div className="font-mono text-xs text-muted-foreground">{pay.accountNumber || "No account"}</div>
                          </td>
                          <td className="tabular px-3 py-2">{pay.msisdnPhone}</td>
                          <td className="px-3 py-2 text-muted-foreground">{METHOD_LABEL[pay.paymentMethod] ?? pay.paymentMethod}</td>
                          <td className="tabular px-3 py-2 text-right font-medium">{formatKES(pay.amount)}</td>
                          <td className="px-3 py-2"><StatusBadge status={pay.status} /></td>
                          <td className="px-3 py-2 text-muted-foreground">{formatShortDate(pay.processedAt ?? pay.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
                  <span className="tabular">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      aria-label="Previous page"
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-surface-elevated disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="tabular px-2">{page} / {pageCount}</span>
                    <button
                      onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                      disabled={page === pageCount}
                      aria-label="Next page"
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-surface-elevated disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      )}

      {isStkModalOpen && (
        <StkDialog
          onClose={closeStk}
          onSubmit={handleSendSTK}
          isSending={isSending}
          message={stkMessage}
          values={{ phone, amount, accRef }}
          setters={{ setPhone, setAmount, setAccRef }}
        />
      )}
    </AppShell>
  );
}

function StkDialog({
  onClose,
  onSubmit,
  isSending,
  message,
  values,
  setters,
}: {
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSending: boolean;
  message: { tone: "ok" | "error"; text: string } | null;
  values: { phone: string; amount: number | ""; accRef: string };
  setters: {
    setPhone: (v: string) => void;
    setAmount: (v: number | "") => void;
    setAccRef: (v: string) => void;
  };
}) {
  const firstRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const label = "mb-1 block text-sm font-medium text-foreground";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stk-title"
        className="w-full max-w-md rounded-t-xl border border-border bg-surface shadow-[var(--shadow-pop)] sm:rounded-lg"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 id="stk-title" className="text-base font-semibold">Request M-Pesa payment</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-elevated"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3 p-4">
          <div>
            <label htmlFor="stk-acc" className={label}>Subscriber account</label>
            <input
              id="stk-acc"
              ref={firstRef}
              type="text"
              required
              value={values.accRef}
              onChange={(e) => setters.setAccRef(e.target.value)}
              placeholder="e.g. GT-8921"
              className={cn(inputClass, "font-mono")}
            />
          </div>
          <div>
            <label htmlFor="stk-phone" className={label}>M-Pesa phone number</label>
            <input
              id="stk-phone"
              type="tel"
              inputMode="tel"
              required
              value={values.phone}
              onChange={(e) => setters.setPhone(e.target.value)}
              placeholder="07XX XXX XXX"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="stk-amount" className={label}>Amount (KES)</label>
            <input
              id="stk-amount"
              type="number"
              min={1}
              step={1}
              required
              value={values.amount}
              onChange={(e) => setters.setAmount(e.target.value === "" ? "" : Number(e.target.value))}
              className={inputClass}
            />
          </div>

          {message && (
            <div
              role={message.tone === "error" ? "alert" : "status"}
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                message.tone === "error"
                  ? "border-danger/30 bg-danger-soft text-danger"
                  : "border-success/30 bg-success-soft text-success"
              )}
            >
              {message.text}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <button type="button" onClick={onClose} className={btnClass("secondary")}>Close</button>
            <button type="submit" disabled={isSending} className={btnClass("primary")}>
              <Send className="h-4 w-4" aria-hidden="true" />
              {isSending ? "Sending…" : "Send request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
