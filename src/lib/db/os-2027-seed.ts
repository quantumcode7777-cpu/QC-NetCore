// ============================================================================
// QC NETCORE — 2027 ISP OPERATING SYSTEM UNIFIED STATE & SEED DATASET
// Provides authoritative, interconnected records across Ledger, Reconciliation,
// Approvals, OLT/ONT Fiber, Inventory, SLA Tickets, Topology, GIS, and SOC.
// ============================================================================

import {
  SEED_ORGANIZATION,
  SEED_CUSTOMERS,
  SEED_PAYMENTS,
  SEED_ROUTERS,
  SEED_PPPOE,
  SEED_SUBSCRIPTIONS,
} from "./mock-db.ts";

import {
  type JournalEntry,
  postInvoiceToLedger,
  postPaymentToLedger,
  postCreditNoteToLedger,
  computeTrialBalance,
  computeArAgingBuckets,
  computeExecutiveRevenueMetrics,
} from "../ledger/ledger.ts";

import {
  type ApprovalRequestRecord,
  type PaymentReconciliationResult,
  reconcileIncomingPayment,
} from "../payments/reconciliation.ts";

import type {
  OltDevice,
  OntDevice,
} from "../network/olt-cpe.ts";

import type {
  InventoryItemRecord,
  SerializedAssetRecord,
  SupportTicketRecord,
} from "../operations/field-inventory-support.ts";

import type {
  TopologyNode,
  GisFiberNode,
  AutomationRule,
} from "../network/topology-gis-automation.ts";

import type {
  SystemEvent,
  SecurityEvent,
} from "../events/event-bus.ts";

import {
  computeConnectionQualityScore,
  predictSubscriberChurnRisk,
} from "../intelligence/subscriber-360.ts";

import type { CopilotContextSnapshot } from "../ai/copilot.ts";

