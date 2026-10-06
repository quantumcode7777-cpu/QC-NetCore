"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Layers, Plus, X } from "lucide-react";
import { SEED_PLANS } from "@/lib/db/mock-db";
import { ServicePlan, ServiceType } from "@/types";
import { cn, formatKES, formatSpeed, formatDuration } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader, btnClass } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/States";

const TABS: { value: ServiceType; label: string }[] = [
  { value: "PPPOE", label: "PPPoE (home & business)" },
  { value: "HOTSPOT", label: "Hotspot (prepaid)" },
];

const inputClass =
  "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";

export default function PlansPage() {
  const { isDemoMode, isLoading: authLoading, user } = useAuth();

  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ServiceType>("PPPOE");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>("PPPOE");
  const [downMbps, setDownMbps] = useState(10);
  const [upMbps, setUpMbps] = useState(5);
  const [priceKes, setPriceKes] = useState(2500);
  const [validityDays, setValidityDays] = useState(30);

  const loadPlans = async () => {
    setLoadError(null);
    if (isDemoMode) {
      setPlans(SEED_PLANS);
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/v1/service-plans");
      const data = await res.json();
      if (data?.success) setPlans(data.data ?? []);
      else setLoadError("Packages could not be loaded. Nothing was changed.");
    } catch (err) {
      console.error("[Plans] Failed to load packages:", err);
      setLoadError("Packages could not be loaded. Nothing was changed.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    setIsLoading(true);
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isDemoMode, user?.id]);

  const counts = useMemo(
    () => ({
      PPPOE: plans.filter((p) => p.serviceType === "PPPOE").length,
      HOTSPOT: plans.filter((p) => p.serviceType === "HOTSPOT").length,
    }),
    [plans]
  );
  const filteredPlans = plans.filter((p) => p.serviceType === activeTab);

  const closeModal = () => {
    setIsModalOpen(false);
    setFormError(null);
  };

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Enter a package name.");
      return;
    }

    const validitySec = validityDays * 86400;
    const downKbps = downMbps * 1024;
    const upKbps = upMbps * 1024;

    const newPlan: ServicePlan = {
      id: `plan-${Date.now()}`,
      organizationId: "org-gtech-kenya-01",
      name: name.trim(),
      serviceType,
      downloadSpeedKbps: downKbps,
      uploadSpeedKbps: upKbps,
      priority: 8,
      validityDurationSeconds: validitySec,
      dataLimitMb: 0,
      price: priceKes,
      currency: "KES",
      simultaneousSessions: 1,
      mikrotikRateLimit: `${upKbps}k/${downKbps}k`,
      isActive: true,
      subscriberCount: 0,
      createdAt: new Date().toISOString(),
    };

    setPlans([...plans, newPlan]);
    setIsModalOpen(false);
    setName("");
  };

  return (
    <AppShell title="Packages">
      <PageHeader
        title="Packages"
        description="Manage PPPoE and Hotspot plans, speed limits, and pricing."
        actions={
          <button onClick={() => setIsModalOpen(true)} className={btnClass("primary")}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New package
          </button>
        }
      />

      {loadError && <ErrorState title="Could not load packages" detail={loadError} onRetry={loadPlans} />}

      <section className="rounded-lg border border-border bg-surface shadow-xs">
        <div className="border-b border-border p-3">
          <div role="tablist" aria-label="Service type" className="inline-flex rounded-md border border-border p-0.5">
            {TABS.map((t) => (
              <button
                key={t.value}
                role="tab"
                aria-selected={activeTab === t.value}
                onClick={() => setActiveTab(t.value)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded px-3 text-sm transition-colors",
                  activeTab === t.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                <span className="tabular text-xs opacity-80">{counts[t.value]}</span>
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : filteredPlans.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={`No ${activeTab === "PPPOE" ? "PPPoE" : "hotspot"} packages yet`}
            description="Packages define the speed, validity and price a subscriber buys."
            action={
              <button onClick={() => setIsModalOpen(true)} className={btnClass("primary")}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                New package
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="border-b border-border bg-surface-subtle text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Package</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Price</th>
                  <th scope="col" className="px-3 py-2 font-medium">Validity</th>
                  <th scope="col" className="px-3 py-2 font-medium">Download / Upload</th>
                  <th scope="col" className="px-3 py-2 font-medium">MikroTik rate limit</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Subscribers</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredPlans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-surface-subtle">
                    <td className="px-3 py-2 font-medium">{plan.name}</td>
                    <td className="tabular px-3 py-2 text-right font-medium">{formatKES(plan.price)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDuration(plan.validityDurationSeconds)}</td>
                    <td className="tabular px-3 py-2">
                      {formatSpeed(plan.downloadSpeedKbps)} <span className="text-muted-foreground">/</span>{" "}
                      {formatSpeed(plan.uploadSpeedKbps)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{plan.mikrotikRateLimit}</td>
                    <td className="tabular px-3 py-2 text-right">{plan.subscriberCount ?? 0}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={plan.isActive ? "ACTIVE" : "DISABLED"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isModalOpen && (
        <PlanDialog
          onClose={closeModal}
          onSubmit={handleCreatePlan}
          error={formError}
          v={{ name, serviceType, downMbps, upMbps, priceKes, validityDays }}
          set={{ setName, setServiceType, setDownMbps, setUpMbps, setPriceKes, setValidityDays }}
        />
      )}
    </AppShell>
  );
}

function PlanDialog({
  onClose,
  onSubmit,
  error,
  v,
  set,
}: {
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  error: string | null;
  v: { name: string; serviceType: ServiceType; downMbps: number; upMbps: number; priceKes: number; validityDays: number };
  set: {
    setName: (x: string) => void;
    setServiceType: (x: ServiceType) => void;
    setDownMbps: (x: number) => void;
    setUpMbps: (x: number) => void;
    setPriceKes: (x: number) => void;
    setValidityDays: (x: number) => void;
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
  const legend = "mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-title"
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-xl border border-border bg-surface shadow-[var(--shadow-pop)] sm:rounded-lg"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 id="plan-title" className="text-base font-semibold">New package</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-elevated"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 p-4">
          {error && <ErrorState title="Package not created" detail={error} />}

          <fieldset className="space-y-3">
            <legend className={legend}>Details</legend>
            <div>
              <label htmlFor="plan-name" className={label}>Package name</label>
              <input
                id="plan-name"
                ref={firstRef}
                type="text"
                required
                placeholder="e.g. Home 10 Mbps"
                value={v.name}
                onChange={(e) => set.setName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="plan-type" className={label}>Service type</label>
                <select
                  id="plan-type"
                  value={v.serviceType}
                  onChange={(e) => set.setServiceType(e.target.value as ServiceType)}
                  className={inputClass}
                >
                  <option value="PPPOE">PPPoE</option>
                  <option value="HOTSPOT">Hotspot</option>
                </select>
              </div>
              <div>
                <label htmlFor="plan-validity" className={label}>Validity (days)</label>
                <input
                  id="plan-validity"
                  type="number"
                  min={1}
                  required
                  value={v.validityDays}
                  onChange={(e) => set.setValidityDays(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className={legend}>Speed and price</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="plan-down" className={label}>Download (Mbps)</label>
                <input
                  id="plan-down"
                  type="number"
                  min={1}
                  required
                  value={v.downMbps}
                  onChange={(e) => set.setDownMbps(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="plan-up" className={label}>Upload (Mbps)</label>
                <input
                  id="plan-up"
                  type="number"
                  min={1}
                  required
                  value={v.upMbps}
                  onChange={(e) => set.setUpMbps(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label htmlFor="plan-price" className={label}>Price (KES)</label>
              <input
                id="plan-price"
                type="number"
                min={0}
                required
                value={v.priceKes}
                onChange={(e) => set.setPriceKes(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </fieldset>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <button type="button" onClick={onClose} className={btnClass("secondary")}>Cancel</button>
            <button type="submit" className={btnClass("primary")}>Save package</button>
          </div>
        </form>
      </div>
    </div>
  );
}
