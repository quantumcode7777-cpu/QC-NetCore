// ============================================================================
// QC NETCORE — LIVE MULTI-TENANT SUPABASE vs. DEMO DATA LOADER FOR AI COPILOT
// ============================================================================
// Strictly separates:
// - LIVE_TENANT_DATA: Real PostgreSQL records queried via Supabase with RLS
//   and explicit organization_id scoping for the authenticated tenant.
// - DEMO_DATA: Isolated demonstration dataset used only when the operator is
//   explicitly running in Demo Mode (?demo=true / gtech_demo_mode=true).
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
import {
  postInvoiceToLedger,
  postPaymentToLedger,
  type JournalEntry,
} from "../ledger/ledger.ts";
import {
  buildDemoCopilotEnvironment,
  type CopilotDataset,
  type CopilotExecutionContext,
  type CopilotInvoiceRecord,
} from "./copilot-tools.ts";

export { buildDemoCopilotEnvironment };

const SUPABASE_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://[PROJECT_REF].supabase.co"
);

function buildEmptyLiveCopilotEnvironment(options?: {
  organizationId?: string;
  organizationName?: string;
  userRole?: UserRole;
  userId?: string;
  userEmail?: string;
}): {
  ctx: CopilotExecutionContext;
  dataset: CopilotDataset;
} {
  const orgId = options?.organizationId || "org-live-unconfigured";
  const orgName = options?.organizationName || "ISP Workspace";
  const nowIso = new Date().toISOString();

  const organization: Organization = {
    id: orgId,
    name: orgName,
    slug: "isp-workspace",
    email: options?.userEmail || "",
    phone: "",
    currency: "KES",
    timezone: "Africa/Nairobi",
    billingCycleType: "ANNIVERSARY",
    gracePeriodDays: 2,
    isActive: true,
    createdAt: nowIso,
  };

  const ctx: CopilotExecutionContext = {
    organizationId: orgId,
    organizationName: orgName,
    currency: "KES",
    timezone: "Africa/Nairobi",
    userRole: options?.userRole ?? "isp_admin",
    userId: options?.userId,
    userEmail: options?.userEmail,
    environmentMode: "LIVE_TENANT_DATA",
    checkedAtIso: nowIso,
  };

  const dataset: CopilotDataset = {
    organization,
    customers: [],
    pppoeAccounts: [],
    subscriptions: [],
    plans: [],
    routers: [],
    sites: [],
    invoices: [],
    payments: [],
    vouchers: [],
    workOrders: [],
    alerts: [],
    olts: [],
    onts: [],
    tickets: [],
    inventory: [],
    assets: [],
    topologyNodes: [],
    journalEntries: [],
    systemEvents: [],
    securityEvents: [],
    unmatchedPaymentsCount: 0,
    pendingApprovalsCount: 0,
  };

  return { ctx, dataset };
}

/**
 * Resolves the authoritative Copilot environment (Live Supabase Tenant Data vs. Demo Data).
 */