export const SEED_INVOICES_2027 = [
  {
    id: "inv-2026-001",
    organizationId: SEED_ORGANIZATION.id,
    customerId: "cust-01",
    customerName: "John Kamau Mwangi",
    accountNumber: "GT-8921",
    invoiceNumber: "INV-2026-0891",
    subtotal: 2155.17,
    taxAmount: 344.83,
    totalAmount: 2500,
    amountPaid: 2500,
    balanceDue: 0,
    status: "PAID" as const,
    dueDate: new Date(Date.now() - 10 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: "inv-2026-002",
    organizationId: SEED_ORGANIZATION.id,
    customerId: "cust-02",
    customerName: "Grace Njeri Otieno",
    accountNumber: "GT-8922",
    invoiceNumber: "INV-2026-0892",
    subtotal: 3448.28,
    taxAmount: 551.72,
    totalAmount: 4000,
    amountPaid: 4000,
    balanceDue: 0,
    status: "PAID" as const,
    dueDate: new Date(Date.now() - 8 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
  {
    id: "inv-2026-003",
    organizationId: SEED_ORGANIZATION.id,
    customerId: "cust-03",
    customerName: "David Kipchumba Koech",
    accountNumber: "GT-8923",
    invoiceNumber: "INV-2026-0893",
    subtotal: 2155.17,
    taxAmount: 344.83,
    totalAmount: 2500,
    amountPaid: 0,
    balanceDue: 2500,
    status: "OVERDUE" as const,
    dueDate: new Date(Date.now() - 12 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: "inv-2026-004",
    organizationId: SEED_ORGANIZATION.id,
    customerId: "cust-05",
    customerName: "Ahmed Hassan Omar",
    accountNumber: "GT-8925",
    invoiceNumber: "INV-2026-0894",
    subtotal: 3448.28,
    taxAmount: 551.72,
    totalAmount: 4000,
    amountPaid: 0,
    balanceDue: 4000,
    status: "UNPAID" as const,
    dueDate: new Date(Date.now() - 42 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
  },
];

export function getSeedJournalEntries(): JournalEntry[] {
  const entries: JournalEntry[] = [];

  for (const inv of SEED_INVOICES_2027) {
    entries.push(
      postInvoiceToLedger({
        organizationId: SEED_ORGANIZATION.id,
        entryNumber: `JE-${inv.invoiceNumber.replace("INV-", "")}`,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerId: inv.customerId,
        customerName: inv.customerName,
        subtotal: inv.subtotal,
        taxAmount: inv.taxAmount,
        postedAt: inv.createdAt,
      })
    );
  }

  // Payments
  entries.push(
    postPaymentToLedger({
      organizationId: SEED_ORGANIZATION.id,
      entryNumber: "JE-PAY-9283",
      paymentId: "pay-01",
      transactionReference: "RKF9283KDJ",
      customerId: "cust-01",
      customerName: "John Kamau Mwangi",
      totalAmount: 2500,
      allocatedToAr: 2500,
      postedAt: SEED_PAYMENTS[0].createdAt,
    }),
    postPaymentToLedger({
      organizationId: SEED_ORGANIZATION.id,
      entryNumber: "JE-PAY-8841",
      paymentId: "pay-02",
      transactionReference: "RKF8841LPS",
      customerId: "cust-02",
      customerName: "Grace Njeri Otieno",
      totalAmount: 4000,
      allocatedToAr: 4000,
      postedAt: SEED_PAYMENTS[1].createdAt,
    }),
    postPaymentToLedger({
      organizationId: SEED_ORGANIZATION.id,
      entryNumber: "JE-PAY-7730",
      paymentId: "pay-03",
      transactionReference: "RKF7730MNQ",
      customerName: "Peter Maina (Hotspot)",
      totalAmount: 50,
      allocatedToAr: 0,
      directVoucherRevenue: 50,
      postedAt: SEED_PAYMENTS[2].createdAt,
    }),
    postPaymentToLedger({
      organizationId: SEED_ORGANIZATION.id,
      entryNumber: "JE-PAY-6612",
      paymentId: "pay-04",
      transactionReference: "RKF6612QAZ",
      customerName: "Alice Wanjiku (Hotspot)",
      totalAmount: 20,
      allocatedToAr: 0,
      directVoucherRevenue: 20,
      postedAt: SEED_PAYMENTS[3].createdAt,
    }),
    postCreditNoteToLedger({
      organizationId: SEED_ORGANIZATION.id,
      entryNumber: "JE-CN-0101",
      creditNoteId: "CN-2026-01",
      customerId: "cust-04",
      customerName: "Faith Wangari Ndung'u",
      amount: 250,
      reason: "SLA fiber cut downtime credit (Kilimani feeder)",
      postedBy: "Baraka Gackstone",
      postedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    })
  );

  return entries;
}

export function getSeedReconciliationQueue(): PaymentReconciliationResult[] {
  const subs = SEED_CUSTOMERS.map((c) => ({
    id: c.id,
    accountNumber: c.accountNumber,
    fullName: c.fullName,
    phoneNumber: c.phoneNumber,
    balanceDue: c.balanceDue,
    planPrice: 2500,
  }));

  const openInv = SEED_INVOICES_2027.filter((i) => i.balanceDue > 0);

  return [
    reconcileIncomingPayment({
      payment: {
        transactionReference: "RKF9283KDJ",
        channel: "MPESA_EXPRESS",
        amount: 2500,
        accountReference: "GT-8921",
        msisdnPhone: "254799112233",
      },
      subscribers: subs,
      openInvoices: openInv,
    }),
    reconcileIncomingPayment({
      payment: {
        transactionReference: "RKF8841LPS",
        channel: "MPESA_C2B",
        amount: 4000,
        accountReference: "GT-8922",
        msisdnPhone: "254712987654",
      },
      subscribers: subs,
      openInvoices: openInv,
    }),
    reconcileIncomingPayment({
      payment: {
        transactionReference: "RKF5519UNM",
        channel: "MPESA_C2B",
        amount: 2500,
        accountReference: "PLOT-4B-WIFI",
        msisdnPhone: "254701998877",
        senderName: "SAMUEL NJOROGE",
      },
      subscribers: subs,
      openInvoices: openInv,
    }),
    reconcileIncomingPayment({
      payment: {
        transactionReference: "RKF4410PRT",
        channel: "AIRTEL_MONEY",
        amount: 1200,
        accountReference: "GT-8923",
        msisdnPhone: "254720445566",
        senderName: "DAVID KOECH",
      },
      subscribers: subs,
      openInvoices: openInv,
    }),
  ];
}

export const SEED_APPROVAL_REQUESTS: ApprovalRequestRecord[] = [
  {
    id: "apr-01",
    organizationId: SEED_ORGANIZATION.id,
    requestNumber: "APR-2026-014",
    actionType: "WAIVER",
    targetEntityType: "customer",
    targetEntityId: "cust-03",
    targetLabel: "David Kipchumba Koech (GT-8923)",
    amount: 1250,
    reason: "50% goodwill waiver requested following 4-day office relocation outage",
    status: "PENDING",
    requestedById: "user-support-01",
    requestedByName: "Mercy Wambui (Support)",
    requestedByRole: "support",
    createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
  },
  {
    id: "apr-02",
    organizationId: SEED_ORGANIZATION.id,
    requestNumber: "APR-2026-013",
    actionType: "REFUND",
    targetEntityType: "payment",
    targetEntityId: "pay-02",
    targetLabel: "Grace Njeri Otieno (GT-8922)",
    amount: 1500,
    reason: "Accidental double M-Pesa Paybill transfer reversal request",
    status: "APPROVED",
    requestedById: "user-support-01",
    requestedByName: "Mercy Wambui (Support)",
    requestedByRole: "support",
    decidedById: "user-owner-01",
    decidedByName: "Baraka Gackstone",
    decisionNote: "Verified duplicate Paybill C2B entry on Safaricom statement.",
    decidedAt: new Date(Date.now() - 18 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 22 * 3600000).toISOString(),
  },
];

export const SEED_OLTS: OltDevice[] = [
  {
    id: "olt-01",
    organizationId: SEED_ORGANIZATION.id,
    siteId: "site-01",
    siteName: "Nairobi CBD - Tower POP",
    routerId: "rtr-01",
    name: "Huawei-MA5800-X7-CBD",
    vendor: "HUAWEI",
    model: "SmartAX MA5800-X7",
    managementIp: "10.200.1.10",
    ponType: "GPON",
    totalPonPorts: 16,
    activeOntCount: 54,
    cpuLoad: 18,
    temperatureC: 42.5,
    status: "ONLINE",
    lastPolledAt: new Date().toISOString(),
  },
  {
    id: "olt-02",
    organizationId: SEED_ORGANIZATION.id,
    siteId: "site-02",
    siteName: "Westlands - Ring Road Core",
    routerId: "rtr-02",
    name: "VSOL-V1600G1-Westlands",
    vendor: "VSOL",
    model: "V1600G1-B 8-Port GPON",
    managementIp: "10.200.1.11",
    ponType: "GPON",
    totalPonPorts: 8,
    activeOntCount: 27,
    cpuLoad: 24,
    temperatureC: 45.0,
    status: "ONLINE",
    lastPolledAt: new Date().toISOString(),
  },
];

export const SEED_ONTS: OntDevice[] = [
  {
    id: "ont-01",
    organizationId: SEED_ORGANIZATION.id,
    oltId: "olt-01",
    oltName: "Huawei-MA5800-X7-CBD",
    customerId: "cust-01",
    customerName: "John Kamau Mwangi",
    accountNumber: "GT-8921",
    serialNumber: "HWTC8921A4B2",
    vendorModel: "Huawei EchoLife HG8546M",
    ponPortLabel: "GPON 0/1/0:4",
    rxPowerDbm: -19.4,
    txPowerDbm: 2.3,
    oltRxPowerDbm: -21.0,
    temperatureC: 43.2,
    voltageV: 3.3,
    distanceMeters: 1180,
    serviceVlan: 210,
    status: "ONLINE",
    firmwareVersion: "V5R019C00S125",
    wifiSsid: "Kamau_Home_5G",
    connectedClients: 7,
    lastSeenAt: new Date().toISOString(),
  },
  {
    id: "ont-02",
    organizationId: SEED_ORGANIZATION.id,
    oltId: "olt-02",
    oltName: "VSOL-V1600G1-Westlands",
    customerId: "cust-02",
    customerName: "Grace Njeri Otieno",
    accountNumber: "GT-8922",
    serialNumber: "HWTC8922C9D1",
    vendorModel: "Huawei OptiXstar EG8145X6 (Wi-Fi 6)",
    ponPortLabel: "GPON 0/1/2:9",
    rxPowerDbm: -18.1,
    txPowerDbm: 2.5,
    oltRxPowerDbm: -19.8,
    temperatureC: 41.8,
    voltageV: 3.31,
    distanceMeters: 840,
    serviceVlan: 220,
    status: "ONLINE",
    firmwareVersion: "V5R021C00S110",
    wifiSsid: "GraceStudio_WiFi6",
    connectedClients: 12,
    lastSeenAt: new Date().toISOString(),
  },
  {
    id: "ont-03",
    organizationId: SEED_ORGANIZATION.id,
    oltId: "olt-01",
    oltName: "Huawei-MA5800-X7-CBD",
    customerId: "cust-03",
    customerName: "David Kipchumba Koech",
    accountNumber: "GT-8923",
    serialNumber: "ZTEG9081E3F4",
    vendorModel: "ZTE ZXHN F670L",
    ponPortLabel: "GPON 0/1/1:7",
    rxPowerDbm: -28.4,
    txPowerDbm: 2.1,
    oltRxPowerDbm: -29.8,
    temperatureC: 47.5,
    voltageV: 3.22,
    distanceMeters: 2410,
    serviceVlan: 210,
    status: "LOS",
    firmwareVersion: "V7.1.10P1N1",
    wifiSsid: "Koech_Consultants",
    connectedClients: 0,
    lastSeenAt: new Date(Date.now() - 4 * 3600000).toISOString(),
  },
  {
    id: "ont-04",
    organizationId: SEED_ORGANIZATION.id,
    oltId: "olt-01",
    oltName: "Huawei-MA5800-X7-CBD",
    customerId: "cust-04",
    customerName: "Faith Wangari Ndung'u",
    accountNumber: "GT-8924",
    serialNumber: "HWTC8924F7A8",
    vendorModel: "Huawei EchoLife HG8310M",
    ponPortLabel: "GPON 0/1/0:11",
    rxPowerDbm: -21.2,
    txPowerDbm: 2.2,
    oltRxPowerDbm: -22.6,
    temperatureC: 42.0,
    voltageV: 3.29,
    distanceMeters: 1520,
    serviceVlan: 210,
    status: "ONLINE",
    firmwareVersion: "V5R019C00S125",
    wifiSsid: "Wangari_Residence",
    connectedClients: 4,
    lastSeenAt: new Date().toISOString(),
  },
];

export const SEED_INVENTORY_ITEMS: InventoryItemRecord[] = [
  {
    id: "inv-item-01",
    organizationId: SEED_ORGANIZATION.id,
    sku: "ONT-HW-EG8145X6",
    name: "Huawei OptiXstar EG8145X6 Wi-Fi 6 GPON ONT",
    category: "ONU_ONT",
    unitOfMeasure: "UNIT",
    quantityOnHand: 18,
    reorderThreshold: 10,
    unitCostKes: 4800,
    warehouseLocation: "Nairobi Central Store — Shelf A1",
  },
  {
    id: "inv-item-02",
    organizationId: SEED_ORGANIZATION.id,
    sku: "ONT-HW-HG8546M",
    name: "Huawei EchoLife HG8546M Dual-Band ONU",
    category: "ONU_ONT",
    unitOfMeasure: "UNIT",
    quantityOnHand: 4,
    reorderThreshold: 8,
    unitCostKes: 2950,
    warehouseLocation: "Nairobi Central Store — Shelf A2",
  },
  {
    id: "inv-item-03",
    organizationId: SEED_ORGANIZATION.id,
    sku: "FBR-DROP-1C-GJYXFCH",
    name: "1-Core Flat Bow-Type Steel Messenger Drop Fiber (1km Drum)",
    category: "FIBER_CABLE",
    unitOfMeasure: "METERS",
    quantityOnHand: 2850,
    reorderThreshold: 1000,
    unitCostKes: 14,
    warehouseLocation: "Field Van #1 (Brian Kiprop)",
  },
  {
    id: "inv-item-04",
    organizationId: SEED_ORGANIZATION.id,
    sku: "NAP-16P-SCAPC",
    name: "16-Way IP65 Pole-Mount FAT/NAP Splitter Box (1:16 SC/APC)",
    category: "SPLITTER_NAP",
    unitOfMeasure: "UNIT",
    quantityOnHand: 9,
    reorderThreshold: 4,
    unitCostKes: 3600,
    warehouseLocation: "Nairobi Central Store — Bay C",
  },
  {
    id: "inv-item-05",
    organizationId: SEED_ORGANIZATION.id,
    sku: "SFP-GPON-CPLUS",
    name: "GPON OLT Class C+ Optical Transceiver Module (+4.5 dBm)",
    category: "SFP_OPTICS",
    unitOfMeasure: "UNIT",
    quantityOnHand: 3,
    reorderThreshold: 4,
    unitCostKes: 6200,
    warehouseLocation: "NOC Secure Locker",
  },
];

export const SEED_SERIALIZED_ASSETS: SerializedAssetRecord[] = [
  {
    id: "ast-01",
    sku: "ONT-HW-HG8546M",
    itemName: "Huawei EchoLife HG8546M",
    serialNumber: "HWTC8921A4B2",
    macAddress: "D4:6E:0E:12:34:56",
    status: "ASSIGNED_SUBSCRIBER",
    assignedCustomerName: "John Kamau Mwangi",
    assignedAccountNumber: "GT-8921",
    updatedAt: "2025-01-10T12:00:00Z",
  },
  {
    id: "ast-02",
    sku: "ONT-HW-EG8145X6",
    itemName: "Huawei OptiXstar EG8145X6",
    serialNumber: "HWTC8922C9D1",
    macAddress: "BC:24:11:98:76:54",
    status: "ASSIGNED_SUBSCRIBER",
    assignedCustomerName: "Grace Njeri Otieno",
    assignedAccountNumber: "GT-8922",
    updatedAt: "2025-01-14T09:30:00Z",
  },
  {
    id: "ast-03",
    sku: "ONT-HW-EG8145X6",
    itemName: "Huawei OptiXstar EG8145X6",
    serialNumber: "HWTC9901V8K2",
    macAddress: "A0:B1:C2:44:55:66",
    status: "ON_TECH_VAN",
    assignedTechnicianName: "Brian Kiprop",
    updatedAt: new Date().toISOString(),
  },
];

export const SEED_SUPPORT_TICKETS: SupportTicketRecord[] = [
  {
    id: "tkt-01",
    organizationId: SEED_ORGANIZATION.id,
    ticketNumber: "TKT-2026-401",
    customerId: "cust-03",
    customerName: "David Kipchumba Koech",
    accountNumber: "GT-8923",
    channel: "NOC_AUTO",
    category: "LOS_RED_LIGHT",
    priority: "CRITICAL",
    status: "ESCALATED_FIELD",
    subject: "ONT Optical LOS Alarm (-28.4 dBm) on GPON 0/1/1:7",
    description:
      "Automated NOC correlation raised ticket after ZTE F670L crossed -27.5 dBm threshold.",
    slaDueAt: new Date(Date.now() + 2 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: "tkt-02",
    organizationId: SEED_ORGANIZATION.id,
    ticketNumber: "TKT-2026-402",
    customerId: "cust-01",
    customerName: "John Kamau Mwangi",
    accountNumber: "GT-8921",
    channel: "WHATSAPP",
    category: "ROUTER_WIFI",
    priority: "NORMAL",
    status: "IN_PROGRESS",
    subject: "Request to update 5GHz Wi-Fi channel for smart TV streaming",
    description:
      "Subscriber requested remote TR-369 Wi-Fi channel optimization on Huawei HG8546M.",
    slaDueAt: new Date(Date.now() + 18 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
  },
];

export const SEED_TOPOLOGY_NODES: TopologyNode[] = [
  {
    id: "node-transit-01",
    nodeCode: "UPSTREAM-LIQUID-NBO",
    name: "Liquid Intelligent Tech — 10G Transit (AS30844)",
    nodeType: "UPSTREAM_TRANSIT",
    status: "ONLINE",
    subscriberCount: 81,
    latencyMs: 2.4,
    utilizationPercent: 34,
  },
  {
    id: "node-rtr-01",
    nodeCode: "BNG-CBD-CCR2004",
    name: "MikroTik-Core-CCR2004 (Nairobi CBD BNG)",
    nodeType: "CORE_ROUTER",
    parentNodeId: "node-transit-01",
    status: "ONLINE",
    subscriberCount: 62,
    latencyMs: 3.1,
    utilizationPercent: 28,
  },
  {
    id: "node-rtr-02",
    nodeCode: "BNG-WST-RB5009",
    name: "MikroTik-Westlands-RB5009",
    nodeType: "CORE_ROUTER",
    parentNodeId: "node-transit-01",
    status: "ONLINE",
    subscriberCount: 19,
    latencyMs: 3.8,
    utilizationPercent: 22,
  },
  {
    id: "node-olt-01",
    nodeCode: "OLT-CBD-MA5800",
    name: "Huawei-MA5800-X7-CBD (GPON OLT)",
    nodeType: "OLT",
    parentNodeId: "node-rtr-01",
    status: "ONLINE",
    subscriberCount: 54,
    latencyMs: 4.2,
    utilizationPercent: 41,
  },
  {
    id: "node-olt-02",
    nodeCode: "OLT-WST-V1600G1",
    name: "VSOL-V1600G1-Westlands (GPON OLT)",
    nodeType: "OLT",
    parentNodeId: "node-rtr-02",
    status: "ONLINE",
    subscriberCount: 27,
    latencyMs: 4.9,
    utilizationPercent: 36,
  },
  {
    id: "node-nap-01",
    nodeCode: "NAP-KIL-MENELIK-01",
    name: "Kilimani Menelik Rd Splitter FAT #1 (1:16)",
    nodeType: "NAP_SPLITTER",
    parentNodeId: "node-olt-01",
    status: "ONLINE",
    subscriberCount: 14,
    latencyMs: 5.1,
    utilizationPercent: 87,
  },
  {
    id: "node-nap-02",
    nodeCode: "NAP-CBD-CITYHOUSE-02",
    name: "CBD City House Distribution Box #2 (1:16)",
    nodeType: "NAP_SPLITTER",
    parentNodeId: "node-olt-01",
    status: "DEGRADED",
    subscriberCount: 12,
    latencyMs: 18.4,
    utilizationPercent: 75,
  },
];

export const SEED_GIS_NODES: GisFiberNode[] = [
  {
    id: "gis-01",
    code: "NAP-KIL-01",
    name: "Kilimani Menelik Road FAT #1",
    nodeKind: "NAP_FAT_BOX",
    latitude: -1.2952,
    longitude: 36.7865,
    totalPorts: 16,
    occupiedPorts: 13,
    feederCableCode: "FDR-KIL-24C-01",
    status: "ACTIVE",
  },
  {
    id: "gis-02",
    code: "NAP-WST-04",
    name: "Westlands Muthithi Road FAT #4",
    nodeKind: "NAP_FAT_BOX",
    latitude: -1.2618,
    longitude: 36.8044,
    totalPorts: 16,
    occupiedPorts: 11,
    feederCableCode: "FDR-WST-48C-02",
    status: "ACTIVE",
  },
  {
    id: "gis-03",
    code: "NAP-CBD-02",
    name: "Nairobi CBD City House FAT #2",
    nodeKind: "NAP_FAT_BOX",
    latitude: -1.2864,
    longitude: 36.8172,
    totalPorts: 16,
    occupiedPorts: 16,
    feederCableCode: "FDR-CBD-96C-01",
    status: "FULL",
  },
];

export const SEED_AUTOMATION_RULES: AutomationRule[] = [
  {
    id: "rule-01",
    name: "Instant M-Pesa Payment -> Ledger Post + RADIUS CoA Reconnect",
    triggerEvent: "payment.completed",
    conditionSummary: "Reconciliation matchStatus in [MATCHED, OVERPAYMENT]",
    actionType: "AUTO_RECONNECT",
    isEnabled: true,
    executionCount: 142,
    lastTriggeredAt: new Date(Date.now() - 15 * 60000).toISOString(),
  },
  {
    id: "rule-02",
    name: "ONT Optical Power < -27.0 dBm -> Auto-Create Field Splice Ticket",
    triggerEvent: "ont.optical_alarm",
    conditionSummary: "rxPowerDbm < -27.0 dBm for >= 3 polls",
    actionType: "CREATE_FIELD_TICKET",
    isEnabled: true,
    executionCount: 6,
    lastTriggeredAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: "rule-03",
    name: "NAP/PON Outage Correlated -> Send Proactive WhatsApp Area Advisory",
    triggerEvent: "network.outage_detected",
    conditionSummary: "affectedSubscribers >= 5",
    actionType: "SEND_WHATSAPP_ADVISORY",
    isEnabled: true,
    executionCount: 3,
    lastTriggeredAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: "rule-04",
    name: "Refund or Credit Note >= KES 1,000 -> Enforce Maker-Checker Approval",
    triggerEvent: "billing.credit_requested",
    conditionSummary: "amount >= 1000",
    actionType: "REQUIRE_APPROVAL",
    isEnabled: true,
    executionCount: 19,
    lastTriggeredAt: new Date(Date.now() - 3 * 3600000).toISOString(),
  },
];

export const SEED_SYSTEM_EVENTS: SystemEvent[] = [
  {
    id: "evt-01",
    organizationId: SEED_ORGANIZATION.id,
    eventType: "payment.reconciled",
    category: "BILLING",
    severity: "INFO",
    actorName: "M-Pesa Daraja Callback",
    entityType: "customer",
    entityId: "cust-01",
    summary:
      "Reconciled KES 2,500 (RKF9283KDJ) to GT-8921 (John Kamau Mwangi) and posted balanced journal entry JE-PAY-9283.",
    metadata: { reference: "RKF9283KDJ", amount: 2500 },
    createdAt: new Date(Date.now() - 35 * 60000).toISOString(),
  },
  {
    id: "evt-02",
    organizationId: SEED_ORGANIZATION.id,
    eventType: "ont.optical_alarm",
    category: "NETWORK",
    severity: "CRITICAL",
    actorName: "OLT Poller (Huawei-MA5800-X7-CBD)",
    entityType: "customer",
    entityId: "cust-03",
    summary:
      "ONT ZTEG9081E3F4 (David Koech, GT-8923) reported critical optical RX -28.4 dBm on GPON 0/1/1:7.",
    metadata: { serial: "ZTEG9081E3F4", rxDbm: -28.4 },
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: "evt-03",
    organizationId: SEED_ORGANIZATION.id,
    eventType: "approval.requested",
    category: "BILLING",
    severity: "WARNING",
    actorName: "Mercy Wambui (Support)",
    entityType: "approval",
    entityId: "apr-01",
    summary:
      "Requested KES 1,250 service waiver (APR-2026-014) for GT-8923 — awaiting Maker-Checker supervisor sign-off.",
    metadata: { requestNumber: "APR-2026-014", amount: 1250 },
    createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
  },
];

export const SEED_SECURITY_EVENTS: SecurityEvent[] = [
  {
    id: "sec-01",
    organizationId: SEED_ORGANIZATION.id,
    eventCode: "SOC_WEBHOOK_SIGNATURE_VERIFIED",
    severity: "LOW",
    sourceIp: "196.201.214.200",
    description:
      "Safaricom Daraja C2B callback signature and origin IP allowlist verified.",
    mitigationAction: "Allowed through to idempotent reconciliation pipeline.",
    isResolved: true,
    createdAt: new Date(Date.now() - 45 * 60000).toISOString(),
  },
  {
    id: "sec-02",
    organizationId: SEED_ORGANIZATION.id,
    eventCode: "SOC_BRUTE_FORCE_DETECTED",
    severity: "HIGH",
    actorEmail: "unknown@scanner.invalid",
    sourceIp: "185.220.101.42",
    description:
      "7 failed login attempts from Tor exit node 185.220.101.42 targeting /api/v1/settings.",
    mitigationAction: "IP rate-limited for 30 minutes; zero session tokens issued.",
    isResolved: true,
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
];

export function buildCustomer360Dossier(customerId: string) {
  const customer =
    SEED_CUSTOMERS.find((c) => c.id === customerId || c.accountNumber === customerId) ||
    SEED_CUSTOMERS[0];

  const pppoe = SEED_PPPOE.find((p) => p.customerId === customer.id);
  const sub = SEED_SUBSCRIPTIONS.find((s) => s.customerId === customer.id);
  const ont = SEED_ONTS.find((o) => o.customerId === customer.id);
  const invoices = SEED_INVOICES_2027.filter((i) => i.customerId === customer.id);
  const payments = SEED_PAYMENTS.filter((p) => p.customerId === customer.id);
  const tickets = SEED_SUPPORT_TICKETS.filter((t) => t.customerId === customer.id);
  const journalEntries = getSeedJournalEntries().filter(
    (je) => je.customerId === customer.id
  );

  const isOnline = Boolean(pppoe?.isOnline && customer.status === "ACTIVE");
  const rxPowerDbm = ont?.rxPowerDbm ?? -19.5;

  const quality = computeConnectionQualityScore({
    isOnline,
    latencyMs: isOnline ? 9 : 88,
    packetLossPercent: isOnline ? 0.1 : 4.5,
    opticalRxDbm: rxPowerDbm,
    sessionDropCount7d: customer.status === "SUSPENDED" ? 4 : 0,
    attainedSpeedRatio: isOnline ? 0.96 : 0,
  });

  const daysUntilExpiry = sub?.endTime
    ? Math.round((new Date(sub.endTime).getTime() - Date.now()) / 86400000)
    : 14;

  const churn = predictSubscriberChurnRisk({
    status: customer.status,
    balanceDue: customer.balanceDue,
    planPrice: 2500,
    daysUntilExpiry,
    openSupportTickets: tickets.filter((t) => t.status !== "RESOLVED").length,
    connectionQualityScore: quality.score,
  });

  return {
    customer,
    pppoe,
    subscription: sub,
    ont,
    quality,
    churn,
    invoices,
    payments,
    tickets,
    journalEntries,
  };
}

export function buildSeedCopilotSnapshot(): CopilotContextSnapshot {
  const entries = getSeedJournalEntries();
  const tb = computeTrialBalance(entries);
  const aging = computeArAgingBuckets(SEED_INVOICES_2027);
  const exec = computeExecutiveRevenueMetrics({
    customers: SEED_CUSTOMERS.map((c) => ({
      id: c.id,
      status: c.status,
      balanceDue: c.balanceDue,
      planPrice: 2500,
    })),
    payments: SEED_PAYMENTS,
    trialBalance: tb,
    arAging: aging,
  });

  const subscribers = SEED_CUSTOMERS.map((c) => {
    const d = buildCustomer360Dossier(c.id);
    return {
      id: c.id,
      accountNumber: c.accountNumber,
      fullName: c.fullName,
      status: c.status,
      balanceDue: c.balanceDue,
      planName: d.subscription?.planName || "Silver Fiber - 10 Mbps",
      siteName: c.siteName || "Nairobi CBD",
      isOnline: Boolean(d.pppoe?.isOnline),
      rxPowerDbm: d.ont?.rxPowerDbm ?? -19.5,
      qualityScore: d.quality.score,
      churnRiskScore: d.churn.riskScore,
      churnRiskTier: d.churn.riskTier,
    };
  });

  return {
    organizationName: SEED_ORGANIZATION.name,
    subscribers,
    financials: {
      mrr: exec.mrr,
      arr: exec.arr,
      arpu: exec.arpu,
      collectedThisPeriod: exec.collectedThisPeriod,
      collectionRatePercent: exec.collectionRatePercent,
      totalArOutstanding: aging.totalOutstanding,
      trialBalanceBalanced: tb.isBalanced,
      pendingApprovalsCount: SEED_APPROVAL_REQUESTS.filter(
        (a) => a.status === "PENDING"
      ).length,
      unmatchedPaymentsCount: getSeedReconciliationQueue().filter(
        (r) => r.matchStatus === "UNMATCHED" || r.matchStatus === "PARTIAL"
      ).length,
    },
    network: {
      totalRouters: SEED_ROUTERS.length,
      onlineRouters: SEED_ROUTERS.filter((r) => r.status === "ONLINE").length,
      totalOlts: SEED_OLTS.length,
      losOntCount: SEED_ONTS.filter((o) => o.status === "LOS").length,
      openAlertsCount: 1,
    },
  };
}
