"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  Users,
  Search,
  Plus,
  PauseCircle,
  PlayCircle,
  X,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { SEED_CUSTOMERS, SEED_PLANS, SEED_SITES } from "@/lib/db/mock-db";
import { Customer } from "@/types";
import { cn, formatKES, formatShortDate } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader, btnClass } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/States";
import { usePageSize } from "@/lib/preferences";
import { Customer360Drawer } from "@/components/customers/Customer360Drawer";

type SortKey = "name" | "balance" | "expiry";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "PENDING_INSTALLATION", label: "Pending install" },
];

const inputClass =
  "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";

export default function CustomersPage() {
  const { isDemoMode, isLoading: authLoading, user } = useAuth();
  const [PAGE_SIZE] = usePageSize();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected360Customer, setSelected360Customer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);

  // Form State
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [physicalAddress, setPhysicalAddress] = useState("");
  const [selectedPlanId] = useState(SEED_PLANS[1].id);
  const [selectedSiteId] = useState(SEED_SITES[0].id);
  void selectedPlanId;

  const fetchCustomers = async () => {
    setLoadError(null);
    if (isDemoMode) {
      setCustomers(SEED_CUSTOMERS);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/v1/subscribers-api");
      const data = await res.json();
      if (data?.success && data.data) {
        setCustomers(data.data);
      } else {
        setLoadError("Subscribers could not be loaded. Nothing was changed.");
      }
    } catch (err) {
      console.error("[Customers] Failed to fetch real customer data:", err);
      setLoadError("Subscribers could not be loaded. Nothing was changed.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    setIsLoading(true);
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isDemoMode, user?.id]);

  // Reset to page 1 whenever the result set changes shape
  useEffect(() => setPage(1), [searchTerm, statusFilter, sort, PAGE_SIZE]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: customers.length };
    for (const cust of customers) c[cust.status] = (c[cust.status] ?? 0) + 1;
    return c;
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const rows = customers.filter((c) => {
      const matchesSearch =
        c.fullName.toLowerCase().includes(term) ||
        c.accountNumber.toLowerCase().includes(term) ||
        c.phoneNumber.includes(searchTerm);
      const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      if (sort.key === "balance") return (a.balanceDue - b.balanceDue) * dir;
      if (sort.key === "expiry") {
        const ax = a.subscription?.endTime ? new Date(a.subscription.endTime).getTime() : Infinity;
        const bx = b.subscription?.endTime ? new Date(b.subscription.endTime).getTime() : Infinity;
        return (ax - bx) * dir;
      }
      return a.fullName.localeCompare(b.fullName) * dir;
    });
  }, [customers, searchTerm, statusFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));
  const pageRows = filteredCustomers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const handleToggleSuspend = (customerId: string) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          const newStatus = c.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
          return { ...c, status: newStatus };
        }
        return c;
      })
    );
  };

  const resetForm = () => {
    setFullName("");
    setPhoneNumber("");
    setEmail("");
    setPhysicalAddress("");
    setFormError(null);
  };

  const closeModal = () => {
    setIsAddModalOpen(false);
    setFormError(null);
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (isDemoMode) {
      const newCustomer: Customer = {
        id: `cust-${Date.now()}`,
        organizationId: "org-gtech-kenya-01",
        accountNumber: `GT-${Math.floor(1000 + Math.random() * 9000)}`,
        fullName,
        phoneNumber,
        email,
        physicalAddress,
        siteId: selectedSiteId,
        status: "ACTIVE",
        balanceDue: 0,
        createdAt: new Date().toISOString(),
      };
      setCustomers((prev) => [newCustomer, ...prev]);
      setIsAddModalOpen(false);
      return;
    }

    try {
      const res = await fetch("/api/v1/subscribers-api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phoneNumber,
          email,
          physicalAddress,
          siteId: selectedSiteId,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setCustomers((prev) => [data.data, ...prev]);
        setIsAddModalOpen(false);
        resetForm();
      } else {
        setFormError(data?.error || "The subscriber could not be created. No record was added.");
      }
    } catch (err) {
      console.error("[Customers] Failed to create subscriber:", err);
      setFormError("The subscriber could not be created. No record was added. Check your connection and try again.");
    }
  };

  const SortHeader = ({ label, k, align }: { label: string; k: SortKey; align?: "right" }) => (
    <th
      scope="col"
      aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("px-3 py-2 font-medium", align === "right" && "text-right")}
    >
      <button
        onClick={() => toggleSort(k)}
        className={cn("inline-flex items-center gap-1 hover:text-foreground", align === "right" && "flex-row-reverse")}
      >
        {label}
        {sort.key === k &&
          (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );

  return (
    <AppShell title="Subscribers">
      <PageHeader
        title="Subscribers"
        description="Accounts, service status and balances."
        actions={
          <button onClick={() => setIsAddModalOpen(true)} className={btnClass("primary")}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add subscriber
          </button>
        }
      />

      {loadError && <ErrorState title="Could not load subscribers" detail={loadError} onRetry={fetchCustomers} />}

      <section className="rounded-lg border border-border bg-surface shadow-xs">
        {/* Toolbar: search + status filters with counts */}
        <div className="flex flex-col gap-3 border-b border-border p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative lg:w-80">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search subscribers"
              placeholder="Search name, phone or account no."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(inputClass, "pl-8")}
            />
          </div>
          <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                aria-pressed={statusFilter === f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors",
                  statusFilter === f.value
                    ? "border-primary bg-primary-soft font-medium text-primary"
                    : "border-border text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                )}
              >
                {f.label}
                <span className="tabular text-xs opacity-80">{counts[f.value] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : filteredCustomers.length === 0 ? (
          searchTerm || statusFilter !== "ALL" ? (
            <EmptyState
              icon={Users}
              title="No subscribers match"
              description="Try a different search or clear the status filter."
              action={
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("ALL");
                  }}
                  className={btnClass("secondary")}
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={Users}
              title="No subscribers yet"
              description="Add your first subscriber to begin managing billing and network access."
              action={
                <button onClick={() => setIsAddModalOpen(true)} className={btnClass("primary")}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add subscriber
                </button>
              }
            />
          )
        ) : (
          <>
            <div className="max-h-[calc(100vh-22rem)] min-h-48 overflow-auto">
              <table className="w-full min-w-[52rem] text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-border bg-surface-subtle text-xs text-muted-foreground">
                  <tr>
                    <SortHeader label="Subscriber" k="name" />
                    <th scope="col" className="px-3 py-2 font-medium">Package</th>
                    <th scope="col" className="px-3 py-2 font-medium">Status</th>
                    <SortHeader label="Balance" k="balance" align="right" />
                    <SortHeader label="Expires" k="expiry" />
                    <th scope="col" className="px-3 py-2 font-medium">Contact</th>
                    <th scope="col" className="px-3 py-2 font-medium">Site</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {pageRows.map((cust) => (
                    <tr key={cust.id} className="hover:bg-surface-subtle">
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setSelected360Customer(cust)}
                          className="text-left font-medium leading-5 text-foreground hover:text-primary hover:underline"
                        >
                          {cust.fullName}
                        </button>
                        <div className="font-mono text-xs text-muted-foreground">{cust.accountNumber}</div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {cust.currentPlan?.name || cust.subscription?.planName || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={cust.status} />
                      </td>
                      <td
                        className={cn(
                          "tabular px-3 py-2 text-right font-medium",
                          cust.balanceDue > 0 ? "text-danger" : "text-muted-foreground"
                        )}
                      >
                        {cust.balanceDue > 0 ? formatKES(cust.balanceDue) : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {cust.subscription?.endTime ? formatShortDate(cust.subscription.endTime) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="tabular">{cust.phoneNumber}</div>
                        {cust.email && <div className="max-w-[12rem] truncate text-xs text-muted-foreground">{cust.email}</div>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{cust.siteName || "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelected360Customer(cust)}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-surface px-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-elevated"
                          >
                            360° View
                          </button>
                          <button
                            onClick={() => handleToggleSuspend(cust.id)}
                            className={cn(
                              "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors",
                              cust.status === "ACTIVE"
                                ? "border-danger/30 text-danger hover:bg-danger-soft"
                                : "border-success/30 text-success hover:bg-success-soft"
                            )}
                          >
                            {cust.status === "ACTIVE" ? (
                              <>
                                <PauseCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                Suspend
                              </>
                            ) : (
                              <>
                                <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                Reactivate
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
              <span className="tabular">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredCustomers.length)} of{" "}
                {filteredCustomers.length}
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
                <span className="tabular px-2">
                  {page} / {pageCount}
                </span>
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

      <Customer360Drawer
        customer={selected360Customer}
        onClose={() => setSelected360Customer(null)}
        onToggleSuspend={(id) => {
          handleToggleSuspend(id);
          setSelected360Customer((prev) =>
            prev && prev.id === id
              ? { ...prev, status: prev.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }
              : prev
          );
        }}
      />

      {isAddModalOpen && (
        <AddSubscriberDialog
          onClose={closeModal}
          onSubmit={handleAddCustomer}
          error={formError}
          values={{ fullName, phoneNumber, email, physicalAddress }}
          setters={{ setFullName, setPhoneNumber, setEmail, setPhysicalAddress }}
        />
      )}
    </AppShell>
  );
}

/** Focused dialog: Escape closes, focus lands on the first field, labels are programmatically associated. */
function AddSubscriberDialog({
  onClose,
  onSubmit,
  error,
  values,
  setters,
}: {
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  error: string | null;
  values: { fullName: string; phoneNumber: string; email: string; physicalAddress: string };
  setters: {
    setFullName: (v: string) => void;
    setPhoneNumber: (v: string) => void;
    setEmail: (v: string) => void;
    setPhysicalAddress: (v: string) => void;
  };
}) {
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const field = "mb-1 block text-sm font-medium text-foreground";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-sub-title"
        className="w-full max-w-md rounded-t-xl border border-border bg-surface shadow-[var(--shadow-pop)] sm:rounded-lg"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 id="add-sub-title" className="text-base font-semibold">
            Add subscriber
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-elevated"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 p-4">
          {error && <ErrorState title="Subscriber not created" detail={error} />}

          <fieldset className="space-y-3">
            <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Identity</legend>
            <div>
              <label htmlFor="sub-name" className={field}>Full name</label>
              <input
                id="sub-name"
                ref={firstRef}
                type="text"
                required
                autoComplete="off"
                value={values.fullName}
                onChange={(e) => setters.setFullName(e.target.value)}
                placeholder="e.g. Jane Wanjiku"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="sub-phone" className={field}>Phone number</label>
              <input
                id="sub-phone"
                type="tel"
                required
                inputMode="tel"
                value={values.phoneNumber}
                onChange={(e) => setters.setPhoneNumber(e.target.value)}
                placeholder="07XX XXX XXX"
                aria-describedby="sub-phone-help"
                className={inputClass}
              />
              <p id="sub-phone-help" className="mt-1 text-xs text-muted-foreground">
                Used for M-Pesa payments and SMS notices.
              </p>
            </div>
            <div>
              <label htmlFor="sub-email" className={field}>
                Email <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <input
                id="sub-email"
                type="email"
                value={values.email}
                onChange={(e) => setters.setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Location</legend>
            <label htmlFor="sub-address" className={field}>Physical address</label>
            <input
              id="sub-address"
              type="text"
              value={values.physicalAddress}
              onChange={(e) => setters.setPhysicalAddress(e.target.value)}
              className={inputClass}
            />
          </fieldset>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <button type="button" onClick={onClose} className={btnClass("secondary")}>
              Cancel
            </button>
            <button type="submit" className={btnClass("primary")}>
              Add subscriber
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