export async function loadLiveOrDemoCopilotEnvironment(options?: {
  explicitDemoMode?: boolean;
  userRoleOverride?: UserRole;
}): Promise<{
  ctx: CopilotExecutionContext;
  dataset: CopilotDataset;
}> {
  let isDemo = options?.explicitDemoMode;

  if (isDemo === undefined) {
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      isDemo = cookieStore.get("gtech_demo_mode")?.value === "true";
    } catch {
      isDemo = false;
    }
  }

  if (isDemo) {
    return buildDemoCopilotEnvironment({ userRole: options?.userRoleOverride });
  }

  if (!SUPABASE_CONFIGURED) {
    return buildEmptyLiveCopilotEnvironment({
      userRole: options?.userRoleOverride,
    });
  }

  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return buildEmptyLiveCopilotEnvironment({
        userRole: options?.userRoleOverride,
      });
    }

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profileRow || !profileRow.organization_id) {
      return buildEmptyLiveCopilotEnvironment({
        organizationId: `org-user-${user.id}`,
        organizationName:
          (user.user_metadata?.organization_name as string | undefined) ||
          "ISP Workspace",
        userRole: options?.userRoleOverride,
        userId: user.id,
        userEmail: user.email,
      });
    }

    const orgId = profileRow.organization_id as string;
    const userRole =
      options?.userRoleOverride ||
      ((profileRow.role as UserRole) ?? "isp_admin");

    // Retrieve all tenant-scoped operational domains in parallel
    const [
      orgRes,
      custRes,
      pppoeRes,
      subRes,
      plansRes,
      routersRes,
      sitesRes,
      invRes,
      payRes,
      vouchRes,
      woRes,
      alertRes,
    ] = await Promise.all([
      supabase.from("organizations").select("*").eq("id", orgId).single(),
      supabase
        .from("customers")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(250),
      supabase
        .from("pppoe_accounts")
        .select(
          "id, organization_id, customer_id, router_id, username, service_plan_id, ip_assignment_type, static_ip, mac_address, is_active, created_at"
        )
        .eq("organization_id", orgId)
        .limit(250),
      supabase
        .from("subscriptions")
        .select("*")
        .eq("organization_id", orgId)
        .limit(250),
      supabase
        .from("plans")
        .select("*")
        .eq("organization_id", orgId)
        .limit(100),
      supabase
        .from("routers")
        .select(
          "id, organization_id, site_id, name, management_ip, api_port, api_ssl_port, username, routeros_version, board_model, cpu_load, free_memory_mb, uptime, connection_type, wireguard_public_key, wireguard_tunnel_ip, status, last_seen_at, created_at"
        )
        .eq("organization_id", orgId)
        .limit(100),
      supabase
        .from("sites")
        .select("*")
        .eq("organization_id", orgId)
        .limit(100),
      supabase
        .from("invoices")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(250),
      supabase
        .from("payments")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(250),
      supabase
        .from("hotspot_vouchers")
        .select("*")
        .eq("organization_id", orgId)
        .limit(250),
      supabase
        .from("work_orders")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("network_alerts")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const orgRow = orgRes.data;
    const organization: Organization = orgRow
      ? {
          id: orgRow.id,
          name: orgRow.name,
          slug: orgRow.slug,
          businessNumber: orgRow.business_number || undefined,
          email: orgRow.email,
          phone: orgRow.phone,
          currency: orgRow.currency || "KES",
          timezone: orgRow.timezone || "Africa/Nairobi",
          billingCycleType: orgRow.billing_cycle_type,
          gracePeriodDays: orgRow.grace_period_days ?? 2,
          isActive: orgRow.is_active,
          createdAt: orgRow.created_at,
        }
      : {
          id: orgId,
          name: "ISP Workspace",
          slug: "isp-workspace",
          email: user.email || "",
          phone: "",
          currency: "KES",
          timezone: "Africa/Nairobi",
          billingCycleType: "ANNIVERSARY",
          gracePeriodDays: 2,
          isActive: true,
          createdAt: new Date().toISOString(),
        };

    const sites: Site[] = (sitesRes.data ?? []).map((s) => ({
      id: s.id,
      organizationId: s.organization_id,
      name: s.name,
      locationDescription: s.location_description || undefined,
      latitude: s.latitude ?? undefined,
      longitude: s.longitude ?? undefined,
      powerBackupType: s.power_backup_type || undefined,
      routerCount: 0,
      customerCount: 0,
      createdAt: s.created_at,
    }));

    const plans: ServicePlan[] = (plansRes.data ?? []).map((p) => ({
      id: p.id,
      organizationId: p.organization_id,
      name: p.name,
      serviceType: p.service_type,
      downloadSpeedKbps: p.download_speed_kbps,
      uploadSpeedKbps: p.upload_speed_kbps,
      burstDownloadKbps: p.burst_download_kbps,
      burstUploadKbps: p.burst_upload_kbps,
      burstThresholdKbps: p.burst_threshold_kbps,
      burstTimeSeconds: p.burst_time_seconds,
      priority: p.priority,
      validityDurationSeconds: p.validity_duration_seconds,
      dataLimitMb: p.data_limit_mb,
      price: Number(p.price ?? 0),
      currency: p.currency || organization.currency,
      simultaneousSessions: p.simultaneous_sessions,
      mikrotikRateLimit: p.mikrotik_rate_limit,
      isActive: p.is_active,
      createdAt: p.created_at,
    }));

    const customers: Customer[] = (custRes.data ?? []).map((c) => {
      const site = sites.find((s) => s.id === c.site_id);
      return {
        id: c.id,
        organizationId: c.organization_id,
        accountNumber: c.account_number,
        fullName: c.full_name,
        phoneNumber: c.phone_number,
        altPhoneNumber: c.alt_phone_number || undefined,
        email: c.email || undefined,
        nationalId: c.national_id || undefined,
        physicalAddress: c.physical_address || undefined,
        siteId: c.site_id || undefined,
        siteName: site?.name,
        status: c.status,
        balanceDue: Number(c.balance_due ?? 0),
        createdAt: c.created_at,
      };
    });

    const pppoeAccounts: PppoeAccount[] = (pppoeRes.data ?? []).map((p) => ({
      id: p.id,
      organizationId: p.organization_id,
      customerId: p.customer_id,
      routerId: p.router_id || "",
      username: p.username,
      passwordPlain: "[REDACTED]",
      servicePlanId: p.service_plan_id,
      ipAssignmentType: p.ip_assignment_type,
      staticIp: p.static_ip || undefined,
      currentIp: p.static_ip || undefined,
      macAddress: p.mac_address || undefined,
      isActive: p.is_active,
      isOnline: p.is_active,
      bytesIn: 0,
      bytesOut: 0,
    }));

    const subscriptions: Subscription[] = (subRes.data ?? []).map((s) => {
      const plan = plans.find((p) => p.id === s.plan_id);
      return {
        id: s.id,
        organizationId: s.organization_id,
        customerId: s.customer_id,
        planId: s.plan_id,
        planName: plan?.name,
        startTime: s.start_time,
        endTime: s.end_time,
        graceEndTime: s.grace_end_time || undefined,
        status: s.status === "GRACE" ? "ACTIVE" : s.status,
        autoRenew: s.auto_renew,
        lastRenewedAt: s.last_renewed_at || undefined,
        createdAt: s.created_at,
      };
    });

    const routers: Router[] = (routersRes.data ?? []).map((r) => {
      const site = sites.find((s) => s.id === r.site_id);
      const activeCount = pppoeAccounts.filter(
        (p) => p.routerId === r.id && p.isOnline
      ).length;
      return {
        id: r.id,
        organizationId: r.organization_id,
        siteId: r.site_id || "",
        siteName: site?.name,
        name: r.name,
        managementIp: r.management_ip,
        apiPort: r.api_port,
        apiSslPort: r.api_ssl_port,
        username: r.username,
        routerosVersion: r.routeros_version || "v7",
        boardModel: r.board_model || "MikroTik",
        cpuLoad: Number(r.cpu_load ?? 0),
        freeMemoryMb: Number(r.free_memory_mb ?? 0),
        uptime: r.uptime || "—",
        connectionType: r.connection_type,
        wireguardPublicKey: r.wireguard_public_key || undefined,
        wireguardTunnelIp: r.wireguard_tunnel_ip || undefined,
        status: r.status === "UNREACHABLE" ? "OFFLINE" : r.status,
        lastSeenAt: r.last_seen_at || r.created_at,
        activeSessions: activeCount,
        createdAt: r.created_at,
      };
    });

    const invoices: CopilotInvoiceRecord[] = (invRes.data ?? []).map((i) => {
      const cust = customers.find((c) => c.id === i.customer_id);
      return {
        id: i.id,
        organizationId: i.organization_id,
        customerId: i.customer_id,
        customerName: cust?.fullName || "Subscriber",
        accountNumber: cust?.accountNumber || "—",
        invoiceNumber: i.invoice_number,
        subtotal: Number(i.subtotal ?? 0),
        taxAmount: Number(i.tax_amount ?? 0),
        totalAmount: Number(i.total_amount ?? 0),
        amountPaid: Number(i.amount_paid ?? 0),
        balanceDue: Number(i.balance_due ?? 0),
        status: i.status,
        dueDate: i.due_date,
        createdAt: i.created_at,
      };
    });

    const payments: Payment[] = (payRes.data ?? []).map((p) => {
      const cust = customers.find((c) => c.id === p.customer_id);
      return {
        id: p.id,
        organizationId: p.organization_id,
        customerId: p.customer_id || undefined,
        customerName: cust?.fullName || p.sender_name || undefined,
        accountNumber: cust?.accountNumber,
        invoiceId: p.invoice_id || undefined,
        paymentMethod: p.payment_method,
        amount: Number(p.amount ?? 0),
        currency: p.currency || organization.currency,
        transactionReference: p.transaction_reference,
        msisdnPhone: p.msisdn_phone,
        senderName: p.sender_name || undefined,
        status: p.status === "INITIATED" ? "PENDING" : p.status,
        processedAt: p.processed_at || undefined,
        createdAt: p.created_at,
      };
    });

    const vouchers: HotspotVoucher[] = (vouchRes.data ?? []).map((v) => {
      const plan = plans.find((p) => p.id === v.plan_id);
      return {
        id: v.id,
        organizationId: v.organization_id,
        batchId: v.batch_id || "",
        planId: v.plan_id,
        planName: plan?.name,
        planPrice: plan?.price,
        code: v.code,
        status: v.status,
        firstActivatedAt: v.first_activated_at || undefined,
        expiresAt: v.expires_at || undefined,
        usedByPhone: v.used_by_phone || undefined,
        usedMacAddress: v.used_mac_address || undefined,
        createdAt: v.created_at,
      };
    });

    const workOrders: WorkOrder[] = (woRes.data ?? []).map((w) => {
      const cust = customers.find((c) => c.id === w.customer_id);
      return {
        id: w.id,
        organizationId: w.organization_id,
        ticketNumber: w.ticket_number,
        customerId: w.customer_id || undefined,
        customerName: cust?.fullName,
        customerPhone: cust?.phoneNumber,
        customerAddress: cust?.physicalAddress,
        assignedTechnicianId: w.assigned_technician_id || undefined,
        title: w.title,
        description: w.description,
        orderType: w.order_type,
        priority: w.priority,
        status: w.status,
        scheduledDate: w.scheduled_date || undefined,
        completedAt: w.completed_at || undefined,
        notes: w.notes || undefined,
        createdAt: w.created_at,
      };
    });

    const alerts: NetworkAlert[] = (alertRes.data ?? []).map((a) => {
      const rtr = routers.find((r) => r.id === a.router_id);
      return {
        id: a.id,
        organizationId: a.organization_id,
        routerId: a.router_id || undefined,
        routerName: rtr?.name,
        severity: a.severity,
        title: a.title,
        message: a.message,
        isResolved: a.is_resolved,
        resolvedAt: a.resolved_at || undefined,
        createdAt: a.created_at,
      };
    });

    // Construct balanced double-entry journal entries from live invoices & payments
    const journalEntries: JournalEntry[] = [];
    for (const inv of invoices) {
      journalEntries.push(
        postInvoiceToLedger({
          organizationId: orgId,
          entryNumber: `JE-${inv.invoiceNumber}`,
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
    for (const pay of payments.filter((p) => p.status === "COMPLETED")) {
      journalEntries.push(
        postPaymentToLedger({
          organizationId: orgId,
          entryNumber: `JE-PAY-${pay.transactionReference}`,
          paymentId: pay.id,
          transactionReference: pay.transactionReference,
          customerId: pay.customerId,
          customerName: pay.customerName,
          totalAmount: pay.amount,
          allocatedToAr: pay.customerId ? pay.amount : 0,
          directVoucherRevenue: pay.customerId ? 0 : pay.amount,
          postedAt: pay.processedAt || pay.createdAt,
        })
      );
    }

    const unmatchedCount = payments.filter(
      (p) => p.status === "COMPLETED" && !p.customerId && !p.invoiceId
    ).length;

    const ctx: CopilotExecutionContext = {
      organizationId: orgId,
      organizationName: organization.name,
      currency: organization.currency,
      timezone: organization.timezone,
      userRole,
      userId: user.id,
      userEmail: user.email,
      environmentMode: "LIVE_TENANT_DATA",
      checkedAtIso: new Date().toISOString(),
    };

    const dataset: CopilotDataset = {
      organization,
      customers,
      pppoeAccounts,
      subscriptions,
      plans,
      routers,
      sites,
      invoices,
      payments,
      vouchers,
      workOrders,
      alerts,
      olts: [],
      onts: [],
      tickets: workOrders.map((w) => ({
        id: w.id,
        organizationId: w.organizationId,
        ticketNumber: w.ticketNumber,
        customerId: w.customerId || "",
        customerName: w.customerName || "Subscriber",
        accountNumber: "—",
        channel: "PORTAL",
        category: w.orderType === "REPAIR" ? "LOS_RED_LIGHT" : "NO_INTERNET",
        priority: w.priority,
        status: w.status === "COMPLETED" ? "RESOLVED" : "IN_PROGRESS",
        subject: w.title,
        description: w.description,
        slaDueAt: w.scheduledDate || new Date(Date.now() + 86400000).toISOString(),
        createdAt: w.createdAt,
      })),
      inventory: [],
      assets: [],
      topologyNodes: [],
      journalEntries,
      systemEvents: [],
      securityEvents: [],
      unmatchedPaymentsCount: unmatchedCount,
      pendingApprovalsCount: 0,
    };

    return { ctx, dataset };
  } catch {
    return buildEmptyLiveCopilotEnvironment({
      userRole: options?.userRoleOverride,
    });
  }
}
