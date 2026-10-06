// ============================================================================
// QC NETCORE — FIELD PROOF-OF-INSTALLATION, INVENTORY & SLA TICKETING ENGINE
// ============================================================================

export interface InventoryItemRecord {
  id: string;
  organizationId: string;
  sku: string;
  name: string;
  category:
    | "ONU_ONT"
    | "CPE_ROUTER"
    | "FIBER_CABLE"
    | "SPLITTER_NAP"
    | "SFP_OPTICS"
    | "CONSUMABLE";
  unitOfMeasure: "UNIT" | "METERS";
  quantityOnHand: number;
  reorderThreshold: number;
  unitCostKes: number;
  warehouseLocation: string;
}

export interface SerializedAssetRecord {
  id: string;
  sku: string;
  itemName: string;
  serialNumber: string;
  macAddress?: string;
  status: "IN_WAREHOUSE" | "ON_TECH_VAN" | "ASSIGNED_SUBSCRIBER" | "FAULTY_RMA";
  assignedTechnicianName?: string;
  assignedCustomerName?: string;
  assignedAccountNumber?: string;
  updatedAt: string;
}

export interface InstallationProofInput {
  workOrderId: string;
  technicianName: string;
  onuSerialNumber: string;
  measuredRxDbm: number;
  dropCableMeters: number;
  napBoxCode: string;
  napPortNumber: number;
  gpsCoordinates: string;
  customerSignoffName: string;
}

export interface SupportTicketRecord {
  id: string;
  organizationId: string;
  ticketNumber: string;
  customerId?: string;
  customerName: string;
  accountNumber?: string;
  channel: "PORTAL" | "WHATSAPP" | "PHONE" | "NOC_AUTO";
  category:
    | "NO_INTERNET"
    | "SLOW_SPEED"
    | "LOS_RED_LIGHT"
    | "BILLING_QUERY"
    | "ROUTER_WIFI"
    | "RELOCATION";
  priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  status: "OPEN" | "IN_PROGRESS" | "ESCALATED_FIELD" | "RESOLVED" | "CLOSED";
  subject: string;
  description: string;
  linkedOutageId?: string;
  slaDueAt: string;
  resolvedAt?: string;
  createdAt: string;
}

/**
 * Validates field technician Proof-of-Installation before allowing a work order
 * to transition to COMPLETED. Enforces ITU-T optical budget (-8.0 to -26.5 dBm).
 */
export function validateInstallationSignoff(input: InstallationProofInput): {
  valid: boolean;
  errors: string[];
  opticalQuality: "OPTIMAL" | "MARGINAL" | "REJECTED";
} {
  const errors: string[] = [];

  if (!input.onuSerialNumber || input.onuSerialNumber.trim().length < 6) {
    errors.push("ONU/ONT serial number must be at least 6 characters (e.g. HWTC8921A4B2).");
  }

  if (!Number.isFinite(input.measuredRxDbm)) {
    errors.push("Measured optical RX power (dBm) is required.");
  } else if (input.measuredRxDbm < -26.5) {
    errors.push(
      `Measured RX power (${input.measuredRxDbm} dBm) is worse than -26.5 dBm commissioning limit. Re-splice drop cable.`
    );
  } else if (input.measuredRxDbm > -7.0) {
    errors.push(
      `Measured RX power (${input.measuredRxDbm} dBm) exceeds -7.0 dBm receiver saturation threshold.`
    );
  }

  if (!Number.isFinite(input.dropCableMeters) || input.dropCableMeters <= 0 || input.dropCableMeters > 500) {
    errors.push("Drop fiber cable length must be between 1 and 500 meters.");
  }

  if (!input.gpsCoordinates || !input.gpsCoordinates.includes(",")) {
    errors.push("Valid GPS coordinates (lat, lng) are required for GIS service location registry.");
  }

  if (!input.customerSignoffName || input.customerSignoffName.trim().length < 2) {
    errors.push("Customer sign-off name is required to close installation.");
  }

  let opticalQuality: "OPTIMAL" | "MARGINAL" | "REJECTED" = "OPTIMAL";
  if (input.measuredRxDbm < -26.5 || input.measuredRxDbm > -7.0) {
    opticalQuality = "REJECTED";
  } else if (input.measuredRxDbm < -24.5) {
    opticalQuality = "MARGINAL";
  }

  return {
    valid: errors.length === 0,
    errors,
    opticalQuality,
  };
}

/**
 * Computes total warehouse inventory valuation and identifies low-stock items needing reorder.
 */
export function computeInventorySummary(items: InventoryItemRecord[]): {
  totalValuationKes: number;
  totalSkus: number;
  lowStockItems: InventoryItemRecord[];
} {
  let totalValuationKes = 0;
  const lowStockItems: InventoryItemRecord[] = [];

  for (const item of items) {
    totalValuationKes += item.quantityOnHand * item.unitCostKes;
    if (item.quantityOnHand <= item.reorderThreshold) {
      lowStockItems.push(item);
    }
  }

  return {
    totalValuationKes: Math.round(totalValuationKes * 100) / 100,
    totalSkus: items.length,
    lowStockItems,
  };
}

export const SLA_HOURS_BY_PRIORITY: Record<SupportTicketRecord["priority"], number> = {
  CRITICAL: 4,
  HIGH: 8,
  NORMAL: 24,
  LOW: 48,
};

/**
 * Evaluates SLA countdown and breach status for a support ticket.
 */
export function evaluateTicketSla(
  ticket: SupportTicketRecord,
  now: Date = new Date()
): {
  isBreached: boolean;
  remainingMinutes: number;
  slaLabel: string;
} {
  const dueMs = new Date(ticket.slaDueAt).getTime();
  const refMs = ticket.resolvedAt
    ? new Date(ticket.resolvedAt).getTime()
    : now.getTime();
  const diffMinutes = Math.round((dueMs - refMs) / 60_000);

  if (diffMinutes < 0) {
    const overdueHrs = Math.abs(Math.round((diffMinutes / 60) * 10) / 10);
    return {
      isBreached: true,
      remainingMinutes: diffMinutes,
      slaLabel: `SLA Breached (${overdueHrs}h overdue)`,
    };
  }

  const hrs = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  return {
    isBreached: false,
    remainingMinutes: diffMinutes,
    slaLabel:
      ticket.status === "RESOLVED" || ticket.status === "CLOSED"
        ? "SLA Met"
        : `${hrs}h ${mins}m remaining`,
  };
}
