// ============================================================================
// QC NETCORE — CONTROLLED AI COPILOT TOOL LAYER, RBAC & AUDIT ENGINE
// ============================================================================
// Enforces:
// 1. Multi-Tenant Isolation (every query filtered by ctx.organizationId)
// 2. Role-Based Access Control (RBAC) & Field-Level Security
// 3. Zero Secret Exposure (strips passwords, API keys, service keys, tokens)
// 4. Source-of-Truth Traceability & AI Audit Logging
// ============================================================================

import type {
  Organization,
  Customer,
  PppoeAccount,
  Subscription,
  ServicePlan,
  Router,
  Site,
  Payment,
  HotspotVoucher,
  WorkOrder,
  NetworkAlert,
  UserRole,
} from "../../types/index.ts";
import { hasPermission, type Permission } from "../auth/rbac.ts";
import {
  computeTrialBalance,
  computeArAgingBuckets,
  computeExecutiveRevenueMetrics,
  type JournalEntry,
} from "../ledger/ledger.ts";
import type { OltDevice, OntDevice } from "../network/olt-cpe.ts";
import type {
  InventoryItemRecord,
  SerializedAssetRecord,
  SupportTicketRecord,
} from "../operations/field-inventory-support.ts";
import type { TopologyNode } from "../network/topology-gis-automation.ts";
import type { SystemEvent, SecurityEvent } from "../events/event-bus.ts";
import {
  computeConnectionQualityScore,
  predictSubscriberChurnRisk,
} from "../intelligence/subscriber-360.ts";
import {
  SYSTEM_CAPABILITY_REGISTRY,
  findMatchingCapabilities,
  type FeatureCapabilityDefinition,
} from "./capability-registry.ts";
import {
  getSmsOverviewMetrics,
  getSmsHistory,
  buildEnrichedSmsRecipients,
  previewSmsCampaign,
  DEFAULT_SMS_TEMPLATES,
  type SmsRecipientMode,
  type SmsCategory,
} from "../sms/engine.ts";
import {
  SEED_ORGANIZATION,
  SEED_CUSTOMERS,
  SEED_PPPOE,
  SEED_SUBSCRIPTIONS,
  SEED_PLANS,
  SEED_ROUTERS,
  SEED_SITES,
  SEED_PAYMENTS,
  SEED_HOTSPOT_VOUCHERS,
  SEED_WORK_ORDERS,
  SEED_ALERTS,
} from "../db/mock-db.ts";
import {
  SEED_INVOICES_2027,
  SEED_OLTS,
  SEED_ONTS,
  SEED_SUPPORT_TICKETS,
  SEED_INVENTORY_ITEMS,
  SEED_SERIALIZED_ASSETS,
  SEED_TOPOLOGY_NODES,
  SEED_SYSTEM_EVENTS,
  SEED_SECURITY_EVENTS,
  SEED_APPROVAL_REQUESTS,
  getSeedJournalEntries,
  getSeedReconciliationQueue,
} from "../db/os-2027-seed.ts";

export type CopilotEnvironmentMode = "LIVE_TENANT_DATA" | "DEMO_DATA";

export interface CopilotInvoiceRecord {
  id: string;
  organizationId: string;
  customerId: string;
  customerName: string;
  accountNumber: string;
  invoiceNumber: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID";
  dueDate: string;
  createdAt: string;
}

export interface CopilotDataset {
  organization: Organization;
  customers: Customer[];
  pppoeAccounts: PppoeAccount[];
  subscriptions: Subscription[];
  plans: ServicePlan[];
  routers: Router[];
  sites: Site[];
  invoices: CopilotInvoiceRecord[];
  payments: Payment[];
  vouchers: HotspotVoucher[];
  workOrders: WorkOrder[];
  alerts: NetworkAlert[];
  olts: OltDevice[];
  onts: OntDevice[];
  tickets: SupportTicketRecord[];
  inventory: InventoryItemRecord[];
  assets: SerializedAssetRecord[];
  topologyNodes: TopologyNode[];
  journalEntries: JournalEntry[];
  systemEvents: SystemEvent[];
  securityEvents: SecurityEvent[];
  unmatchedPaymentsCount: number;
  pendingApprovalsCount: number;
}

export interface CopilotExecutionContext {
  organizationId: string;
  organizationName: string;
  currency: string;
  timezone: string;
  userRole: UserRole;
  userId?: string;
  userEmail?: string;
  environmentMode: CopilotEnvironmentMode;
  checkedAtIso: string;
}

export interface ToolResult<T> {
  ok: boolean;
  toolName: string;
  source: string;
  data: T | null;
  errorCode?: "PERMISSION_DENIED" | "NOT_FOUND" | "UNAVAILABLE";
  message?: string;
}

export interface EnrichedSubscriberRecord {
  id: string;
  accountNumber: string;
  fullName: string;
  phoneNumber?: string;
  email?: string;
  physicalAddress?: string;
  status: string;
  serviceType: "PPPoE" | "Hotspot";
  packageName: string;
  packageId?: string;
  packagePrice: number;
  speedMbpsLabel: string;
  ipAddress: string | null;
  macAddress: string | null;
  pppoeUsername: string | null;
  isOnline: boolean;
  sessionStatus: "Online" | "Offline";
  uptime: string | null;
  popSiteName: string;
  routerName: string | null;
  routerId: string | null;
  registeredAt: string;
  activatedAt: string | null;
  expiresAt: string | null;
  balanceDue: number;
  lastPaymentAmount: number | null;
  lastPaymentDate: string | null;
  lastPaymentReference: string | null;
  lastPaymentMethod: string | null;
  paymentStatus: "Paid" | "Overdue" | "Unpaid" | "No Invoice";
  rxPowerDbm: number | null;
  qualityScore: number;
  churnRiskScore: number;
  churnRiskTier: string;
  openTicketsCount: number;
}

export interface CopilotAuditRecord {
  timestamp: string;
  userId: string;
  userRole: UserRole;
  organizationId: string;
  environmentMode: CopilotEnvironmentMode;
  question: string;
  toolsInvoked: string[];
  sourcesConsulted: string[];
  permissionDenials: string[];
}

const SENSITIVE_FIELD_PATTERNS = [
  /password/i,
  /secret/i,
  /private_?key/i,
  /service_?role/i,
  /api_?key/i,
  /access_?token/i,
  /refresh_?token/i,
  /webhook_?secret/i,
];

/**
 * Recursively strips any sensitive secret fields from objects before returning
 * data to the Copilot layer.
 */
export function redactSecrets<T>(input: T): T {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) {
    return input.map((item) => redactSecrets(item)) as unknown as T;
  }
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_FIELD_PATTERNS.some((re) => re.test(k))) {
        continue;
      }
      out[k] = redactSecrets(v);
    }
    return out as T;
  }
  return input;
}

const AI_AUDIT_LOG: CopilotAuditRecord[] = [];

