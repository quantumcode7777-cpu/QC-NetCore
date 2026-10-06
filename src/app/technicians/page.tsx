"use client";
import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  Wrench,
  Plus,
  CheckCircle2,
  MapPin,
  Phone,
  User,
  X,
} from "lucide-react";
import { SEED_WORK_ORDERS } from "@/lib/db/mock-db";
import { WorkOrder, WorkOrderStatus } from "@/types";
import { GlassCard, GlassCardContent } from "@/components/ui/GlassCard";
import { GlassBadge } from "@/components/ui/GlassBadge";
import { useAuth } from "@/lib/auth/auth-context";

export default function TechniciansPage() {
  const { isDemoMode, user, profile } = useAuth();
  const [orders, setOrders] = useState<WorkOrder[]>(() =>
    isDemoMode ? SEED_WORK_ORDERS : []
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setOrders(isDemoMode ? SEED_WORK_ORDERS : []);
  }, [isDemoMode]);

  // Form State
  const [title, setTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [description, setDescription] = useState("");
  const [orderType] = useState<"INSTALLATION" | "REPAIR">("INSTALLATION");
  const [priority] = useState<"NORMAL" | "HIGH" | "CRITICAL">("NORMAL");

  const handleUpdateStatus = (id: string, newStatus: WorkOrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o))
    );
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const newOrder: WorkOrder = {
      id: `wo-${Date.now()}`,
      organizationId: profile?.organization_id || "org-live",
      ticketNumber: `WO-${new Date().getFullYear()}-00${orders.length + 1}`,
      customerName,
      customerPhone,
      customerAddress,
      assignedTechnicianId: user?.id || "tech-assigned",
      assignedTechnicianName: profile?.full_name || "Field Technician",
      title,
      description,
      orderType,
      priority,
      status: "ASSIGNED",
      scheduledDate: new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
    };

    setOrders([newOrder, ...orders]);
    setIsModalOpen(false);
    setTitle("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setDescription("");
  };

  return (
    <AppShell title="Technician & Field Work Orders">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
            Field Operations &amp; Work Orders
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dispatch technicians, track installations, and monitor fiber repairs.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold shadow-brand-btn transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Work Order</span>
        </button>
      </div>

      {/* Work Orders Grid */}
      {orders.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center text-xs text-muted-foreground">
          No field installations recorded.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {orders.map((order) => (
            <GlassCard key={order.id} className="flex flex-col justify-between" hoverEffect>
              <GlassCardContent className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-extrabold text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                      {order.ticketNumber}
                    </span>
                    <h3 className="font-extrabold text-foreground text-base mt-2">
                      {order.title}
                    </h3>
                  </div>
                  <GlassBadge
                    variant={
                      order.priority === "CRITICAL"
                        ? "destructive"
                        : order.priority === "HIGH"
                        ? "warning"
                        : "neutral"
                    }
                    size="sm"
                  >
                    {order.priority}
                  </GlassBadge>
                </div>

                <p className="text-xs text-foreground mt-2 leading-relaxed bg-surface-elevated/60 p-3.5 rounded-xl border border-border">
                  {order.description}
                </p>

                {/* Customer and Location Info */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-bold text-foreground">{order.customerName}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-foreground">{order.customerPhone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{order.customerAddress}</span>
                  </div>
                </div>
              </GlassCardContent>

              {/* Status & Actions */}
              <div className="p-4 border-t border-border bg-surface-elevated/40 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Tech: <span className="font-bold text-primary">{order.assignedTechnicianName}</span>
                </div>
                <div className="flex items-center gap-2">
                  {order.status !== "COMPLETED" ? (
                    <button
                      onClick={() => handleUpdateStatus(order.id, "COMPLETED")}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Done</span>
                    </button>
                  ) : (
                    <GlassBadge variant="success" size="sm">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Completed</span>
                    </GlassBadge>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* New Work Order Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-elevated/70">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary" />
                <h3 className="font-extrabold text-foreground text-base">New Field Work Order</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Ticket Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fiber Line Cut / ONU Replacement"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Customer Phone *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="0712345678"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-sm text-foreground focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Physical Installation Address
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Parklands, 3rd Parklands Ave, House 14"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Technical Instructions
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Optical power threshold, ONU serial numbers, drop cable route..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-elevated border border-border text-xs text-foreground focus:outline-none focus:border-primary leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface hover:bg-surface-elevated border border-border text-foreground text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold shadow-brand-btn transition"
                >
                  Dispatch Work Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
