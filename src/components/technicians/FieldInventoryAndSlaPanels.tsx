"use client";

import React, { useEffect, useState } from "react";
import {
  Package,
  Headphones,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  X,
} from "lucide-react";
import { cn, formatKES } from "@/lib/utils";
import { btnClass } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth/auth-context";
import {
  SEED_INVENTORY_ITEMS,
  SEED_SERIALIZED_ASSETS,
  SEED_SUPPORT_TICKETS,
} from "@/lib/db/os-2027-seed";
import {
  validateInstallationSignoff,
  computeInventorySummary,
  evaluateTicketSla,
  SupportTicketRecord,
} from "@/lib/operations/field-inventory-support";

export function FieldInventoryAndSlaPanels() {
  const { isDemoMode, profile } = useAuth();
  const inventoryItems = isDemoMode ? SEED_INVENTORY_ITEMS : [];
  const serializedAssets = isDemoMode ? SEED_SERIALIZED_ASSETS : [];
  const [tickets, setTickets] = useState<SupportTicketRecord[]>(() =>
    isDemoMode ? SEED_SUPPORT_TICKETS : []
  );

  useEffect(() => {
    setTickets(isDemoMode ? SEED_SUPPORT_TICKETS : []);
  }, [isDemoMode]);

  const [isProofOpen, setIsProofOpen] = useState(false);
  const [onuSerial, setOnuSerial] = useState("");
  const [rxDbm, setRxDbm] = useState("");
  const [dropMeters, setDropMeters] = useState("");
  const [napCode, setNapCode] = useState("");
  const [napPort, setNapPort] = useState("");
  const [gps, setGps] = useState("");
  const [signoffName, setSignoffName] = useState("");
  const [proofResult, setProofResult] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);

  const invSummary = computeInventorySummary(inventoryItems);

  const handleValidateProof = (e: React.FormEvent) => {
    e.preventDefault();
    const res = validateInstallationSignoff({
      workOrderId: "wo-01",
      technicianName: profile?.full_name || "Technician",
      onuSerialNumber: onuSerial,
      measuredRxDbm: Number(rxDbm),
      dropCableMeters: Number(dropMeters),
      napBoxCode: napCode,
      napPortNumber: Number(napPort),
      gpsCoordinates: gps,
      customerSignoffName: signoffName,
    });

    if (res.valid) {
      setProofResult({
        valid: true,
        message: `Proof-of-Installation verified (${res.opticalQuality} optical power ${rxDbm} dBm). ONU ${onuSerial} bound to ${napCode}:${napPort} and subscriber activated.`,
      });
    } else {
      setProofResult({
        valid: false,
        message: res.errors.join(" "),
      });
    }
  };

  const handleResolveTicket = (id: string) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              status: "RESOLVED",
              resolvedAt: new Date().toISOString(),
            }
          : t
      )
    );
  };

  return (
    <div className="space-y-6 pt-2">
      {/* Field Commissioning Proof-of-Installation Banner — Demo Mode Only */}
      {isDemoMode && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">
                Field Proof-of-Installation &amp; Optical Commissioning Gate
              </h3>
              <p className="text-xs text-muted-foreground">
                Requires ITU-T optical RX verification (-8.0 to -26.5 dBm), ONU
                serial binding, NAP splitter port, and GPS coordinates before
                closing an installation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setProofResult(null);
              setIsProofOpen(true);
            }}
            className={btnClass("primary", "h-9 text-xs")}
          >
            <ClipboardCheck className="h-4 w-4" />
            Submit Proof-of-Installation
          </button>
        </section>
      )}

      {/* Hardware & Fiber Inventory Ledger */}
      <section className="rounded-lg border border-border bg-surface shadow-xs">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <div>
              <h3 className="text-sm font-semibold">
                Hardware, ONU &amp; Fiber Inventory Ledger
              </h3>
              <p className="text-xs text-muted-foreground">
                Total Stock Valuation:{" "}
                <strong className="text-foreground">
                  {formatKES(invSummary.totalValuationKes)}
                </strong>{" "}
                · {invSummary.lowStockItems.length} SKU(s) at or below reorder
                threshold.
              </p>
            </div>
          </div>
        </header>
        {inventoryItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No inventory records configured yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-subtle text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">SKU</th>
                  <th className="px-3 py-2 font-medium">Item Description</th>
                  <th className="px-3 py-2 font-medium">Location</th>
                  <th className="px-3 py-2 text-right font-medium">On Hand</th>
                  <th className="px-3 py-2 text-right font-medium">Unit Cost</th>
                  <th className="px-3 py-2 font-medium">Stock Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {inventoryItems.map((item) => {
                  const low = item.quantityOnHand <= item.reorderThreshold;
                  return (
                    <tr key={item.id} className="hover:bg-surface-subtle">
                      <td className="px-3 py-2 font-mono text-xs font-semibold text-primary">
                        {item.sku}
                      </td>
                      <td className="px-3 py-2 font-medium">{item.name}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {item.warehouseLocation}
                      </td>
                      <td className="tabular px-3 py-2 text-right font-mono text-xs font-semibold">
                        {item.quantityOnHand} {item.unitOfMeasure}
                      </td>
                      <td className="tabular px-3 py-2 text-right text-xs">
                        {formatKES(item.unitCostKes)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "rounded px-2 py-0.5 text-xs font-semibold",
                            low
                              ? "bg-warning-soft text-warning"
                              : "bg-success-soft text-success"
                          )}
                        >
                          {low ? "REORDER NEEDED" : "IN STOCK"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Serialized CPE / ONT Tracking */}
        <div className="border-t border-border bg-surface-subtle px-4 py-3">
          <div className="text-xs font-semibold text-foreground">
            Serialized Asset Custody (Warehouse &rarr; Technician Van &rarr;
            Subscriber)
          </div>
          {serializedAssets.length === 0 ? (
            <div className="mt-2 py-3 text-xs text-muted-foreground">
              No serialized assets recorded.
            </div>
          ) : (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {serializedAssets.map((ast) => (
                <div
                  key={ast.id}
                  className="rounded border border-border bg-surface p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between font-mono font-semibold">
                    <span>{ast.serialNumber}</span>
                    <span className="text-[11px] text-primary">{ast.status}</span>
                  </div>
                  <div className="mt-0.5 text-muted-foreground">
                    {ast.itemName} ·{" "}
                    {ast.assignedCustomerName
                      ? `${ast.assignedCustomerName} (${ast.assignedAccountNumber})`
                      : `Van: ${ast.assignedTechnicianName}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Omnichannel SLA Support Ticketing Queue */}
      <section className="rounded-lg border border-border bg-surface shadow-xs">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Headphones className="h-4 w-4 text-primary" />
            <div>
              <h3 className="text-sm font-semibold">
                Omnichannel Support &amp; NOC SLA Ticketing Queue
              </h3>
              <p className="text-xs text-muted-foreground">
                Correlated tickets from WhatsApp, Subscriber Portal, and
                automated OLT LOS alarms with SLA countdowns.
              </p>
            </div>
          </div>
        </header>
        {tickets.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No active support tickets.
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {tickets.map((tkt) => {
              const sla = evaluateTicketSla(tkt);
              return (
                <div
                  key={tkt.id}
                  className="flex flex-col justify-between gap-3 p-4 text-xs sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold text-primary">
                        {tkt.ticketNumber}
                      </span>
                      <span className="rounded border border-border px-1.5 py-0.5">
                        {tkt.channel}
                      </span>
                      <span className="font-semibold text-foreground">
                        {tkt.subject}
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      <strong>{tkt.customerName}</strong> ({tkt.accountNumber}) —{" "}
                      {tkt.description}
                    </p>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span
                        className={cn(
                          "font-semibold",
                          sla.isBreached ? "text-danger" : "text-success"
                        )}
                      >
                        SLA: {sla.slaLabel}
                      </span>
                      <span className="text-muted-foreground">
                        Status: {tkt.status}
                      </span>
                    </div>
                  </div>
                  <div>
                    {tkt.status !== "RESOLVED" ? (
                      <button
                        type="button"
                        onClick={() => handleResolveTicket(tkt.id)}
                        className={btnClass("secondary", "h-8 px-3 text-xs")}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Resolve Ticket
                      </button>
                    ) : (
                      <span className="rounded bg-success-soft px-2 py-1 font-semibold text-success">
                        Resolved
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Proof-of-Installation Modal — Demo Mode Only */}
      {isDemoMode && isProofOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Proof of Installation"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-pop)]">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-semibold">
                Field Proof-of-Installation Commissioning
              </h3>
              <button
                type="button"
                onClick={() => setIsProofOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              onSubmit={handleValidateProof}
              className="mt-3 space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium">
                    ONU Serial Number
                  </label>
                  <input
                    type="text"
                    required
                    value={onuSerial}
                    onChange={(e) => setOnuSerial(e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium">
                    Measured Optical RX (dBm)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={rxDbm}
                    onChange={(e) => setRxDbm(e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block font-medium">NAP Box</label>
                  <input
                    type="text"
                    required
                    value={napCode}
                    onChange={(e) => setNapCode(e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium">NAP Port</label>
                  <input
                    type="number"
                    required
                    value={napPort}
                    onChange={(e) => setNapPort(e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium">Drop (m)</label>
                  <input
                    type="number"
                    required
                    value={dropMeters}
                    onChange={(e) => setDropMeters(e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium">
                    GPS Coordinates
                  </label>
                  <input
                    type="text"
                    required
                    value={gps}
                    onChange={(e) => setGps(e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium">
                    Customer Sign-off Name
                  </label>
                  <input
                    type="text"
                    required
                    value={signoffName}
                    onChange={(e) => setSignoffName(e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-surface px-2.5 text-xs"
                  />
                </div>
              </div>

              {proofResult && (
                <div
                  className={cn(
                    "rounded-md border p-2.5 text-xs",
                    proofResult.valid
                      ? "border-success/30 bg-success-soft text-success"
                      : "border-danger/30 bg-danger-soft text-danger"
                  )}
                >
                  {proofResult.valid ? (
                    <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                  ) : (
                    <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                  )}
                  {proofResult.message}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => setIsProofOpen(false)}
                  className={btnClass("secondary", "h-8 text-xs")}
                >
                  Close
                </button>
                <button
                  type="submit"
                  className={btnClass("primary", "h-8 text-xs")}
                >
                  Verify &amp; Commission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