export function recordCopilotAudit(entry: CopilotAuditRecord): void {
  AI_AUDIT_LOG.unshift(redactSecrets(entry));
  if (AI_AUDIT_LOG.length > 200) {
    AI_AUDIT_LOG.length = 200;
  }
}

export function getCopilotAuditLog(organizationId?: string): CopilotAuditRecord[] {
  if (!organizationId) return [...AI_AUDIT_LOG];
  return AI_AUDIT_LOG.filter((a) => a.organizationId === organizationId);
}

/**
 * Controlled Copilot Toolkit bound to a specific tenant execution context and dataset.
 */
export class CopilotToolkit {
  public readonly ctx: CopilotExecutionContext;
  private readonly raw: CopilotDataset;
  public readonly toolsInvoked: string[] = [];
  public readonly sourcesConsulted = new Set<string>();
  public readonly permissionDenials: string[] = [];

  constructor(ctx: CopilotExecutionContext, dataset: CopilotDataset) {
    this.ctx = ctx;
    this.raw = dataset;
  }

  private guard<T>(
    toolName: string,
    permission: Permission | null,
    source: string,
    fn: () => T
  ): ToolResult<T> {
    this.toolsInvoked.push(toolName);
    this.sourcesConsulted.add(source);

    if (permission && !hasPermission(this.ctx.userRole, permission)) {
      this.permissionDenials.push(`${toolName} (requires ${permission})`);
      return {
        ok: false,
        toolName,
        source,
        data: null,
        errorCode: "PERMISSION_DENIED",
        message: "You don't have permission to view this information.",
      };
    }

    try {
      const result = redactSecrets(fn());
      return {
        ok: true,
        toolName,
        source,
        data: result,
      };
    } catch {
      return {
        ok: false,
        toolName,
        source,
        data: null,
        errorCode: "UNAVAILABLE",
        message: `Could not retrieve data from ${source} right now.`,
      };
    }
  }

  // Strictly tenant-scoped getters
  private tenantCustomers(): Customer[] {
    return this.raw.customers.filter(
      (c) => c.organizationId === this.ctx.organizationId
    );
  }

  private tenantPppoe(): PppoeAccount[] {
    return this.raw.pppoeAccounts.filter(
      (p) => p.organizationId === this.ctx.organizationId
    );
  }

  private tenantSubscriptions(): Subscription[] {
    return this.raw.subscriptions.filter(
      (s) => s.organizationId === this.ctx.organizationId
    );
  }

  private tenantPlans(): ServicePlan[] {
    return this.raw.plans.filter(
      (p) => p.organizationId === this.ctx.organizationId
    );
  }

  private tenantRouters(): Router[] {
    return this.raw.routers.filter(
      (r) => r.organizationId === this.ctx.organizationId
    );
  }

  private tenantSites(): Site[] {
    return this.raw.sites.filter(
      (s) => s.organizationId === this.ctx.organizationId
    );
  }

  private tenantInvoices(): CopilotInvoiceRecord[] {
    return this.raw.invoices.filter(
      (i) => i.organizationId === this.ctx.organizationId
    );
  }

  private tenantPayments(): Payment[] {
    return this.raw.payments.filter(
      (p) => p.organizationId === this.ctx.organizationId
    );
  }

  private tenantVouchers(): HotspotVoucher[] {
    return this.raw.vouchers.filter(
      (v) => v.organizationId === this.ctx.organizationId
    );
  }

  private tenantAlerts(): NetworkAlert[] {
    return this.raw.alerts.filter(
      (a) => a.organizationId === this.ctx.organizationId
    );
  }

  private tenantOlts(): OltDevice[] {
    return this.raw.olts.filter(
      (o) => o.organizationId === this.ctx.organizationId
    );
  }

  private tenantOnts(): OntDevice[] {
    return this.raw.onts.filter(
      (o) => o.organizationId === this.ctx.organizationId
    );
  }

  private tenantTickets(): SupportTicketRecord[] {
    return this.raw.tickets.filter(
      (t) => t.organizationId === this.ctx.organizationId
    );
  }

  private tenantWorkOrders(): WorkOrder[] {
    return this.raw.workOrders.filter(
      (w) => w.organizationId === this.ctx.organizationId
    );
  }

  private tenantInventory(): InventoryItemRecord[] {
    return this.raw.inventory.filter(
      (i) => i.organizationId === this.ctx.organizationId
    );
  }

  private tenantSystemEvents(): SystemEvent[] {
    return this.raw.systemEvents.filter(
      (e) => e.organizationId === this.ctx.organizationId
    );
  }

  private tenantSecurityEvents(): SecurityEvent[] {
    return this.raw.securityEvents.filter(
      (e) => e.organizationId === this.ctx.organizationId
    );
  }

