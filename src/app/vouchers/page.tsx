"use client";
import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  Ticket,
  Plus,
  Printer,
  Search,
  CheckCircle2,
  Wifi,
  X,
} from "lucide-react";
import {
  SEED_HOTSPOT_VOUCHERS,
  SEED_VOUCHER_BATCHES,
  SEED_PLANS,
  SEED_ORGANIZATION,
} from "@/lib/db/mock-db";
import { HotspotVoucher, ServicePlan, VoucherBatch } from "@/types";
import { VoucherGenerator } from "@/lib/vouchers/generator";
import { formatKES, formatShortDate } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassBadge } from "@/components/ui/GlassBadge";
import { useAuth } from "@/lib/auth/auth-context";

export default function VouchersPage() {
  const { isDemoMode, profile } = useAuth();
  const [vouchers, setVouchers] = useState<HotspotVoucher[]>(() =>
    isDemoMode ? SEED_HOTSPOT_VOUCHERS : []
  );
  const [batches, setBatches] = useState<VoucherBatch[]>(() =>
    isDemoMode ? SEED_VOUCHER_BATCHES : []
  );
  const [hotspotPlans, setHotspotPlans] = useState<ServicePlan[]>(() =>
    isDemoMode ? SEED_PLANS.filter((p) => p.serviceType === "HOTSPOT") : []
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Form State
  const [selectedPlanId, setSelectedPlanId] = useState(
    isDemoMode
      ? SEED_PLANS.find((p) => p.serviceType === "HOTSPOT")?.id || ""
      : ""
  );
  const [quantity, setQuantity] = useState(20);
  const [prefix, setPrefix] = useState("VC");

  useEffect(() => {
    if (isDemoMode) {
      const demoPlans = SEED_PLANS.filter((p) => p.serviceType === "HOTSPOT");
      setVouchers(SEED_HOTSPOT_VOUCHERS);
      setBatches(SEED_VOUCHER_BATCHES);
      setHotspotPlans(demoPlans);
      setSelectedPlanId(demoPlans[0]?.id || "");
      return;
    }

    setVouchers([]);
    setBatches([]);
    setHotspotPlans([]);
    setSelectedPlanId("");

    let cancelled = false;
    fetch("/api/v1/service-plans?type=HOTSPOT", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        const loaded = Array.isArray(json?.data)
          ? (json.data as ServicePlan[])
          : [];
        setHotspotPlans(loaded);
        if (loaded.length > 0) {
          setSelectedPlanId(loaded[0].id);
        }
      })
      .catch(() => {
        // Leave plans empty on error for real accounts
      });

    return () => {
      cancelled = true;
    };
  }, [isDemoMode]);

  const filteredVouchers = vouchers.filter((v) => {
    const matchesSearch = v.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleGenerateBatch = (e: React.FormEvent) => {
    e.preventDefault();
    const plan = hotspotPlans.find((p) => p.id === selectedPlanId);
    if (!plan) return;

    const orgId = isDemoMode
      ? SEED_ORGANIZATION.id
      : profile?.organization_id || "org-live";
    const newBatchId = `batch-${Date.now()}`;
    const newBatch: VoucherBatch = {
      id: newBatchId,
      organizationId: orgId,
      planId: plan.id,
      planName: `${plan.name} (${formatKES(plan.price)})`,
      batchName: `${plan.name} - ${quantity}x Batch`,
      quantity,
      prefix,
      generatedByName: profile?.full_name || "Operator",
      createdAt: new Date().toISOString(),
    };

    const newVouchers = VoucherGenerator.generateVoucherBatch({
      organizationId: orgId,
      batchId: newBatchId,
      plan,
      quantity,
      prefix,
    });

    setBatches([newBatch, ...batches]);
    setVouchers([...newVouchers, ...vouchers]);
    setIsGenerateModalOpen(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppShell title="Hotspot Vouchers & Batch Printing">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
            Hotspot Vouchers
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generate batch voucher codes and print POS receipts or A4 cards.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface hover:bg-surface-elevated text-foreground text-xs font-bold border border-border shadow-xs transition"
          >
            <Printer className="w-4 h-4 text-emerald-500" />
            <span>Print Cards / POS</span>
          </button>
          <button
            onClick={() => setIsGenerateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold shadow-brand-btn transition"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Batch</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-surface border border-border shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search voucher code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-surface-elevated border border-border text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {["ALL", "AVAILABLE", "USED", "EXPIRED"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                statusFilter === status
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-surface-elevated text-muted-foreground hover:text-foreground border border-border"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Vouchers Table */}
      <GlassCard>
        {filteredVouchers.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No hotspot vouchers found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-foreground">
              <thead className="border-b border-border text-[11px] uppercase text-muted-foreground font-bold bg-surface-elevated/50">
                <tr>
                  <th className="py-3 px-4">Voucher Code</th>
                  <th className="py-3 px-4">Plan / Duration</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Usage Details</th>
                  <th className="py-3 px-4">Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {filteredVouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-surface-elevated/40 transition">
                    <td className="py-3.5 px-4">
                      <span className="font-extrabold text-primary tracking-wider bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                        {v.code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-sans text-foreground">
                      <div className="font-bold">{v.planName}</div>
                      <div className="text-[10px] text-muted-foreground">{v.planDuration}</div>
                    </td>
                    <td className="py-3.5 px-4 font-sans font-extrabold text-emerald-500">
                      {formatKES(v.planPrice || 10)}
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      <GlassBadge
                        variant={
                          v.status === "AVAILABLE"
                            ? "success"
                            : v.status === "USED"
                            ? "primary"
                            : "neutral"
                        }
                        size="sm"
                      >
                        {v.status === "AVAILABLE" && <CheckCircle2 className="w-3 h-3" />}
                        <span>{v.status}</span>
                      </GlassBadge>
                    </td>
                    <td className="py-3.5 px-4 text-[11px] text-muted-foreground font-sans">
                      {v.usedByPhone ? (
                        <div>
                          <span className="text-foreground font-semibold">Used by {v.usedByPhone}</span>
                          <div className="text-[10px] font-mono text-muted-foreground">{v.usedMacAddress}</div>
                        </div>
                      ) : (
                        <span className="italic text-muted-foreground">Unused</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-sans text-muted-foreground">
                      {formatShortDate(v.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Generate Batch Modal */}
      {isGenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated/70">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-primary" />
                <h3 className="font-extrabold text-foreground text-base">Generate Voucher Batch</h3>
              </div>
              <button
                onClick={() => setIsGenerateModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateBatch} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Hotspot Package *
                </label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                >
                  {hotspotPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} ({formatKES(plan.price)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Quantity *
                  </label>
                  <select
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                  >
                    <option value={10}>10 Vouchers</option>
                    <option value={25}>25 Vouchers</option>
                    <option value={50}>50 Vouchers</option>
                    <option value={100}>100 Vouchers</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Prefix
                  </label>
                  <input
                    type="text"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-sm text-foreground focus:outline-none focus:border-primary font-mono uppercase"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGenerateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface hover:bg-surface-elevated border border-border text-foreground text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold shadow-brand-btn transition"
                >
                  Generate {quantity} Tokens
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated/70 no-print">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-500" />
                <h3 className="font-extrabold text-foreground text-base">
                  Voucher Print Sheet (A4 &amp; POS Thermal Preview)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Now</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 flex-1 overflow-y-auto bg-surface-subtle">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {vouchers.slice(0, 12).map((v) => (
                  <div
                    key={v.id}
                    className="voucher-card p-4 rounded-xl bg-surface border border-dashed border-border text-foreground flex flex-col justify-between space-y-2.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-border pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Wifi className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[11px] font-bold tracking-tight">QC NETCORE WIFI</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-500">
                        {formatKES(v.planPrice || 10)}
                      </span>
                    </div>

                    <div className="text-center py-1">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Voucher Code
                      </div>
                      <div className="font-mono text-sm font-extrabold text-foreground tracking-wider mt-0.5">
                        {v.code}
                      </div>
                    </div>

                    <div className="border-t border-border pt-1 text-[9px] text-muted-foreground text-center leading-tight">
                      <div>Plan: {v.planName}</div>
                      <div>SSID: <span className="font-bold text-foreground">QC_NetCore_FreeWiFi</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