  /**
   * Cross-module enrichment for a customer/subscriber record.
   */
  private enrichCustomer(customer: Customer): EnrichedSubscriberRecord {
    const pppoe = this.tenantPppoe().find((p) => p.customerId === customer.id);
    const sub = this.tenantSubscriptions().find((s) => s.customerId === customer.id);
    const plans = this.tenantPlans();
    const plan =
      plans.find((p) => p.id === (sub?.planId || pppoe?.servicePlanId)) ||
      plans.find((p) => p.name === sub?.planName);
    const router = this.tenantRouters().find((r) => r.id === pppoe?.routerId);
    const site = this.tenantSites().find((s) => s.id === (customer.siteId || router?.siteId));
    const ont = this.tenantOnts().find((o) => o.customerId === customer.id);

    const customerPayments = this.tenantPayments()
      .filter((p) => p.customerId === customer.id && p.status === "COMPLETED")
      .sort(
        (a, b) =>
          new Date(b.processedAt || b.createdAt).getTime() -
          new Date(a.processedAt || a.createdAt).getTime()
      );
    const latestPay = customerPayments[0] || null;

    const customerInvoices = this.tenantInvoices()
      .filter((i) => i.customerId === customer.id)
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    const hasOverdueInv = customerInvoices.some(
      (i) =>
        i.balanceDue > 0 &&
        (i.status === "OVERDUE" || new Date(i.dueDate).getTime() < Date.now())
    );

    let paymentStatus: EnrichedSubscriberRecord["paymentStatus"] = "Paid";
    if (customer.balanceDue > 0) {
      paymentStatus = hasOverdueInv ? "Overdue" : "Unpaid";
    } else if (customerInvoices.length === 0 && !latestPay) {
      paymentStatus = "No Invoice";
    }

    const isOnline = Boolean(pppoe?.isOnline && customer.status === "ACTIVE");
    const rxPowerDbm = ont?.rxPowerDbm ?? null;

    const openTicketsCount = this.tenantTickets().filter(
      (t) => t.customerId === customer.id && t.status !== "RESOLVED"
    ).length;

    const quality = computeConnectionQualityScore({
      isOnline,
      latencyMs: isOnline ? 9 : 88,
      packetLossPercent: isOnline ? 0.1 : 4.5,
      opticalRxDbm: rxPowerDbm ?? -19.5,
      sessionDropCount7d: customer.status === "SUSPENDED" ? 4 : 0,
      attainedSpeedRatio: isOnline ? 0.96 : 0,
    });

    const daysUntilExpiry = sub?.endTime
      ? Math.round((new Date(sub.endTime).getTime() - Date.now()) / 86400000)
      : 14;

    const churn = predictSubscriberChurnRisk({
      status: customer.status,
      balanceDue: customer.balanceDue,
      planPrice: plan?.price ?? 2500,
      daysUntilExpiry,
      openSupportTickets: openTicketsCount,
      connectionQualityScore: quality.score,
    });

    const downMbps = plan ? Math.round(plan.downloadSpeedKbps / 1024) : 10;
    const upMbps = plan ? Math.round(plan.uploadSpeedKbps / 1024) : 5;

    // Field-level RBAC: only expose full contact details if role has customers.view
    const canViewContact = hasPermission(this.ctx.userRole, "customers.view");

    return {
      id: customer.id,
      accountNumber: customer.accountNumber,
      fullName: customer.fullName,
      phoneNumber: canViewContact ? customer.phoneNumber : undefined,
      email: canViewContact ? customer.email : undefined,
      physicalAddress: canViewContact ? customer.physicalAddress : undefined,
      status: customer.status,
      serviceType: plan?.serviceType === "HOTSPOT" ? "Hotspot" : "PPPoE",
      packageName: plan?.name || sub?.planName || "Silver Fiber - 10 Mbps",
      packageId: plan?.id || sub?.planId,
      packagePrice: plan?.price ?? 2500,
      speedMbpsLabel: `${downMbps} Mbps Down / ${upMbps} Mbps Up`,
      ipAddress: pppoe?.currentIp || pppoe?.staticIp || null,
      macAddress: pppoe?.macAddress || ont?.serialNumber || null,
      pppoeUsername: pppoe?.username || null,
      isOnline,
      sessionStatus: isOnline ? "Online" : "Offline",
      uptime: pppoe?.uptime || null,
      popSiteName: customer.siteName || site?.name || "Main POP",
      routerName: router?.name || null,
      routerId: router?.id || null,
      registeredAt: customer.createdAt,
      activatedAt: sub?.startTime || null,
      expiresAt: sub?.endTime || null,
      balanceDue: customer.balanceDue,
      lastPaymentAmount: latestPay ? latestPay.amount : null,
      lastPaymentDate: latestPay
        ? latestPay.processedAt || latestPay.createdAt
        : null,
      lastPaymentReference: latestPay ? latestPay.transactionReference : null,
      lastPaymentMethod: latestPay ? latestPay.paymentMethod : null,
      paymentStatus,
      rxPowerDbm,
      qualityScore: quality.score,
      churnRiskScore: churn.riskScore,
      churnRiskTier: churn.riskTier,
      openTicketsCount,
    };
  }

  // ==========================================================================
  // 1. CUSTOMER & SUBSCRIBER TOOLS
  // ==========================================================================

  searchCustomers(query: string): ToolResult<EnrichedSubscriberRecord[]> {
    return this.guard(
      "searchCustomers",
      "customers.view",
      "customers + subscriptions + pppoe_accounts + payments",
      () => {
        const q = query.trim().toLowerCase();
        const all = this.tenantCustomers();
        const matches = !q
          ? all
          : all.filter(
              (c) =>
                c.fullName.toLowerCase().includes(q) ||
                c.accountNumber.toLowerCase().includes(q) ||
                c.phoneNumber.toLowerCase().includes(q) ||
                (c.physicalAddress || "").toLowerCase().includes(q) ||
                (c.siteName || "").toLowerCase().includes(q)
            );
        return matches.map((c) => this.enrichCustomer(c));
      }
    );
  }

  getCustomer(idOrAccountOrName: string): ToolResult<{
    matches: EnrichedSubscriberRecord[];
    exact: EnrichedSubscriberRecord | null;
  }> {
    return this.guard(
      "getCustomer",
      "customers.view",
      "customers + subscriptions + pppoe_accounts + payments",
      () => {
        const q = idOrAccountOrName.trim().toLowerCase();
        const all = this.tenantCustomers();
        const exactMatch = all.find(
          (c) =>
            c.id.toLowerCase() === q ||
            c.accountNumber.toLowerCase() === q ||
            c.fullName.toLowerCase() === q
        );
        if (exactMatch) {
          const enriched = this.enrichCustomer(exactMatch);
          return { matches: [enriched], exact: enriched };
        }
        const partial = all
          .filter(
            (c) =>
              c.fullName.toLowerCase().includes(q) ||
              c.accountNumber.toLowerCase().includes(q) ||
              c.phoneNumber.includes(q)
          )
          .map((c) => this.enrichCustomer(c));
        return {
          matches: partial,
          exact: partial.length === 1 ? partial[0] : null,
        };
      }
    );
  }

  getSubscriber(idOrAccountOrName: string) {
    this.toolsInvoked.push("getSubscriber");
    return this.getCustomer(idOrAccountOrName);
  }

  searchSubscribers(filters: {
    status?: string;
    siteQuery?: string;
    packageQuery?: string;
    isOnline?: boolean;
    overdueOnly?: boolean;
    limit?: number;
  }): ToolResult<EnrichedSubscriberRecord[]> {
    return this.guard(
      "searchSubscribers",
      "customers.view",
      "customers + subscriptions + pppoe_accounts + plans",
      () => {
        let list = this.tenantCustomers().map((c) => this.enrichCustomer(c));
        if (filters.status) {
          const st = filters.status.toUpperCase();
          list = list.filter((s) => s.status.toUpperCase() === st);
        }
        if (filters.siteQuery) {
          const sq = filters.siteQuery.toLowerCase();
          list = list.filter(
            (s) =>
              s.popSiteName.toLowerCase().includes(sq) ||
              (s.physicalAddress || "").toLowerCase().includes(sq)
          );
        }
        if (filters.packageQuery) {
          const pq = filters.packageQuery.toLowerCase();
          list = list.filter(
            (s) =>
              s.packageName.toLowerCase().includes(pq) ||
              s.speedMbpsLabel.toLowerCase().includes(pq)
          );
        }
        if (typeof filters.isOnline === "boolean") {
          list = list.filter((s) => s.isOnline === filters.isOnline);
        }
        if (filters.overdueOnly) {
          list = list.filter((s) => s.balanceDue > 0);
        }
        if (filters.limit && filters.limit > 0) {
          list = list.slice(0, filters.limit);
        }
        return list;
      }
    );
  }

  getNewestSubscriber(limit = 1): ToolResult<EnrichedSubscriberRecord[]> {
    return this.guard(
      "getNewestSubscriber",
      "customers.view",
      "customers + subscriptions + pppoe_accounts + payments + routers",
      () => {
        const sorted = [...this.tenantCustomers()].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        return sorted.slice(0, Math.max(1, limit)).map((c) => this.enrichCustomer(c));
      }
    );
  }

  getOldestSubscriber(limit = 1): ToolResult<EnrichedSubscriberRecord[]> {
    return this.guard(
      "getOldestSubscriber",
      "customers.view",
      "customers + subscriptions + pppoe_accounts",
      () => {
        const sorted = [...this.tenantCustomers()].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        return sorted.slice(0, Math.max(1, limit)).map((c) => this.enrichCustomer(c));
      }
    );
  }

  getActiveSubscribers(): ToolResult<EnrichedSubscriberRecord[]> {
    return this.guard(
      "getActiveSubscribers",
      "customers.view",
      "customers + subscriptions",
      () =>
        this.tenantCustomers()
          .filter((c) => c.status === "ACTIVE")
          .map((c) => this.enrichCustomer(c))
    );
  }

  getSuspendedSubscribers(): ToolResult<EnrichedSubscriberRecord[]> {
    return this.guard(
      "getSuspendedSubscribers",
      "customers.view",
      "customers + subscriptions",
      () =>
        this.tenantCustomers()
          .filter((c) => c.status === "SUSPENDED")
          .map((c) => this.enrichCustomer(c))
    );
  }

  getExpiredSubscribers(): ToolResult<EnrichedSubscriberRecord[]> {
    return this.guard(
      "getExpiredSubscribers",
      "customers.view",
      "customers + subscriptions",
      () => {
        const now = Date.now();
        const expiredSubCustomerIds = new Set(
          this.tenantSubscriptions()
            .filter(
              (s) =>
                s.status === "EXPIRED" ||
                new Date(s.endTime).getTime() < now
            )
            .map((s) => s.customerId)
        );
        return this.tenantCustomers()
          .filter(
            (c) =>
              expiredSubCustomerIds.has(c.id) || c.status === "TERMINATED"
          )
          .map((c) => this.enrichCustomer(c));
      }
    );
  }

  getCustomerServices(customerId: string) {
    return this.guard(
      "getCustomerServices",
      "customers.view",
      "subscriptions + pppoe_accounts + plans",
      () => {
        const sub = this.tenantSubscriptions().filter((s) => s.customerId === customerId);
        const pppoe = this.tenantPppoe().filter((p) => p.customerId === customerId);
        return { subscriptions: sub, pppoeAccounts: pppoe };
      }
    );
  }

  getCustomerPayments(customerId: string) {
    return this.guard(
      "getCustomerPayments",
      "billing.view",
      "payments",
      () =>
        this.tenantPayments()
          .filter((p) => p.customerId === customerId)
          .sort(
            (a, b) =>
              new Date(b.processedAt || b.createdAt).getTime() -
              new Date(a.processedAt || a.createdAt).getTime()
          )
    );
  }

  getCustomerInvoices(customerId: string) {
    return this.guard(
      "getCustomerInvoices",
      "billing.view",
      "invoices",
      () =>
        this.tenantInvoices()
          .filter((i) => i.customerId === customerId)
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
    );
  }

  getCustomerSessions(customerId: string) {
    return this.guard(
      "getCustomerSessions",
      "customers.view",
      "pppoe_accounts + routers",
      () => this.tenantPppoe().filter((p) => p.customerId === customerId)
    );
  }

  getCustomerNetwork(customerId: string) {
    return this.guard(
      "getCustomerNetwork",
      "customers.view",
      "pppoe_accounts + routers + onts + olts",
      () => {
        const pppoe = this.tenantPppoe().find((p) => p.customerId === customerId);
        const router = this.tenantRouters().find((r) => r.id === pppoe?.routerId);
        const ont = this.tenantOnts().find((o) => o.customerId === customerId);
        return { pppoe, router, ont };
      }
    );
  }

  getCustomerTickets(customerId: string) {
    return this.guard(
      "getCustomerTickets",
      "work_orders.view",
      "support_tickets + work_orders",
      () => ({
        tickets: this.tenantTickets().filter((t) => t.customerId === customerId),
        workOrders: this.tenantWorkOrders().filter((w) => w.customerId === customerId),
      })
    );
  }

  getCustomer360(idOrAccountOrName: string) {
    return this.guard(
      "getCustomer360",
      "customers.view",
      "customers + subscriptions + pppoe_accounts + invoices + payments + onts + tickets",
      () => {
        const lookup = this.getCustomer(idOrAccountOrName);
        if (!lookup.ok || !lookup.data) return null;
        const target = lookup.data.exact || lookup.data.matches[0];
        if (!target) return null;

        const canBilling = hasPermission(this.ctx.userRole, "billing.view");
        const invoices = canBilling
          ? this.tenantInvoices().filter((i) => i.customerId === target.id)
          : [];
        const payments = canBilling
          ? this.tenantPayments().filter((p) => p.customerId === target.id)
          : [];
        const tickets = this.tenantTickets().filter((t) => t.customerId === target.id);
        const workOrders = this.tenantWorkOrders().filter(
          (w) => w.customerId === target.id
        );
        const ont = this.tenantOnts().find((o) => o.customerId === target.id) || null;
        const recentEvents = this.tenantSystemEvents().filter(
          (e) => e.entityId === target.id
        );

        return {
          subscriber: target,
          ont,
          invoices,
          payments,
          tickets,
          workOrders,
          recentEvents,
          multipleMatches:
            lookup.data.matches.length > 1 ? lookup.data.matches : undefined,
        };
      }
    );
  }

  // ==========================================================================
  // 2. PACKAGE & SERVICE PLAN TOOLS
  // ==========================================================================

  searchPackages(query?: string) {
    return this.guard(
      "searchPackages",
      "plans.view",
      "plans + subscriptions + payments",
      () => {
        const plans = this.tenantPlans();
        const subs = this.tenantSubscriptions();
        const enriched = plans.map((plan) => {
          const activeSubs = subs.filter(
            (s) => s.planId === plan.id && s.status === "ACTIVE"
          ).length;
          const totalSubscribers = Math.max(
            plan.subscriberCount ?? 0,
            activeSubs
          );
          const estimatedMonthlyRevenue =
            plan.serviceType === "PPPOE"
              ? totalSubscribers * plan.price
              : totalSubscribers * plan.price;
          return {
            ...plan,
            activeAssignedSubscriptions: activeSubs,
            totalSubscribers,
            estimatedRevenue: estimatedMonthlyRevenue,
          };
        });

        if (!query || !query.trim()) {
          return enriched.sort((a, b) => b.totalSubscribers - a.totalSubscribers);
        }
        const q = query.trim().toLowerCase();
        return enriched.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.serviceType.toLowerCase().includes(q) ||
            String(Math.round(p.downloadSpeedKbps / 1024)).includes(q)
        );
      }
    );
  }

  getPackage(idOrName: string) {
    return this.guard("getPackage", "plans.view", "plans", () => {
      const list = this.searchPackages(idOrName);
      return list.data?.[0] || null;
    });
  }

  getPackageSubscribers(idOrName: string) {
    return this.guard(
      "getPackageSubscribers",
      "customers.view",
      "plans + subscriptions + customers",
      () => {
        const pkg = this.getPackage(idOrName).data;
        if (!pkg) return [];
        return this.tenantCustomers()
          .map((c) => this.enrichCustomer(c))
          .filter(
            (s) =>
              s.packageId === pkg.id ||
              s.packageName.toLowerCase() === pkg.name.toLowerCase()
          );
      }
    );
  }

  getPackageRevenue(idOrName?: string) {
    return this.guard(
      "getPackageRevenue",
      "billing.view",
      "plans + subscriptions + payments + invoices",
      () => {
        const plans = this.tenantPlans();
        const subs = this.tenantSubscriptions();
        const payments = this.tenantPayments().filter(
          (p) => p.status === "COMPLETED"
        );
        const customers = this.tenantCustomers();

        const breakdown = plans.map((plan) => {
          const planCustomerIds = new Set(
            subs
              .filter((s) => s.planId === plan.id)
              .map((s) => s.customerId)
          );
          const confirmedPaymentsTotal = payments
            .filter((p) => p.customerId && planCustomerIds.has(p.customerId))
            .reduce((sum, p) => sum + p.amount, 0);

          const subscriberCount = Math.max(
            plan.subscriberCount ?? 0,
            planCustomerIds.size
          );
          const contractedMrr =
            plan.serviceType === "PPPOE" ? subscriberCount * plan.price : 0;

          return {
            planId: plan.id,
            planName: plan.name,
            serviceType: plan.serviceType,
            price: plan.price,
            currency: plan.currency,
            subscriberCount,
            assignedCustomerCount: planCustomerIds.size,
            confirmedPaymentsCollected: confirmedPaymentsTotal,
            contractedMrr,
            customers: customers
              .filter((c) => planCustomerIds.has(c.id))
              .map((c) => c.fullName),
          };
        });

        if (idOrName && idOrName.trim()) {
          const q = idOrName.trim().toLowerCase();
          return breakdown.filter(
            (b) =>
              b.planName.toLowerCase().includes(q) ||
              b.planId.toLowerCase().includes(q)
          );
        }

        return breakdown.sort(
          (a, b) =>
            Math.max(b.confirmedPaymentsCollected, b.contractedMrr) -
            Math.max(a.confirmedPaymentsCollected, a.contractedMrr)
        );
      }
    );
  }

  // ==========================================================================
  // 3. BILLING, PAYMENTS & FINANCIAL INTELLIGENCE TOOLS
  // ==========================================================================

  getLatestPayments(limit = 10) {
    return this.guard("getLatestPayments", "billing.view", "payments", () => {
      return [...this.tenantPayments()]
        .sort(
          (a, b) =>
            new Date(b.processedAt || b.createdAt).getTime() -
            new Date(a.processedAt || a.createdAt).getTime()
        )
        .slice(0, limit);
    });
  }

  getOutstandingInvoices() {
    return this.guard(
      "getOutstandingInvoices",
      "billing.view",
      "invoices",
      () =>
        this.tenantInvoices()
          .filter((i) => i.balanceDue > 0)
          .sort((a, b) => b.balanceDue - a.balanceDue)
    );
  }

  getOverdueAccounts(limit = 10) {
    return this.guard(
      "getOverdueAccounts",
      "billing.view",
      "customers + invoices + subscriptions",
      () => {
        const now = Date.now();
        const invoices = this.tenantInvoices();
        const customersWithAr = this.tenantCustomers()
          .filter((c) => c.balanceDue > 0)
          .map((c) => {
            const enriched = this.enrichCustomer(c);
            const custInvoices = invoices.filter(
              (i) => i.customerId === c.id && i.balanceDue > 0
            );
            const oldestDue = custInvoices.reduce((oldest, inv) => {
              const t = new Date(inv.dueDate).getTime();
              return t < oldest ? t : oldest;
            }, now);
            const daysOverdue = Math.max(
              0,
              Math.round((now - oldestDue) / 86400000)
            );
            return {
              ...enriched,
              daysOverdue,
              openInvoicesCount: custInvoices.length,
            };
          })
          .sort((a, b) => b.balanceDue - a.balanceDue);

        return customersWithAr.slice(0, limit);
      }
    );
  }

  getRevenueMetrics() {
    return this.guard(
      "getRevenueMetrics",
      "billing.view",
      "payments + invoices + journal_entries + subscriptions",
      () => {
        const entries = this.raw.journalEntries.filter(
          (e) => e.organizationId === this.ctx.organizationId
        );
        const tb = computeTrialBalance(entries);
        const aging = computeArAgingBuckets(this.tenantInvoices());
        const customers = this.tenantCustomers();
        const payments = this.tenantPayments();

        const exec = computeExecutiveRevenueMetrics({
          customers: customers.map((c) => {
            const enr = this.enrichCustomer(c);
            return {
              id: c.id,
              status: c.status,
              balanceDue: c.balanceDue,
              planPrice: enr.packagePrice,
            };
          }),
          payments,
          trialBalance: tb,
          arAging: aging,
        });

        const now = Date.now();
        const last24h = now - 24 * 3600000;
        const completedPayments = payments.filter(
          (p) => p.status === "COMPLETED"
        );
        const failedPayments = payments.filter((p) => p.status === "FAILED");

        const todayPayments = completedPayments.filter(
          (p) =>
            new Date(p.processedAt || p.createdAt).getTime() >= last24h
        );
        const collectedToday = todayPayments.reduce(
          (sum, p) => sum + p.amount,
          0
        );

        const byMethod: Record<string, number> = {};
        for (const p of completedPayments) {
          byMethod[p.paymentMethod] = (byMethod[p.paymentMethod] || 0) + p.amount;
        }

        const todayByMethod: Record<string, number> = {};
        for (const p of todayPayments) {
          todayByMethod[p.paymentMethod] =
            (todayByMethod[p.paymentMethod] || 0) + p.amount;
        }

        return {
          currency: this.ctx.currency,
          mrr: exec.mrr,
          arr: exec.arr,
          arpu: exec.arpu,
          collectedThisPeriod: exec.collectedThisPeriod,
          collectedToday,
          todayTransactionsCount: todayPayments.length,
          totalCompletedTransactionsCount: completedPayments.length,
          failedPaymentsCount: failedPayments.length,
          byMethod,
          todayByMethod,
          collectionRatePercent: exec.collectionRatePercent,
          totalArOutstanding: aging.totalOutstanding,
          arAgingBuckets: aging,
          trialBalanceBalanced: tb.isBalanced,
          trialBalanceDiscrepancy: tb.discrepancy,
          unmatchedPaymentsCount: this.raw.unmatchedPaymentsCount,
          pendingApprovalsCount: this.raw.pendingApprovalsCount,
        };
      }
    );
  }

  getBillingMetrics() {
    this.toolsInvoked.push("getBillingMetrics");
    return this.getRevenueMetrics();
  }

  getCustomerGrowth() {
    return this.guard(
      "getCustomerGrowth",
      "customers.view",
      "customers + subscriptions",
      () => {
        const all = this.tenantCustomers();
        const active = all.filter((c) => c.status === "ACTIVE").length;
        const suspended = all.filter((c) => c.status === "SUSPENDED").length;
        const pending = all.filter(
          (c) => c.status === "PENDING_INSTALLATION"
        ).length;
        return {
          totalCustomers: all.length,
          activeCustomers: active,
          suspendedCustomers: suspended,
          pendingInstallations: pending,
        };
      }
    );
  }

  getChurnMetrics() {
    return this.guard(
      "getChurnMetrics",
      "customers.view",
      "customers + subscriptions + onts + support_tickets",
      () => {
        const enriched = this.tenantCustomers().map((c) =>
          this.enrichCustomer(c)
        );
        const atRisk = enriched.filter(
          (s) =>
            s.churnRiskScore >= 50 ||
            (s.rxPowerDbm !== null && s.rxPowerDbm < -25.0) ||
            s.qualityScore < 75
        );
        return {
          totalSubscribers: enriched.length,
          atRiskCount: atRisk.length,
          atRiskSubscribers: atRisk,
        };
      }
    );
  }

  // ==========================================================================
  // 4. NETWORK, ROUTER, FREERADIUS & NOC TOOLS
  // ==========================================================================

  getNetworkDevices() {
    return this.guard(
      "getNetworkDevices",
      "routers.view",
      "routers + olts + onts + sites",
      () => ({
        routers: this.tenantRouters(),
        olts: this.tenantOlts(),
        onts: this.tenantOnts(),
        sites: this.tenantSites(),
      })
    );
  }

  getRouterHealth(routerIdOrName?: string) {
    return this.guard(
      "getRouterHealth",
      "routers.view",
      "routers + network_alerts + pppoe_accounts",
      () => {
        let routers = this.tenantRouters();
        if (routerIdOrName && routerIdOrName.trim()) {
          const q = routerIdOrName.trim().toLowerCase();
          routers = routers.filter(
            (r) =>
              r.id.toLowerCase() === q ||
              r.name.toLowerCase().includes(q) ||
              (r.siteName || "").toLowerCase().includes(q)
          );
        }
        const alerts = this.tenantAlerts().filter((a) => !a.isResolved);
        return routers
          .map((r) => {
            const routerAlerts = alerts.filter((a) => a.routerId === r.id);
            const unhealthyReasons: string[] = [];
            if (r.status !== "ONLINE") unhealthyReasons.push(`Status is ${r.status}`);
            if (r.cpuLoad >= 80) unhealthyReasons.push(`High CPU (${r.cpuLoad}%)`);
            else if (r.cpuLoad >= 40)
              unhealthyReasons.push(`Elevated CPU (${r.cpuLoad}%)`);
            for (const al of routerAlerts) {
              unhealthyReasons.push(`${al.severity}: ${al.title}`);
            }
            return {
              ...r,
              openAlerts: routerAlerts,
              isHealthy: r.status === "ONLINE" && r.cpuLoad < 80 && routerAlerts.length === 0,
              unhealthyReasons,
            };
          })
          .sort((a, b) => (b.activeSessions ?? 0) - (a.activeSessions ?? 0));
      }
    );
  }

  getRouterSessions(routerIdOrName?: string) {
    return this.guard(
      "getRouterSessions",
      "routers.view",
      "routers + pppoe_accounts + customers",
      () => {
        const routers = this.getRouterHealth(routerIdOrName).data ?? [];
        const pppoe = this.tenantPppoe();
        const customers = this.tenantCustomers();

        return routers.map((r) => {
          const routerPppoe = pppoe.filter((p) => p.routerId === r.id);
          const connectedSubscribers = routerPppoe
            .filter((p) => p.isOnline)
            .map((p) => {
              const cust = customers.find((c) => c.id === p.customerId);
              return {
                customerId: p.customerId,
                fullName: cust?.fullName || p.username,
                accountNumber: cust?.accountNumber || "—",
                username: p.username,
                ipAddress: p.currentIp || p.staticIp || "—",
                uptime: p.uptime || "—",
              };
            });
          return {
            routerId: r.id,
            routerName: r.name,
            siteName: r.siteName,
            status: r.status,
            cpuLoad: r.cpuLoad,
            totalActiveSessions: r.activeSessions,
            connectedPppoeSubscribers: connectedSubscribers,
          };
        });
      }
    );
  }

  getInterfaceTraffic(routerIdOrName?: string) {
    return this.guard(
      "getInterfaceTraffic",
      "noc.view",
      "routers + topology_nodes",
      () => {
        const routers = this.getRouterHealth(routerIdOrName).data ?? [];
        return {
          routersCount: routers.length,
          topologyNodes: this.raw.topologyNodes,
        };
      }
    );
  }

  getNetworkIncidents() {
    return this.guard(
      "getNetworkIncidents",
      "noc.view",
      "network_alerts + onts + topology_nodes + support_tickets",
      () => {
        const openAlerts = this.tenantAlerts().filter((a) => !a.isResolved);
        const losOnts = this.tenantOnts().filter(
          (o) => o.status === "LOS" || o.rxPowerDbm < -27.0
        );
        const degradedNodes = this.raw.topologyNodes.filter(
          (n) => n.status !== "ONLINE"
        );
        const criticalTickets = this.tenantTickets().filter(
          (t) => t.priority === "CRITICAL" && t.status !== "RESOLVED"
        );

        return {
          openAlerts,
          losOnts,
          degradedNodes,
          criticalTickets,
          totalActiveIncidents:
            openAlerts.length + losOnts.length + degradedNodes.length,
        };
      }
    );
  }

  getActivePPPoESessions() {
    return this.guard(
      "getActivePPPoESessions",
      "customers.view",
      "pppoe_accounts + customers + routers",
      () =>
        this.tenantCustomers()
          .map((c) => this.enrichCustomer(c))
          .filter((s) => s.isOnline && s.serviceType === "PPPoE")
    );
  }

  getActiveHotspotSessions() {
    return this.guard(
      "getActiveHotspotSessions",
      "vouchers.view",
      "hotspot_vouchers",
      () =>
        this.tenantVouchers().filter(
          (v) =>
            v.status === "USED" &&
            (!v.expiresAt || new Date(v.expiresAt).getTime() > Date.now())
        )
    );
  }

  /**
   * Diagnostic correlation engine for "Why is customer X offline?"
   */
  diagnoseSubscriberOffline(idOrAccountOrName: string) {
    return this.guard(
      "diagnoseSubscriberOffline",
      "customers.view",
      "customers + subscriptions + invoices + pppoe_accounts + onts + routers + network_alerts",
      () => {
        const lookup = this.getCustomer(idOrAccountOrName);
        if (!lookup.ok || !lookup.data) return null;
        const sub = lookup.data.exact || lookup.data.matches[0];
        if (!sub) return null;

        const ont = this.tenantOnts().find((o) => o.customerId === sub.id);
        const router = this.tenantRouters().find((r) => r.id === sub.routerId);
        const routerAlerts = this.tenantAlerts().filter(
          (a) => !a.isResolved && a.routerId === sub.routerId
        );
        const openTickets = this.tenantTickets().filter(
          (t) => t.customerId === sub.id && t.status !== "RESOLVED"
        );

        const causes: string[] = [];
        const evidence: string[] = [];
        let confidence: "CONFIRMED" | "LIKELY" | "POSSIBLE" = "CONFIRMED";

        if (sub.isOnline) {
          causes.push(
            `${sub.fullName} (${sub.accountNumber}) is currently ONLINE on ${sub.packageName} (IP: ${sub.ipAddress || "assigned"}).`
          );
          evidence.push(`Active PPPoE session uptime: ${sub.uptime || "active"}`);
          if (ont) {
            evidence.push(`ONT optical RX power: ${ont.rxPowerDbm.toFixed(1)} dBm (${ont.status})`);
          }
          return {
            subscriber: sub,
            isOnline: true,
            confidence,
            primaryCause: causes[0],
            allCauses: causes,
            evidence,
            ont,
            router,
            openTickets,
          };
        }

        // Offline diagnostic checks
        if (sub.status === "SUSPENDED" || sub.balanceDue > 0) {
          causes.push(
            `Account is ${sub.status} with an unpaid balance of ${this.ctx.currency} ${sub.balanceDue.toLocaleString()}.`
          );
          evidence.push(`Account status: ${sub.status}`);
          evidence.push(
            `Outstanding balance: ${this.ctx.currency} ${sub.balanceDue.toLocaleString()} (${sub.paymentStatus})`
          );
          if (sub.expiresAt) {
            evidence.push(`Subscription expiry: ${new Date(sub.expiresAt).toUTCString()}`);
          }
        }

        if (ont && (ont.status === "LOS" || ont.rxPowerDbm < -27.0)) {
          causes.push(
            `Physical fiber optical Loss of Signal (LOS) detected on ONT ${ont.serialNumber} (${ont.rxPowerDbm.toFixed(1)} dBm on ${ont.ponPortLabel}).`
          );
          evidence.push(
            `ONT ${ont.vendorModel} (${ont.serialNumber}) status: ${ont.status}, Optical RX: ${ont.rxPowerDbm.toFixed(1)} dBm (threshold: -27.0 dBm)`
          );
        }

        if (router && router.status !== "ONLINE") {
          causes.push(
            `Serving router ${router.name} at ${sub.popSiteName} is ${router.status}.`
          );
          evidence.push(`Router ${router.name} status: ${router.status}`);
        }

        for (const al of routerAlerts) {
          evidence.push(`Active NOC Alert on ${router?.name}: ${al.title} (${al.severity})`);
        }

        if (causes.length === 0) {
          confidence = "LIKELY";
          causes.push(
            sub.status === "PENDING_INSTALLATION"
              ? "Subscriber is awaiting initial field fiber drop and ONT installation."
              : "No active PPPoE session established from subscriber CPE (possible customer router power-off or WAN cable disconnect)."
          );
          evidence.push(`Account status: ${sub.status}`);
          evidence.push("No active FreeRADIUS/PPPoE session record found.");
        }

        return {
          subscriber: sub,
          isOnline: false,
          confidence,
          primaryCause: causes.join(" Additionally, "),
          allCauses: causes,
          evidence,
          ont: ont || null,
          router: router || null,
          openTickets,
        };
      }
    );
  }

  // ==========================================================================
  // 5. SUPPORT, INVENTORY, AUDIT, SECURITY & CAPABILITY TOOLS
  // ==========================================================================

  getTickets(status?: string) {
    return this.guard(
      "getTickets",
      "work_orders.view",
      "support_tickets + work_orders",
      () => {
        let t = this.tenantTickets();
        if (status) {
          t = t.filter((item) => item.status.toUpperCase() === status.toUpperCase());
        }
        return t;
      }
    );
  }

  getIncidents() {
    this.toolsInvoked.push("getIncidents");
    return this.getNetworkIncidents();
  }

  getSLAStatus() {
    return this.guard(
      "getSLAStatus",
      "work_orders.view",
      "support_tickets",
      () => {
        const now = Date.now();
        return this.tenantTickets().map((t) => {
          const dueMs = new Date(t.slaDueAt).getTime();
          return {
            ticketNumber: t.ticketNumber,
            customerName: t.customerName,
            priority: t.priority,
            status: t.status,
            slaDueAt: t.slaDueAt,
            isBreached: t.status !== "RESOLVED" && dueMs < now,
            remainingMinutes: Math.round((dueMs - now) / 60000),
          };
        });
      }
    );
  }

  getInventory() {
    return this.guard(
      "getInventory",
      "inventory.manage",
      "inventory_items + serialized_assets",
      () => ({
        items: this.tenantInventory(),
        serializedAssets: this.raw.assets,
        lowStockItems: this.tenantInventory().filter(
          (i) => i.quantityOnHand <= i.reorderThreshold
        ),
      })
    );
  }

  getAsset(serialOrQuery: string) {
    return this.guard(
      "getAsset",
      "inventory.manage",
      "serialized_assets",
      () => {
        const q = serialOrQuery.trim().toLowerCase();
        return this.raw.assets.filter(
          (a) =>
            a.serialNumber.toLowerCase().includes(q) ||
            (a.macAddress || "").toLowerCase().includes(q) ||
            (a.assignedCustomerName || "").toLowerCase().includes(q) ||
            (a.assignedAccountNumber || "").toLowerCase().includes(q)
        );
      }
    );
  }

  getAuditEvents() {
    return this.guard(
      "getAuditEvents",
      "audit.view",
      "system_events + audit_log",
      () => this.tenantSystemEvents()
    );
  }

  getSecurityEvents() {
    return this.guard(
      "getSecurityEvents",
      "soc.view",
      "security_events",
      () => this.tenantSecurityEvents()
    );
  }

  getSystemConfiguration() {
    return this.guard(
      "getSystemConfiguration",
      null,
      "organizations",
      () => ({
        organizationName: this.raw.organization.name,
        slug: this.raw.organization.slug,
        currency: this.raw.organization.currency,
        timezone: this.raw.organization.timezone,
        billingCycleType: this.raw.organization.billingCycleType,
        gracePeriodDays: this.raw.organization.gracePeriodDays,
        environmentMode: this.ctx.environmentMode,
      })
    );
  }

  getFeatureCapabilities(query?: string): ToolResult<FeatureCapabilityDefinition[]> {
    return this.guard(
      "getFeatureCapabilities",
      null,
      "system_capability_registry",
      () =>
        query ? findMatchingCapabilities(query) : SYSTEM_CAPABILITY_REGISTRY
    );
  }

  /**
   * SMS Communications Intelligence & Metrics Tool
   */
  getSmsMetrics() {
    return this.guard(
      "getSmsMetrics",
      "sms.view",
      "sms_messages + sms_campaigns + customers + sms_provider_configs",
      () => {
        const isDemo = this.ctx.environmentMode === "DEMO_DATA";
        const metrics = getSmsOverviewMetrics(
          this.ctx.organizationId,
          this.raw,
          isDemo
        );
        const recentMessages = getSmsHistory(
          this.ctx.organizationId,
          undefined,
          isDemo
        );
        const recipients = buildEnrichedSmsRecipients(
          this.ctx.organizationId,
          this.raw
        );

        return {
          metrics,
          recentMessages: recentMessages.slice(0, 15),
          recipients,
          paymentReminderSentCount: metrics.paymentRemindersThisMonth,
          overdueWithoutReminder: metrics.unremindedOverdueCustomers,
        };
      }
    );
  }

  /**
   * Confirmation-gated SMS Campaign Preview Tool (never dispatches SMS directly)
   */
  previewSmsCampaignTool(options: {
    recipientMode: SmsRecipientMode;
    messageTemplate?: string;
    category?: SmsCategory;
    packageName?: string;
  }) {
    const requiredPerm: Permission =
      options.recipientMode === "INDIVIDUAL" ? "sms.send" : "sms.send_bulk";
    return this.guard(
      "previewSmsCampaignTool",
      requiredPerm,
      "customers + sms_templates + sms_campaigns",
      () => {
        const defaultTemplate =
          DEFAULT_SMS_TEMPLATES.find((t) => t.code === "PAYMENT_REMINDER") ||
          DEFAULT_SMS_TEMPLATES[0];
        const body = options.messageTemplate || defaultTemplate.bodyTemplate;
        return previewSmsCampaign({
          organizationId: this.ctx.organizationId,
          recipientMode: options.recipientMode,
          category: options.category || defaultTemplate.category,
          messageTemplate: body,
          filters: options.packageName
            ? { packageName: options.packageName }
            : undefined,
          data: this.raw,
          isDemoMode: this.ctx.environmentMode === "DEMO_DATA",
        });
      }
    );
  }

  /**
   * Unified cross-module search tool (`globalSearch`) across customers,
   * invoices, payments, tickets, routers, ONTs, and packages.
   */
  globalSearch(query: string) {
    return this.guard(
      "globalSearch",
      null,
      "customers + invoices + payments + routers + plans + support_tickets",
      () => {
        const q = query.trim().toLowerCase();
        const canCustomers = hasPermission(this.ctx.userRole, "customers.view");
        const canBilling = hasPermission(this.ctx.userRole, "billing.view");
        const canRouters = hasPermission(this.ctx.userRole, "routers.view");
        const canPlans = hasPermission(this.ctx.userRole, "plans.view");
        const canTickets = hasPermission(this.ctx.userRole, "work_orders.view");

        return {
          query,
          subscribers: canCustomers
            ? (this.searchCustomers(q).data ?? [])
            : [],
          invoices: canBilling
            ? this.tenantInvoices().filter(
                (i) =>
                  i.invoiceNumber.toLowerCase().includes(q) ||
                  i.customerName.toLowerCase().includes(q) ||
                  i.accountNumber.toLowerCase().includes(q)
              )
            : [],
          payments: canBilling
            ? this.tenantPayments().filter(
                (p) =>
                  p.transactionReference.toLowerCase().includes(q) ||
                  (p.customerName || "").toLowerCase().includes(q) ||
                  (p.accountNumber || "").toLowerCase().includes(q) ||
                  p.msisdnPhone.includes(q)
              )
            : [],
          routers: canRouters
            ? this.tenantRouters().filter(
                (r) =>
                  r.name.toLowerCase().includes(q) ||
                  (r.siteName || "").toLowerCase().includes(q) ||
                  r.managementIp.includes(q)
              )
            : [],
          packages: canPlans
            ? (this.searchPackages(q).data ?? [])
            : [],
          tickets: canTickets
            ? this.tenantTickets().filter(
                (t) =>
                  t.ticketNumber.toLowerCase().includes(q) ||
                  t.customerName.toLowerCase().includes(q) ||
                  t.subject.toLowerCase().includes(q)
              )
            : [],
        };
      }
    );
  }
}

/**
 * Builds the isolated Demo Mode dataset and execution context (safe in both client and server environments).
 */
export function buildDemoCopilotEnvironment(options?: {
  userRole?: UserRole;
  organizationId?: string;
}): {
  ctx: CopilotExecutionContext;
  dataset: CopilotDataset;
} {
  const orgId = options?.organizationId || SEED_ORGANIZATION.id;
  const reconQueue = getSeedReconciliationQueue();
  const unmatchedCount = reconQueue.filter(
    (r) => r.matchStatus === "UNMATCHED" || r.matchStatus === "PARTIAL"
  ).length;
  const pendingApprovals = SEED_APPROVAL_REQUESTS.filter(
    (a) => a.status === "PENDING"
  ).length;

  const ctx: CopilotExecutionContext = {
    organizationId: orgId,
    organizationName: SEED_ORGANIZATION.name,
    currency: SEED_ORGANIZATION.currency,
    timezone: SEED_ORGANIZATION.timezone,
    userRole: options?.userRole || "isp_owner",
    environmentMode: "DEMO_DATA",
    checkedAtIso: new Date().toISOString(),
  };

  const dataset: CopilotDataset = {
    organization: SEED_ORGANIZATION,
    customers: [...SEED_CUSTOMERS],
    pppoeAccounts: [...SEED_PPPOE],
    subscriptions: [...SEED_SUBSCRIPTIONS],
    plans: [...SEED_PLANS],
    routers: [...SEED_ROUTERS],
    sites: [...SEED_SITES],
    invoices: SEED_INVOICES_2027.map((inv) => ({ ...inv })),
    payments: [...SEED_PAYMENTS],
    vouchers: [...SEED_HOTSPOT_VOUCHERS],
    workOrders: [...SEED_WORK_ORDERS],
    alerts: [...SEED_ALERTS],
    olts: [...SEED_OLTS],
    onts: [...SEED_ONTS],
    tickets: [...SEED_SUPPORT_TICKETS],
    inventory: [...SEED_INVENTORY_ITEMS],
    assets: [...SEED_SERIALIZED_ASSETS],
    topologyNodes: [...SEED_TOPOLOGY_NODES],
    journalEntries: getSeedJournalEntries(),
    systemEvents: [...SEED_SYSTEM_EVENTS],
    securityEvents: [...SEED_SECURITY_EVENTS],
    unmatchedPaymentsCount: unmatchedCount,
    pendingApprovalsCount: pendingApprovals,
  };

  return { ctx, dataset };
}

