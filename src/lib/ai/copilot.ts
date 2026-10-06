// ============================================================================
// QC NETCORE — GROUNDED AI ISP OPERATIONS COPILOT ENGINE
// ============================================================================
// Produces clean, natural, plain-text responses grounded in authoritative
// tenant data and verified platform capabilities while enforcing RBAC,
// multi-tenant isolation, and secret redaction.
// ============================================================================

import {
  CopilotToolkit,
  buildDemoCopilotEnvironment,
  recordCopilotAudit,
  type CopilotDataset,
  type CopilotEnvironmentMode,
  type CopilotExecutionContext,
  type EnrichedSubscriberRecord,
} from "./copilot-tools.ts";
import { formatPhoneForDisplay } from "../sms/phone.ts";
import type { UserRole } from "../../types/index.ts";

export interface CopilotContextSnapshot {
  organizationName: string;
  subscribers: Array<{
    id: string;
    accountNumber: string;
    fullName: string;
    status: string;
    balanceDue: number;
    planName: string;
    siteName: string;
    isOnline: boolean;
    rxPowerDbm: number;
    qualityScore: number;
    churnRiskScore: number;
    churnRiskTier: string;
  }>;
  financials: {
    mrr: number;
    arr: number;
    arpu: number;
    collectedThisPeriod: number;
    collectionRatePercent: number;
    totalArOutstanding: number;
    trialBalanceBalanced: boolean;
    pendingApprovalsCount: number;
    unmatchedPaymentsCount: number;
  };
  network: {
    totalRouters: number;
    onlineRouters: number;
    totalOlts: number;
    losOntCount: number;
    openAlertsCount: number;
  };
}

export interface CopilotProposedAction {
  actionId: string;
  label: string;
  targetAccount?: string;
  permissionRequired: string;
  requiresConfirmation: true;
  commandPreview: string;
}

export interface CopilotConversationMemory {
  lastSubscriberId?: string;
  lastSubscriberName?: string;
  lastAccountNumber?: string;
  lastPackageId?: string;
  lastPackageName?: string;
  lastRouterId?: string;
  lastRouterName?: string;
}

export type CopilotIntent =
  | "SUBSCRIBER_DIAGNOSTIC"
  | "NEWEST_SUBSCRIBER_LOOKUP"
  | "SUBSCRIBER_LIST_FILTER"
  | "CUSTOMER_360_DOSSIER"
  | "CONTEXTUAL_FOLLOW_UP"
  | "CHURN_AND_OPTICAL_AUDIT"
  | "REVENUE_AND_LEDGER_SUMMARY"
  | "TODAYS_COLLECTIONS_SUMMARY"
  | "OVERDUE_ACCOUNTS_RANKING"
  | "PACKAGE_ANALYTICS"
  | "NETWORK_AND_OUTAGE_STATUS"
  | "ROUTER_SESSIONS_AND_HEALTH"
  | "BUSINESS_PERFORMANCE_SUMMARY"
  | "SMS_COMMUNICATIONS_QUERY"
  | "SMS_CAMPAIGN_PROPOSAL"
  | "FEATURE_AND_NAVIGATION_GUIDE"
  | "AMBIGUOUS_QUERY_CLARIFICATION"
  | "SECURITY_POLICY_REFUSAL"
  | "PERMISSION_DENIED"
  | "GENERAL_OPERATIONS_BRIEF";

export interface CopilotResponse {
  intent: CopilotIntent;
  headline: string;
  answerMarkdown: string;
  metricsCited: Array<{ label: string; value: string }>;
  proposedActions: CopilotProposedAction[];
  toolsInvoked?: string[];
  sourcesCited?: string[];
  environmentMode?: CopilotEnvironmentMode;
  dataCheckedAt?: string;
  confidenceLevel?: "CONFIRMED" | "LIKELY" | "POSSIBLE";
  conversationContext?: CopilotConversationMemory;
}

/**
 * Strips Markdown formatting artifacts (#, ##, ###, *, **, ***, _, __, `, >, pipe tables)
 * so user-facing Copilot output is always clean, readable plain text.
 */
export function sanitizeToPlainText(input: string): string {
  if (!input) return "";
  return input
    .replace(/```[\s\S]*?```/g, (block) =>
      block.replace(/```[a-zA-Z0-9_-]*\n?/g, "").replace(/```/g, "")
    )
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, "$1")
    .replace(/\b_{1,2}([^_\n]+)_{1,2}\b/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/gm, "")
    .replace(/\|/g, " ")
    .replace(/([A-Z0-9])_([A-Z0-9])/g, "$1 $2")
    .replace(/[#*`_~]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isTechnicalCodeOrRouteRequest(prompt: string): boolean {
  return /\b(source code|sql query|api endpoint|api path|route path|database table|schema|cli command)\b/i.test(
    prompt
  );
}

function formatDateTimeEAT(iso?: string | null, timezone = "Africa/Nairobi"): string {
  if (!iso) return "Not recorded";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone,
    }).format(d);
  } catch {
    return d.toUTCString();
  }
}

function formatDateOnly(iso?: string | null, timezone = "Africa/Nairobi"): string {
  if (!iso) return "Not scheduled";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: timezone,
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function adaptSnapshotToEnvironment(snapshot: CopilotContextSnapshot): {
  ctx: CopilotExecutionContext;
  dataset: CopilotDataset;
} {
  const base = buildDemoCopilotEnvironment();
  const orgId = base.ctx.organizationId;

  if (snapshot.subscribers && snapshot.subscribers.length > 0) {
    base.dataset.customers = snapshot.subscribers.map((s, idx) => {
      const existing = base.dataset.customers.find(
        (c) => c.id === s.id || c.accountNumber === s.accountNumber
      );
      return {
        id: s.id || existing?.id || `cust-snap-${idx}`,
        organizationId: orgId,
        accountNumber: s.accountNumber,
        fullName: s.fullName,
        phoneNumber: existing?.phoneNumber || "0700000000",
        email: existing?.email,
        physicalAddress: existing?.physicalAddress || s.siteName,
        siteName: s.siteName,
        status: (s.status as "ACTIVE" | "SUSPENDED") || "ACTIVE",
        balanceDue: s.balanceDue,
        createdAt:
          existing?.createdAt ||
          new Date(Date.now() - (idx + 1) * 86400000).toISOString(),
      };
    });

    base.dataset.pppoeAccounts = snapshot.subscribers.map((s) => {
      const existing = base.dataset.pppoeAccounts.find(
        (p) => p.customerId === s.id
      );
      return {
        id: existing?.id || `pppoe-${s.id}`,
        organizationId: orgId,
        customerId: s.id,
        routerId: existing?.routerId || "rtr-01",
        username: existing?.username || `user_${s.accountNumber.toLowerCase()}`,
        passwordPlain: "[REDACTED]",
        servicePlanId: existing?.servicePlanId || "plan-pppoe-10m",
        ipAssignmentType: existing?.ipAssignmentType || "POOL",
        currentIp: existing?.currentIp || (s.isOnline ? "10.10.12.45" : undefined),
        macAddress: existing?.macAddress,
        isActive: s.status === "ACTIVE",
        isOnline: s.isOnline,
        uptime: existing?.uptime || (s.isOnline ? "2d 04h" : "0s"),
        bytesIn: existing?.bytesIn || 0,
        bytesOut: existing?.bytesOut || 0,
      };
    });

    base.dataset.onts = snapshot.subscribers.map((s) => {
      const existing = base.dataset.onts.find((o) => o.customerId === s.id);
      return {
        id: existing?.id || `ont-${s.id}`,
        organizationId: orgId,
        oltId: existing?.oltId || "olt-01",
        oltName: existing?.oltName || "Huawei-MA5800-X7-CBD",
        customerId: s.id,
        customerName: s.fullName,
        accountNumber: s.accountNumber,
        serialNumber: existing?.serialNumber || `HWTC-${s.accountNumber}`,
        vendorModel: existing?.vendorModel || "Huawei EchoLife HG8546M",
        ponPortLabel: existing?.ponPortLabel || "GPON 0/1/0:1",
        rxPowerDbm: s.rxPowerDbm,
        txPowerDbm: 2.2,
        oltRxPowerDbm: s.rxPowerDbm - 1.4,
        temperatureC: 42,
        voltageV: 3.3,
        distanceMeters: 1200,
        serviceVlan: 210,
        status: s.rxPowerDbm < -27.0 ? "LOS" : s.isOnline ? "ONLINE" : "OFFLINE",
        firmwareVersion: "V5R019",
        connectedClients: s.isOnline ? 4 : 0,
        lastSeenAt: new Date().toISOString(),
      };
    });
  }

  base.ctx.organizationName = snapshot.organizationName || base.ctx.organizationName;
  base.dataset.organization.name = base.ctx.organizationName;
  return base;
}

/**
 * Formats a subscriber record into clean plain text without Markdown symbols.
 */
function formatEnrichedSubscriberPlainText(
  sub: EnrichedSubscriberRecord,
  ctx: CopilotExecutionContext,
  leadSentence?: string
): string {
  const lines: string[] = [];
  if (leadSentence) {
    lines.push(leadSentence);
  }
  lines.push(`Customer: ${sub.fullName}`);
  lines.push(`Customer ID: ${sub.accountNumber}`);
  if (sub.phoneNumber) {
    lines.push(`Phone: ${formatPhoneForDisplay(sub.phoneNumber)}`);
  }
  lines.push(`Service: ${sub.serviceType}`);
  lines.push(`Package: ${sub.packageName} (${sub.speedMbpsLabel})`);
  lines.push(
    `IP address: ${sub.ipAddress ? sub.ipAddress : "No active IP assigned"}`
  );
  lines.push(`Status: ${sub.status}`);
  lines.push(
    `Session status: ${sub.sessionStatus}${
      sub.isOnline && sub.uptime ? ` (${sub.uptime})` : ""
    }`
  );
  lines.push(`POP: ${sub.popSiteName}`);
  if (sub.routerName) {
    lines.push(`Router: ${sub.routerName}`);
  }
  lines.push(
    `Registration date: ${formatDateTimeEAT(sub.registeredAt, ctx.timezone)}`
  );
  if (sub.lastPaymentAmount !== null) {
    lines.push(
      `Last payment: ${ctx.currency} ${sub.lastPaymentAmount.toLocaleString()}${
        sub.lastPaymentReference ? ` (${sub.lastPaymentReference})` : ""
      }${
        sub.lastPaymentDate
          ? ` on ${formatDateOnly(sub.lastPaymentDate, ctx.timezone)}`
          : ""
      }`
    );
  } else {
    lines.push("Last payment: No confirmed payment recorded");
  }
  lines.push(`Payment status: ${sub.paymentStatus}`);
  lines.push(`Balance due: ${ctx.currency} ${sub.balanceDue.toLocaleString()}`);
  lines.push(
    `Expiry date: ${
      sub.expiresAt
        ? formatDateOnly(sub.expiresAt, ctx.timezone)
        : "Not scheduled"
    }`
  );
  if (sub.rxPowerDbm !== null) {
    lines.push(
      `Optical signal: ${sub.rxPowerDbm.toFixed(1)} dBm (Quality score: ${sub.qualityScore}/100)`
    );
  }
  return lines.join("\n");
}

function buildProposedActionsForSubscriber(
  sub: EnrichedSubscriberRecord,
  currency: string
): CopilotProposedAction[] {
  const actions: CopilotProposedAction[] = [];
  if (!sub.isOnline || sub.status === "SUSPENDED") {
    actions.push({
      actionId: `act-coa-${sub.accountNumber}`,
      label:
        sub.balanceDue > 0
          ? `Send M-Pesa STK Renewal Prompt (${currency} ${sub.balanceDue.toLocaleString()})`
          : `Reset PPPoE Session (${sub.accountNumber})`,
      targetAccount: sub.accountNumber,
      permissionRequired:
        sub.balanceDue > 0 ? "billing.reconcile" : "routers.manage",
      requiresConfirmation: true,
      commandPreview:
        sub.balanceDue > 0
          ? `Send M-Pesa payment prompt for ${currency} ${sub.balanceDue.toLocaleString()} to account ${sub.accountNumber}`
          : `Reset PPPoE session for subscriber ${sub.accountNumber}`,
    });
  }
  if (sub.rxPowerDbm !== null && sub.rxPowerDbm < -25.0) {
    actions.push({
      actionId: `act-dispatch-${sub.accountNumber}`,
      label: `Create Field Repair Work Order (${sub.rxPowerDbm.toFixed(1)} dBm)`,
      targetAccount: sub.accountNumber,
      permissionRequired: "work_orders.update",
      requiresConfirmation: true,
      commandPreview: `Assign fiber repair work order for ${sub.fullName} (${sub.accountNumber})`,
    });
  }
  return actions;
}

/**
 * Primary Operational Intelligence Execution Engine.
 */
export function executeCopilotIntelligence(params: {
  prompt: string;
  ctx: CopilotExecutionContext;
  dataset: CopilotDataset;
  memory?: CopilotConversationMemory;
}): CopilotResponse {
  const { prompt, ctx, dataset } = params;
  const memory: CopilotConversationMemory = { ...(params.memory || {}) };
  const toolkit = new CopilotToolkit(ctx, dataset);
  const q = prompt.trim().toLowerCase();
  const allowTechnical = isTechnicalCodeOrRouteRequest(prompt);

  const finalize = (
    res: Omit<
      CopilotResponse,
      "toolsInvoked" | "sourcesCited" | "environmentMode" | "dataCheckedAt" | "conversationContext"
    >
  ): CopilotResponse => {
    const sources = Array.from(toolkit.sourcesConsulted);
    recordCopilotAudit({
      timestamp: ctx.checkedAtIso,
      userId: ctx.userId || "operator",
      userRole: ctx.userRole,
      organizationId: ctx.organizationId,
      environmentMode: ctx.environmentMode,
      question: prompt,
      toolsInvoked: [...toolkit.toolsInvoked],
      sourcesConsulted: sources,
      permissionDenials: [...toolkit.permissionDenials],
    });

    const isDataQuery =
      res.intent !== "FEATURE_AND_NAVIGATION_GUIDE" &&
      res.intent !== "SECURITY_POLICY_REFUSAL" &&
      res.intent !== "PERMISSION_DENIED";

    let cleanAnswer = sanitizeToPlainText(res.answerMarkdown);
    if (
      ctx.environmentMode === "DEMO_DATA" &&
      isDataQuery &&
      !cleanAnswer.includes("demo workspace")
    ) {
      cleanAnswer = `${cleanAnswer}\n\nThis information is from the demo workspace.`;
    }

    return {
      ...res,
      headline: sanitizeToPlainText(res.headline),
      answerMarkdown: cleanAnswer,
      toolsInvoked: [...toolkit.toolsInvoked],
      sourcesCited: sources,
      environmentMode: ctx.environmentMode,
      dataCheckedAt: ctx.checkedAtIso,
      conversationContext: memory,
    };
  };

  // ==========================================================================
  // 0. SECURITY & SECRET PROTECTION RULE
  // ==========================================================================
  if (
    /\b(password|passwords|service_role|service key|api key|secret key|radius secret|webhook secret|private key|session token)\b/i.test(
      q
    ) &&
    !/\b(how does|reset password|forgot password|where do i)\b/i.test(q)
  ) {
    return finalize({
      intent: "SECURITY_POLICY_REFUSAL",
      headline: "Security Policy",
      answerMarkdown:
        "For security and compliance reasons, QC NetCore never exposes passwords, API keys, service keys, router credentials, FreeRADIUS shared secrets, payment webhook secrets, or private keys.\n\nAuthorized administrators can update credentials in the Settings or Routers sections.",
      metricsCited: [{ label: "Policy", value: "Credentials Protected" }],
      proposedActions: [],
      confidenceLevel: "CONFIRMED",
    });
  }

  // ==========================================================================
  // 0.5 PLATFORM CAPABILITY OVERVIEW ("What can QC NetCore do?")
  // ==========================================================================
  if (
    /\b(what can qc netcore do|what does qc netcore do|what features|all features|capabilities of qc netcore|what can this platform do)\b/i.test(
      q
    )
  ) {
    toolkit.getFeatureCapabilities();
    return finalize({
      intent: "FEATURE_AND_NAVIGATION_GUIDE",
      headline: "QC NetCore Platform Capabilities",
      answerMarkdown: [
        "QC NetCore provides the following operational capabilities for managing an ISP:",
        "Network Operations: Manage MikroTik routers, monitor CPU and memory health, generate WireGuard and RouterOS provisioning scripts, manage FreeRADIUS authentication and accounting, monitor active PPPoE and Hotspot sessions, and track network alerts.",
        "Billing and Payments: Create recurring billing plans, issue customer invoices, collect payments via M-Pesa STK Push and Paybill, reconcile unmatched payments, maintain a balanced financial ledger, and automate account suspension and service restoration.",
        "Subscriber Management: Manage PPPoE and Hotspot customer profiles, account numbers, verified phone numbers, POP site assignments, installation addresses, and Customer 360 history.",
        "Hotspot and Captive Portal: Customize your branded hotspot login portal, display internet packages, accept M-Pesa checkout, and generate prepaid voucher batches.",
        "Customer Self-Care: Provide subscribers with a portal to view their active package, check expiry dates, pay via M-Pesa, review invoices, and request support.",
        "Field Operations: Dispatch technician work orders for installations and repairs, verify optical signal power, track support ticket SLAs, and manage equipment inventory.",
        "SMS Communications: Send individual or targeted bulk SMS notifications, payment reminders, and outage alerts using personalized customer templates.",
        "Business Analytics: Track Monthly Recurring Revenue (MRR), ARPU, daily collections, subscriber growth, churn risk, and package performance.",
      ].join("\n\n"),
      metricsCited: [{ label: "Core Modules", value: "9 Active Modules" }],
      proposedActions: [],
      confidenceLevel: "CONFIRMED",
    });
  }

  // ==========================================================================
  // 0.6 SIMPLE SUBSCRIBER COUNT QUESTIONS (Section 12: Keep Simple Answers Concise)
  // ==========================================================================
  if (
    /^\s*how many\s+(active\s+|suspended\s+|total\s+)?(subscribers|customers)\s+(do we have|are there|are active|are suspended)\??\s*$/i.test(
      q
    )
  ) {
    const growthRes = toolkit.getCustomerGrowth();
    if (!growthRes.ok || !growthRes.data) {
      return finalize({
        intent:
          growthRes.errorCode === "PERMISSION_DENIED"
            ? "PERMISSION_DENIED"
            : "SUBSCRIBER_LIST_FILTER",
        headline:
          growthRes.errorCode === "PERMISSION_DENIED"
            ? "Permission Required"
            : "Information Unavailable",
        answerMarkdown:
          growthRes.errorCode === "PERMISSION_DENIED"
            ? "You don't have permission to view subscriber counts."
            : "I could not retrieve the requested information right now.",
        metricsCited: [],
        proposedActions: [],
      });
    }
    const g = growthRes.data;
    if (/\bactive\b/i.test(q)) {
      return finalize({
        intent: "SUBSCRIBER_LIST_FILTER",
        headline: "Active Subscribers",
        answerMarkdown: `There are ${g.activeCustomers} active subscribers out of ${g.totalCustomers} total subscribers.`,
        metricsCited: [
          { label: "Active Subscribers", value: String(g.activeCustomers) },
          { label: "Total Subscribers", value: String(g.totalCustomers) },
        ],
        proposedActions: [],
        confidenceLevel: "CONFIRMED",
      });
    }
    if (/\bsuspended\b/i.test(q)) {
      return finalize({
        intent: "SUBSCRIBER_LIST_FILTER",
        headline: "Suspended Subscribers",
        answerMarkdown: `There are ${g.suspendedCustomers} suspended subscribers out of ${g.totalCustomers} total subscribers.`,
        metricsCited: [
          { label: "Suspended Subscribers", value: String(g.suspendedCustomers) },
          { label: "Total Subscribers", value: String(g.totalCustomers) },
        ],
        proposedActions: [],
        confidenceLevel: "CONFIRMED",
      });
    }
    return finalize({
      intent: "SUBSCRIBER_LIST_FILTER",
      headline: "Subscriber Count",
      answerMarkdown: `There are ${g.totalCustomers} total subscribers: ${g.activeCustomers} active, ${g.suspendedCustomers} suspended, and ${g.pendingInstallations} pending installation.`,
      metricsCited: [
        { label: "Total Subscribers", value: String(g.totalCustomers) },
        { label: "Active", value: String(g.activeCustomers) },
      ],
      proposedActions: [],
      confidenceLevel: "CONFIRMED",
    });
  }

  // ==========================================================================
  // 1. NEWEST / OLDEST / TOP-N NEWEST SUBSCRIBERS
  // ==========================================================================
  if (
    /\b(newest|most recent|joined most recently|latest subscriber|latest customer|newest customer|newest subscriber|newest subscribers|newest customers|a new subscriber)\b/i.test(
      q
    )
  ) {
    const countMatch =
      q.match(/\b(\d+)\s+(?:newest|most recent|latest)\b/) ||
      q.match(/\b(?:newest|latest)\s+(\d+)\b/);
    const limit = countMatch
      ? Math.min(50, Math.max(1, Number(countMatch[1])))
      : 1;

    const toolRes = toolkit.getNewestSubscriber(limit);
    if (!toolRes.ok) {
      return finalize({
        intent: "PERMISSION_DENIED",
        headline: "Permission Required",
        answerMarkdown:
          toolRes.errorCode === "UNAVAILABLE"
            ? "I could not retrieve the requested information right now."
            : toolRes.message ||
              "You don't have permission to view subscriber records.",
        metricsCited: [],
        proposedActions: [],
      });
    }

    const list = toolRes.data ?? [];
    if (list.length === 0) {
      return finalize({
        intent: "NEWEST_SUBSCRIBER_LOOKUP",
        headline: "No Subscriber Records Found",
        answerMarkdown: "No subscriber records were found in the current workspace.",
        metricsCited: [{ label: "Subscribers Found", value: "0" }],
        proposedActions: [],
      });
    }

    const newest = list[0];
    memory.lastSubscriberId = newest.id;
    memory.lastSubscriberName = newest.fullName;
    memory.lastAccountNumber = newest.accountNumber;
    memory.lastPackageId = newest.packageId;
    memory.lastPackageName = newest.packageName;
    memory.lastRouterId = newest.routerId || undefined;
    memory.lastRouterName = newest.routerName || undefined;

    if (
      limit === 1 &&
      !/\b(subscribers|customers)\b/.test(q.replace(/newest subscriber$/, ""))
    ) {
      return finalize({
        intent: "NEWEST_SUBSCRIBER_LOOKUP",
        headline: `Newest Subscriber: ${newest.fullName} (${newest.accountNumber})`,
        answerMarkdown: formatEnrichedSubscriberPlainText(
          newest,
          ctx,
          `The newest subscriber is ${newest.fullName}.`
        ),
        metricsCited: [
          { label: "Subscriber", value: newest.fullName },
          { label: "Account", value: newest.accountNumber },
          { label: "Package", value: newest.packageName },
          { label: "Status", value: `${newest.status} (${newest.sessionStatus})` },
        ],
        proposedActions: buildProposedActionsForSubscriber(newest, ctx.currency),
        confidenceLevel: "CONFIRMED",
      });
    }

    const rows = list
      .map(
        (s, idx) =>
          `${idx + 1}. Customer: ${s.fullName} (${s.accountNumber})\nPackage: ${
            s.packageName
          } | IP address: ${s.ipAddress || "Offline"} | Status: ${s.status} (${
            s.sessionStatus
          }) | POP: ${s.popSiteName} | Registered: ${formatDateOnly(
            s.registeredAt,
            ctx.timezone
          )}`
      )
      .join("\n\n");

    return finalize({
      intent: "NEWEST_SUBSCRIBER_LOOKUP",
      headline: `${list.length} Newest Subscribers`,
      answerMarkdown: `Newest subscribers ordered by registration date:\n\n${rows}`,
      metricsCited: [
        { label: "Returned", value: String(list.length) },
        { label: "Newest", value: newest.fullName },
        { label: "Latest Account", value: newest.accountNumber },
      ],
      proposedActions: [],
      confidenceLevel: "CONFIRMED",
    });
  }

  if (/\b(oldest subscriber|oldest customer|first subscriber|first customer)\b/i.test(q)) {
    const toolRes = toolkit.getOldestSubscriber(1);
    if (!toolRes.ok) {
      return finalize({
        intent: "PERMISSION_DENIED",
        headline: "Permission Required",
        answerMarkdown:
          toolRes.message || "You don't have permission to view subscriber records.",
        metricsCited: [],
        proposedActions: [],
      });
    }
    const oldest = toolRes.data?.[0];
    if (!oldest) {
      return finalize({
        intent: "NEWEST_SUBSCRIBER_LOOKUP",
        headline: "No Subscriber Records Found",
        answerMarkdown: "No subscriber records were found in the current workspace.",
        metricsCited: [],
        proposedActions: [],
      });
    }
    memory.lastSubscriberId = oldest.id;
    memory.lastSubscriberName = oldest.fullName;
    memory.lastAccountNumber = oldest.accountNumber;

    return finalize({
      intent: "NEWEST_SUBSCRIBER_LOOKUP",
      headline: `Oldest Subscriber: ${oldest.fullName} (${oldest.accountNumber})`,
      answerMarkdown: formatEnrichedSubscriberPlainText(
        oldest,
        ctx,
        `The longest-standing subscriber is ${oldest.fullName}.`
      ),
      metricsCited: [
        { label: "Subscriber", value: oldest.fullName },
        { label: "Account", value: oldest.accountNumber },
        { label: "Registered", value: formatDateOnly(oldest.registeredAt, ctx.timezone) },
      ],
      proposedActions: [],
      confidenceLevel: "CONFIRMED",
    });
  }

  // ==========================================================================
  // 2. AMBIGUOUS "WHICH CUSTOMERS ARE NEW?" CLARIFICATION
  // ==========================================================================
  if (
    /^\s*(which|who are|show)\s+(the\s+)?(customers|subscribers)\s+(are\s+|that are\s+)?new\??\s*$/i.test(
      q
    )
  ) {
    const growth = toolkit.getCustomerGrowth();
    const newest = toolkit.getNewestSubscriber(1).data?.[0];
    return finalize({
      intent: "AMBIGUOUS_QUERY_CLARIFICATION",
      headline: "Clarification Needed: New Subscribers",
      answerMarkdown: `Do you mean newly registered subscribers by registration date, newly activated subscriptions, or subscribers pending field installation?\n\nCurrent subscriber summary:\nMost recently registered subscriber: ${
        newest
          ? `${newest.fullName} (${newest.accountNumber}, registered ${formatDateOnly(
              newest.registeredAt,
              ctx.timezone
            )})`
          : "None"
      }\nPending field installation: ${
        growth.data?.pendingInstallations ?? 0
      }\nTotal active subscribers: ${growth.data?.activeCustomers ?? 0}`,
      metricsCited: [
        {
          label: "Pending Installation",
          value: String(growth.data?.pendingInstallations ?? 0),
        },
        {
          label: "Most Recent",
          value: newest ? newest.fullName : "None",
        },
      ],
      proposedActions: [],
    });
  }

  // ==========================================================================
  // 2.5 SMS COMMUNICATIONS INTELLIGENCE & CONFIRMATION-GATED CAMPAIGNS
  // ==========================================================================
  if (
    /\b(sms|payment reminder|payment reminders|valid phone|phone numbers|can receive sms)\b/i.test(
      q
    ) &&
    !/\b(how does|how do i|where do i|where can i|explain|configure)\b/i.test(q)
  ) {
    if (/\b(send|dispatch|broadcast|notify|trigger)\b/i.test(q)) {
      const recipientMode = /\bsuspended\b/i.test(q)
        ? "SUSPENDED_SUBSCRIBERS"
        : /\bexpiring\b/i.test(q)
        ? "EXPIRING_SUBSCRIBERS"
        : /\bactive\b/i.test(q)
        ? "ACTIVE_SUBSCRIBERS"
        : "OVERDUE_CUSTOMERS";

      const previewRes = toolkit.previewSmsCampaignTool({
        recipientMode,
        category: "TRANSACTIONAL",
      });

      if (!previewRes.ok || !previewRes.data) {
        return finalize({
          intent: "PERMISSION_DENIED",
          headline: "Permission Required for Bulk SMS",
          answerMarkdown:
            previewRes.message ||
            "You do not have permission to prepare or send bulk SMS campaigns.",
          metricsCited: [],
          proposedActions: [],
        });
      }

      const p = previewRes.data;
      const recipientLines = p.samplePreviews
        .map(
          (r) =>
            `Customer: ${r.customerName} (${r.accountNumber}) | Phone: ${r.phone} | Package: ${r.packageName}`
        )
        .join("\n");

      return finalize({
        intent: "SMS_CAMPAIGN_PROPOSAL",
        headline: `Confirmation Required: Payment Reminder SMS Campaign (${p.recipientCount} Eligible Recipients)`,
        answerMarkdown: `I have prepared a Payment Reminder SMS campaign for ${ctx.organizationName}. No SMS messages have been sent yet. Explicit operator confirmation is required before sending.\n\nCampaign summary:\nTarget group: Overdue customers\nEligible recipients: ${p.recipientCount} subscribers with valid phone numbers\nSkipped recipients: ${p.skippedInvalidCount + p.skippedOptOutCount}\nEstimated SMS segments: ${p.estimatedTotalSegments}\nGateway status: ${p.providerStatusMessage}\n\nSample recipients:\n${recipientLines || "No eligible recipients matched."}\n\nSample message preview:\n${p.samplePreviews[0]?.resolvedMessage || "No preview available"}`,
        metricsCited: [
          { label: "Eligible Recipients", value: String(p.recipientCount) },
          {
            label: "Excluded",
            value: String(p.skippedInvalidCount + p.skippedOptOutCount),
          },
          { label: "Total Segments", value: String(p.estimatedTotalSegments) },
          { label: "Encoding", value: p.encoding },
        ],
        proposedActions: [
          {
            actionId: "act-confirm-bulk-sms-overdue",
            label: `Confirm and Send Payment Reminder SMS to ${p.recipientCount} Customers`,
            permissionRequired: "sms.send_bulk",
            requiresConfirmation: true,
            commandPreview: `Send payment reminder SMS campaign to ${p.recipientCount} overdue customers`,
          },
        ],
        confidenceLevel: "CONFIRMED",
      });
    }

    const smsRes = toolkit.getSmsMetrics();
    if (!smsRes.ok || !smsRes.data) {
      return finalize({
        intent: "PERMISSION_DENIED",
        headline: "Permission Required",
        answerMarkdown:
          smsRes.message ||
          "You don't have permission to view SMS communication records.",
        metricsCited: [],
        proposedActions: [],
      });
    }

    const {
      metrics,
      recipients,
      paymentReminderSentCount,
      overdueWithoutReminder,
    } = smsRes.data;

    if (
      /\b(not received|haven't received|without|missing)\b/i.test(q) &&
      /\b(reminder)\b/i.test(q)
    ) {
      const listPlain =
        overdueWithoutReminder.length === 0
          ? "All customers with overdue balances have already received a payment reminder SMS."
          : overdueWithoutReminder
              .map(
                (r) =>
                  `Customer: ${r.customerName} (${r.accountNumber}) | Phone: ${r.phone} | Balance due: ${ctx.currency} ${r.balanceDue.toLocaleString()} | Package: ${r.packageName}`
              )
              .join("\n");

      return finalize({
        intent: "SMS_COMMUNICATIONS_QUERY",
        headline: `Overdue Customers Pending Payment Reminder (${overdueWithoutReminder.length})`,
        answerMarkdown: `Found ${overdueWithoutReminder.length} customers with overdue balances who have not yet received a payment reminder SMS:\n\n${listPlain}`,
        metricsCited: [
          {
            label: "Pending Reminder",
            value: String(overdueWithoutReminder.length),
          },
          {
            label: "Reminders Sent",
            value: String(paymentReminderSentCount),
          },
        ],
        proposedActions:
          overdueWithoutReminder.length > 0
            ? [
                {
                  actionId: "act-send-missing-reminders",
                  label: `Prepare Payment Reminder SMS for ${overdueWithoutReminder.length} Overdue Customers`,
                  permissionRequired: "sms.send_bulk",
                  requiresConfirmation: true,
                  commandPreview: `Prepare payment reminder SMS for ${overdueWithoutReminder.length} overdue customers`,
                },
              ]
            : [],
        confidenceLevel: "CONFIRMED",
      });
    }

    const validCustomersList = recipients
      .filter((r) => r.phoneValid)
      .slice(0, 6)
      .map(
        (r) =>
          `Customer: ${r.customerName} (${r.accountNumber}) | Phone: ${r.formattedPhone} | Status: ${r.status}`
      )
      .join("\n");

    const missingOrInvalidCount =
      metrics.totalCustomers - metrics.customersWithValidPhone;
    const optedOutMarketingCount =
      metrics.customersWithValidPhone - metrics.customersReachableMarketing;

    return finalize({
      intent: "SMS_COMMUNICATIONS_QUERY",
      headline: "SMS Communications and Customer Phone Reachability",
      answerMarkdown: `Customers with Valid Phone Numbers: ${metrics.customersWithValidPhone} of ${metrics.totalCustomers} total subscribers (${missingOrInvalidCount} missing or invalid)\nMarketing Opt-In Subscribers: ${metrics.customersReachableMarketing} (${optedOutMarketingCount} opted out of promotional SMS)\nSMS Sent Today: ${metrics.messagesSentToday}\nSMS Sent This Month: ${metrics.messagesSentThisMonth} (${paymentReminderSentCount} payment and suspension reminders)\nDelivery Summary: ${metrics.deliveredCount} delivered, ${metrics.pendingCount} pending, ${metrics.failedCount} failed (${metrics.deliveryRatePercent}% delivery rate)\nSMS Gateway Status: ${metrics.statusMessage}\n\nVerified subscriber phone directory:\n${validCustomersList}`,
      metricsCited: [
        {
          label: "SMS Reachable",
          value: `${metrics.customersWithValidPhone}/${metrics.totalCustomers}`,
        },
        { label: "Sent Today", value: String(metrics.messagesSentToday) },
        { label: "Sent This Month", value: String(metrics.messagesSentThisMonth) },
        { label: "Payment Reminders", value: String(paymentReminderSentCount) },
      ],
      proposedActions: [],
      confidenceLevel: "CONFIRMED",
    });
  }

  // ==========================================================================
  // 3. EXPLICIT CUSTOMER MATCH OR PRONOUN / FOLLOW-UP RESOLUTION
  // ==========================================================================
  const allTenantCustomers = dataset.customers.filter(
    (c) => c.organizationId === ctx.organizationId
  );

  const matchedCustomers = allTenantCustomers.filter((c) => {
    if (q.includes(c.accountNumber.toLowerCase())) return true;
    const tokens = c.fullName
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 4);
    return tokens.some((t) => q.includes(t));
  });

  const hasPronounReference =
    /\b(that customer|that subscriber|this customer|this subscriber|their|they|he|him|his|she|her)\b/i.test(
      q
    ) && !/\b(customers|subscribers|routers|packages)\b/i.test(q);

  let targetSubscriber: EnrichedSubscriberRecord | null = null;
  let isFollowUp = false;

  if (matchedCustomers.length === 1) {
    const res = toolkit.getSubscriber(matchedCustomers[0].id);
    if (!res.ok) {
      return finalize({
        intent: "PERMISSION_DENIED",
        headline: "Permission Required",
        answerMarkdown:
          res.message || "You don't have permission to view this information.",
        metricsCited: [],
        proposedActions: [],
      });
    }
    targetSubscriber = res.data?.exact || res.data?.matches[0] || null;
  } else if (matchedCustomers.length > 1) {
    const searchRes = toolkit.searchCustomers(
      matchedCustomers[0].fullName.split(" ")[0]
    );
    const matches = searchRes.data ?? [];
    const listPlain = matches
      .map(
        (m) =>
          `Customer: ${m.fullName} | Account: ${m.accountNumber} | Package: ${m.packageName} | POP: ${m.popSiteName}`
      )
      .join("\n");
    return finalize({
      intent: "AMBIGUOUS_QUERY_CLARIFICATION",
      headline: `Multiple Subscribers Found (${matches.length} Matches)`,
      answerMarkdown: `I found ${matches.length} subscribers matching that name. Which one do you mean?\n\n${listPlain}`,
      metricsCited: [{ label: "Matches", value: String(matches.length) }],
      proposedActions: [],
    });
  } else if (
    hasPronounReference &&
    (memory.lastSubscriberId ||
      memory.lastAccountNumber ||
      memory.lastSubscriberName)
  ) {
    const refKey =
      memory.lastSubscriberId ||
      memory.lastAccountNumber ||
      memory.lastSubscriberName ||
      "";
    const res = toolkit.getSubscriber(refKey);
    if (!res.ok) {
      return finalize({
        intent: "PERMISSION_DENIED",
        headline: "Permission Required",
        answerMarkdown:
          res.message || "You don't have permission to view this information.",
        metricsCited: [],
        proposedActions: [],
      });
    }
    targetSubscriber = res.data?.exact || res.data?.matches[0] || null;
    isFollowUp = Boolean(targetSubscriber);
  }

  if (targetSubscriber) {
    memory.lastSubscriberId = targetSubscriber.id;
    memory.lastSubscriberName = targetSubscriber.fullName;
    memory.lastAccountNumber = targetSubscriber.accountNumber;
    memory.lastPackageId = targetSubscriber.packageId;
    memory.lastPackageName = targetSubscriber.packageName;
    memory.lastRouterId = targetSubscriber.routerId || undefined;
    memory.lastRouterName = targetSubscriber.routerName || undefined;

    if (/\b(why|offline|down|problem|issue|not working|disconnected)\b/i.test(q)) {
      const diagRes = toolkit.diagnoseSubscriberOffline(targetSubscriber.id);
      const diag = diagRes.data;
      if (!diag) {
        return finalize({
          intent: "SUBSCRIBER_DIAGNOSTIC",
          headline: `Diagnostic Unavailable: ${targetSubscriber.fullName}`,
          answerMarkdown: "I could not retrieve the requested information right now.",
          metricsCited: [],
          proposedActions: [],
        });
      }

      const actions = buildProposedActionsForSubscriber(
        targetSubscriber,
        ctx.currency
      );
      const evidenceLines = diag.evidence.join("\n");

      return finalize({
        intent: "SUBSCRIBER_DIAGNOSTIC",
        headline: `Subscriber Diagnostic: ${targetSubscriber.fullName} (${targetSubscriber.accountNumber})`,
        answerMarkdown: `Customer: ${targetSubscriber.fullName} (${
          targetSubscriber.accountNumber
        })\nPOP: ${targetSubscriber.popSiteName}\nAccount status: ${
          targetSubscriber.status
        } (${
          targetSubscriber.isOnline ? "PPPoE Online" : "Session Offline"
        })\nPackage: ${targetSubscriber.packageName}\n\n${
          diag.confidence === "CONFIRMED" ? "Confirmed cause" : "Likely cause"
        }: ${diag.primaryCause}\n\nDiagnostic details:\n${evidenceLines}\nBalance due: ${
          ctx.currency
        } ${targetSubscriber.balanceDue.toLocaleString()}\nOptical signal: ${
          targetSubscriber.rxPowerDbm !== null
            ? `${targetSubscriber.rxPowerDbm.toFixed(1)} dBm`
            : "N/A"
        }\nConnection quality score: ${
          targetSubscriber.qualityScore
        }/100\nChurn risk: ${targetSubscriber.churnRiskTier} (${
          targetSubscriber.churnRiskScore
        }/100)`,
        metricsCited: [
          { label: "Status", value: targetSubscriber.status },
          {
            label: "Balance Due",
            value: `${ctx.currency} ${targetSubscriber.balanceDue.toLocaleString()}`,
          },
          {
            label: "Optical RX",
            value:
              targetSubscriber.rxPowerDbm !== null
                ? `${targetSubscriber.rxPowerDbm.toFixed(1)} dBm`
                : "N/A",
          },
          { label: "QoE Score", value: `${targetSubscriber.qualityScore}/100` },
        ],
        proposedActions: actions,
        confidenceLevel: diag.confidence,
      });
    }

    if (
      isFollowUp ||
      /\b(what package|which package|what plan|their ip|his ip|her ip|are they online|is he online|is she online|when did they last pay|how much did he pay|how much did she pay|when does their service expire|when does it expire)\b/i.test(
        q
      )
    ) {
      if (/\b(package|plan|speed)\b/i.test(q)) {
        return finalize({
          intent: "CONTEXTUAL_FOLLOW_UP",
          headline: `Active Package: ${targetSubscriber.fullName} (${targetSubscriber.accountNumber})`,
          answerMarkdown: `${targetSubscriber.fullName} (${targetSubscriber.accountNumber}) is subscribed to ${targetSubscriber.packageName}.\nService type: ${targetSubscriber.serviceType}\nSpeed: ${targetSubscriber.speedMbpsLabel}\nMonthly rate: ${ctx.currency} ${targetSubscriber.packagePrice.toLocaleString()}\nStatus: ${targetSubscriber.status}\nExpiry date: ${formatDateOnly(
            targetSubscriber.expiresAt,
            ctx.timezone
          )}`,
          metricsCited: [
            { label: "Subscriber", value: targetSubscriber.fullName },
            { label: "Package", value: targetSubscriber.packageName },
            {
              label: "Rate",
              value: `${ctx.currency} ${targetSubscriber.packagePrice.toLocaleString()}`,
            },
          ],
          proposedActions: [],
          confidenceLevel: "CONFIRMED",
        });
      }

      if (/\b(ip|ip address|mac)\b/i.test(q)) {
        toolkit.getCustomerSessions(targetSubscriber.id);
        return finalize({
          intent: "CONTEXTUAL_FOLLOW_UP",
          headline: `Network Addressing: ${targetSubscriber.fullName} (${targetSubscriber.accountNumber})`,
          answerMarkdown: `Customer: ${targetSubscriber.fullName} (${
            targetSubscriber.accountNumber
          })\nIP address: ${
            targetSubscriber.ipAddress || "No active IP (session offline)"
          }\nMAC or CPE serial: ${
            targetSubscriber.macAddress || "Not recorded"
          }\nPPPoE username: ${targetSubscriber.pppoeUsername || "None"}\nRouter: ${
            targetSubscriber.routerName || "Not assigned"
          } (${targetSubscriber.popSiteName})\nSession state: ${
            targetSubscriber.sessionStatus
          }`,
          metricsCited: [
            { label: "IP Address", value: targetSubscriber.ipAddress || "Offline" },
            { label: "Session", value: targetSubscriber.sessionStatus },
            { label: "Router", value: targetSubscriber.routerName || "—" },
          ],
          proposedActions: [],
          confidenceLevel: "CONFIRMED",
        });
      }

      if (/\b(online|connected|session|active right now)\b/i.test(q)) {
        toolkit.getCustomerSessions(targetSubscriber.id);
        return finalize({
          intent: "CONTEXTUAL_FOLLOW_UP",
          headline: `Session Status: ${targetSubscriber.fullName} (${targetSubscriber.accountNumber})`,
          answerMarkdown: `${targetSubscriber.fullName} (${
            targetSubscriber.accountNumber
          }) is currently ${targetSubscriber.sessionStatus.toUpperCase()}.\nAccount status: ${
            targetSubscriber.status
          }\nIP address: ${
            targetSubscriber.ipAddress || "None (Offline)"
          }\nUptime: ${targetSubscriber.uptime || "0s"}\nRouter: ${
            targetSubscriber.routerName || "Not assigned"
          } (${targetSubscriber.popSiteName})`,
          metricsCited: [
            { label: "Session", value: targetSubscriber.sessionStatus },
            { label: "IP", value: targetSubscriber.ipAddress || "—" },
            { label: "Uptime", value: targetSubscriber.uptime || "0s" },
          ],
          proposedActions: buildProposedActionsForSubscriber(
            targetSubscriber,
            ctx.currency
          ),
          confidenceLevel: "CONFIRMED",
        });
      }

      if (/\b(pay|paid|payment|balance)\b/i.test(q)) {
        const payRes = toolkit.getCustomerPayments(targetSubscriber.id);
        if (!payRes.ok) {
          return finalize({
            intent: "PERMISSION_DENIED",
            headline: "Permission Required",
            answerMarkdown:
              payRes.message ||
              "You don't have permission to view payment records.",
            metricsCited: [],
            proposedActions: [],
          });
        }
        const payments = payRes.data ?? [];
        const latest = payments[0];
        return finalize({
          intent: "CONTEXTUAL_FOLLOW_UP",
          headline: `Payment History: ${targetSubscriber.fullName} (${targetSubscriber.accountNumber})`,
          answerMarkdown: latest
            ? `${targetSubscriber.fullName} (${
                targetSubscriber.accountNumber
              }) last paid ${ctx.currency} ${latest.amount.toLocaleString()} on ${formatDateTimeEAT(
                latest.processedAt || latest.createdAt,
                ctx.timezone
              )}.\nTransaction reference: ${
                latest.transactionReference
              }\nPayment method: ${latest.paymentMethod}\nPayment status: ${
                targetSubscriber.paymentStatus
              }\nBalance due: ${
                ctx.currency
              } ${targetSubscriber.balanceDue.toLocaleString()}`
            : `No completed payment records were found for ${
                targetSubscriber.fullName
              } (${targetSubscriber.accountNumber}).\nBalance due: ${
                ctx.currency
              } ${targetSubscriber.balanceDue.toLocaleString()} (${
                targetSubscriber.paymentStatus
              })`,
          metricsCited: [
            {
              label: "Last Payment",
              value: latest
                ? `${ctx.currency} ${latest.amount.toLocaleString()}`
                : "None",
            },
            {
              label: "Reference",
              value: latest ? latest.transactionReference : "—",
            },
            {
              label: "Balance Due",
              value: `${ctx.currency} ${targetSubscriber.balanceDue.toLocaleString()}`,
            },
          ],
          proposedActions: [],
          confidenceLevel: "CONFIRMED",
        });
      }

      if (/\b(expire|expiry|expiration|renew)\b/i.test(q)) {
        return finalize({
          intent: "CONTEXTUAL_FOLLOW_UP",
          headline: `Subscription Expiry: ${targetSubscriber.fullName} (${targetSubscriber.accountNumber})`,
          answerMarkdown: `Customer: ${targetSubscriber.fullName} (${
            targetSubscriber.accountNumber
          })\nNext Expiry Date: ${formatDateTimeEAT(
            targetSubscriber.expiresAt,
            ctx.timezone
          )}\nPackage: ${targetSubscriber.packageName}\nStatus: ${
            targetSubscriber.status
          }\nBalance due: ${ctx.currency} ${targetSubscriber.balanceDue.toLocaleString()}`,
          metricsCited: [
            {
              label: "Expiry Date",
              value: formatDateOnly(targetSubscriber.expiresAt, ctx.timezone),
            },
            { label: "Status", value: targetSubscriber.status },
          ],
          proposedActions: [],
          confidenceLevel: "CONFIRMED",
        });
      }
    }

    const c360Res = toolkit.getCustomer360(targetSubscriber.id);
    const c360 = c360Res.data;
    const actions = buildProposedActionsForSubscriber(
      targetSubscriber,
      ctx.currency
    );

    return finalize({
      intent: /\b(everything|360|tell me about|profile|details)\b/i.test(q)
        ? "CUSTOMER_360_DOSSIER"
        : "SUBSCRIBER_DIAGNOSTIC",
      headline: `Customer 360 Summary: ${targetSubscriber.fullName} (${targetSubscriber.accountNumber})`,
      answerMarkdown: `${formatEnrichedSubscriberPlainText(
        targetSubscriber,
        ctx
      )}\nOpen support tickets: ${
        c360
          ? c360.tickets.filter((t) => t.status !== "RESOLVED").length
          : targetSubscriber.openTicketsCount
      }\nConnection quality score: ${targetSubscriber.qualityScore}/100\nChurn risk: ${
        targetSubscriber.churnRiskTier
      } (${targetSubscriber.churnRiskScore}/100)`,
      metricsCited: [
        { label: "Status", value: targetSubscriber.status },
        {
          label: "Balance Due",
          value: `${ctx.currency} ${targetSubscriber.balanceDue.toLocaleString()}`,
        },
        {
          label: "Optical RX",
          value:
            targetSubscriber.rxPowerDbm !== null
              ? `${targetSubscriber.rxPowerDbm.toFixed(1)} dBm`
              : "N/A",
        },
        { label: "QoE Score", value: `${targetSubscriber.qualityScore}/100` },
      ],
      proposedActions: actions,
      confidenceLevel: "CONFIRMED",
    });
  }

  // ==========================================================================
  // 4. CHURN RISK & OPTICAL ATTENUATION AUDIT
  // ==========================================================================
  if (
    q.includes("churn") ||
    q.includes("attenuation") ||
    q.includes("optical") ||
    q.includes("degraded")
  ) {
    const churnRes = toolkit.getChurnMetrics();
    if (!churnRes.ok) {
      return finalize({
        intent: "PERMISSION_DENIED",
        headline: "Permission Required",
        answerMarkdown:
          churnRes.message ||
          "You don't have permission to view subscriber metrics.",
        metricsCited: [],
        proposedActions: [],
      });
    }
    const atRisk = churnRes.data?.atRiskSubscribers ?? [];
    const listText =
      atRisk.length === 0
        ? "All active subscribers currently have normal optical power (-15 to -24.5 dBm) and low churn risk."
        : atRisk
            .map(
              (s) =>
                `Customer: ${s.fullName} (${s.accountNumber}) | Churn risk: ${
                  s.churnRiskTier
                } (${s.churnRiskScore}/100) | Quality score: ${
                  s.qualityScore
                }/100 | Optical signal: ${
                  s.rxPowerDbm !== null ? `${s.rxPowerDbm.toFixed(1)} dBm` : "N/A"
                } | Balance due: ${ctx.currency} ${s.balanceDue.toLocaleString()}`
            )
            .join("\n");

    return finalize({
      intent: "CHURN_AND_OPTICAL_AUDIT",
      headline: `Retention and Optical Health Audit (${atRisk.length} Flagged)`,
      answerMarkdown: `Identified ${atRisk.length} subscribers requiring retention or fiber link attention:\n\n${listText}`,
      metricsCited: [
        { label: "At-Risk Subscribers", value: String(atRisk.length) },
        {
          label: "Total Subscribers",
          value: String(churnRes.data?.totalSubscribers ?? 0),
        },
      ],
      proposedActions:
        atRisk.length > 0
          ? [
              {
                actionId: "act-retention-campaign",
                label: `Send SMS Renewal and Link Check Notice to ${atRisk.length} Subscribers`,
                permissionRequired: "sms.send_bulk",
                requiresConfirmation: true,
                commandPreview: `Send renewal and link check SMS notice to ${atRisk.length} flagged subscribers`,
              },
            ]
          : [],
      confidenceLevel: "CONFIRMED",
    });
  }

  // ==========================================================================
  // 5. OVERDUE ACCOUNTS & "WHO OWES THE MOST?"
  // ==========================================================================
  if (
    /\b(overdue|owe|owes|arrears|unpaid|not paid|largest overdue|delinquent)\b/i.test(
      q
    ) &&
    !/\b(online)\b/i.test(q)
  ) {
    const overdueRes = toolkit.getOverdueAccounts(10);
    if (!overdueRes.ok) {
      return finalize({
        intent: "PERMISSION_DENIED",
        headline: "Permission Required",
        answerMarkdown:
          overdueRes.message ||
          "You don't have permission to view billing records.",
        metricsCited: [],
        proposedActions: [],
      });
    }
    const list = overdueRes.data ?? [];
    if (list.length === 0) {
      return finalize({
        intent: "OVERDUE_ACCOUNTS_RANKING",
        headline: "Zero Overdue Subscriber Accounts",
        answerMarkdown:
          "All subscriber accounts currently have a zero overdue balance (KES 0).",
        metricsCited: [{ label: "Overdue Accounts", value: "0" }],
        proposedActions: [],
        confidenceLevel: "CONFIRMED",
      });
    }

    const topDebtor = list[0];
    memory.lastSubscriberId = topDebtor.id;
    memory.lastSubscriberName = topDebtor.fullName;
    memory.lastAccountNumber = topDebtor.accountNumber;

    const totalOverdue = list.reduce((sum, s) => sum + s.balanceDue, 0);
    const plainRows = list
      .map(
        (s, idx) =>
          `${idx + 1}. Customer: ${s.fullName} (${s.accountNumber}) | Balance due: ${
            ctx.currency
          } ${s.balanceDue.toLocaleString()} | Package: ${
            s.packageName
          } | Days overdue: ${s.daysOverdue} days | Status: ${s.status}`
      )
      .join("\n");

    return finalize({
      intent: "OVERDUE_ACCOUNTS_RANKING",
      headline: `Overdue Accounts (${list.length})`,
      answerMarkdown: `Highest outstanding balance: ${topDebtor.fullName} (${
        topDebtor.accountNumber
      }) owing ${ctx.currency} ${topDebtor.balanceDue.toLocaleString()}.\nTotal overdue receivables: ${
        ctx.currency
      } ${totalOverdue.toLocaleString()}\n\nOverdue accounts:\n${plainRows}`,
      metricsCited: [
        { label: "Highest Arrears", value: `${topDebtor.fullName}` },
        {
          label: "Top Balance",
          value: `${ctx.currency} ${topDebtor.balanceDue.toLocaleString()}`,
        },
        {
          label: "Total Overdue",
          value: `${ctx.currency} ${totalOverdue.toLocaleString()}`,
        },
        { label: "Overdue Count", value: String(list.length) },
      ],
      proposedActions: buildProposedActionsForSubscriber(topDebtor, ctx.currency),
      confidenceLevel: "CONFIRMED",
    });
  }

  // ==========================================================================
  // 6. ONLINE / OFFLINE / ACTIVE / SUSPENDED / EXPIRED SUBSCRIBERS
  // ==========================================================================
  if (
    /\b(online|connected right now|active sessions|currently offline|customers offline|who is offline|active subscribers|active customers|suspended subscribers|suspended customers|expired subscribers)\b/i.test(
      q
    ) &&
    !/\b(where can i|how do i|router)\b/i.test(q)
  ) {
    if (/\b(overdue|balance|unpaid)\b/i.test(q)) {
      const res = toolkit.searchSubscribers({ isOnline: true, overdueOnly: true });
      if (!res.ok) {
        return finalize({
          intent: "PERMISSION_DENIED",
          headline: "Permission Required",
          answerMarkdown:
            res.message || "You don't have permission to view this information.",
          metricsCited: [],
          proposedActions: [],
        });
      }
      const matches = res.data ?? [];
      return finalize({
        intent: "SUBSCRIBER_LIST_FILTER",
        headline: `Online Subscribers with Overdue Balances (${matches.length})`,
        answerMarkdown:
          matches.length === 0
            ? "There are currently 0 online subscribers with overdue balances. Automated billing enforcement has suspended overdue accounts."
            : matches
                .map(
                  (s) =>
                    `Customer: ${s.fullName} (${s.accountNumber}) | IP address: ${s.ipAddress} | Balance due: ${ctx.currency} ${s.balanceDue.toLocaleString()}`
                )
                .join("\n"),
        metricsCited: [{ label: "Online + Overdue", value: String(matches.length) }],
        proposedActions: [],
        confidenceLevel: "CONFIRMED",
      });
    }

    if (/\b(active subscribers|active customers)\b/i.test(q)) {
      const res = toolkit.getActiveSubscribers();
      if (!res.ok) {
        return finalize({
          intent: "PERMISSION_DENIED",
          headline: "Permission Required",
          answerMarkdown:
            res.message || "You don't have permission to view subscriber records.",
          metricsCited: [],
          proposedActions: [],
        });
      }
      const activeList = res.data ?? [];
      return finalize({
        intent: "SUBSCRIBER_LIST_FILTER",
        headline: `Active Subscribers (${activeList.length})`,
        answerMarkdown:
          activeList.length === 0
            ? "There are currently no active subscribers."
            : activeList
                .map(
                  (s) =>
                    `Customer: ${s.fullName} (${s.accountNumber}) | Package: ${
                      s.packageName
                    } | IP address: ${s.ipAddress || "Offline"} | POP: ${
                      s.popSiteName
                    }`
                )
                .join("\n"),
        metricsCited: [
          { label: "Active Subscribers", value: String(activeList.length) },
        ],
        proposedActions: [],
        confidenceLevel: "CONFIRMED",
      });
    }

    if (/\b(offline|disconnected)\b/i.test(q)) {
      const res = toolkit.searchSubscribers({ isOnline: false });
      if (!res.ok) {
        return finalize({
          intent: "PERMISSION_DENIED",
          headline: "Permission Required",
          answerMarkdown:
            res.message ||
            "You don't have permission to view subscriber sessions.",
          metricsCited: [],
          proposedActions: [],
        });
      }
      const offlineList = res.data ?? [];
      const rows = offlineList
        .map((s) => {
          const diag = toolkit.diagnoseSubscriberOffline(s.id).data;
          return `Customer: ${s.fullName} (${s.accountNumber}) | Package: ${
            s.packageName
          } | Status: ${s.status} | Reason: ${
            diag?.primaryCause || "No active session"
          }`;
        })
        .join("\n");

      return finalize({
        intent: "SUBSCRIBER_LIST_FILTER",
        headline: `Offline Subscribers (${offlineList.length})`,
        answerMarkdown:
          offlineList.length === 0
            ? "All registered subscribers currently have active online sessions."
            : rows,
        metricsCited: [
          { label: "Offline Subscribers", value: String(offlineList.length) },
        ],
        proposedActions: [],
        confidenceLevel: "CONFIRMED",
      });
    }

    if (/\b(suspended)\b/i.test(q)) {
      const res = toolkit.getSuspendedSubscribers();
      if (!res.ok) {
        return finalize({
          intent: "PERMISSION_DENIED",
          headline: "Permission Required",
          answerMarkdown:
            res.message || "You don't have permission to view this information.",
          metricsCited: [],
          proposedActions: [],
        });
      }
      const list = res.data ?? [];
      return finalize({
        intent: "SUBSCRIBER_LIST_FILTER",
        headline: `Suspended Subscribers (${list.length})`,
        answerMarkdown:
          list.length === 0
            ? "There are currently no suspended subscribers."
            : list
                .map(
                  (s) =>
                    `Customer: ${s.fullName} (${s.accountNumber}) | Package: ${s.packageName} | Balance due: ${ctx.currency} ${s.balanceDue.toLocaleString()} | POP: ${s.popSiteName}`
                )
                .join("\n"),
        metricsCited: [{ label: "Suspended Count", value: String(list.length) }],
        proposedActions: [],
        confidenceLevel: "CONFIRMED",
      });
    }

    const pppoeRes = toolkit.getActivePPPoESessions();
    const hsRes = toolkit.getActiveHotspotSessions();
    if (!pppoeRes.ok) {
      return finalize({
        intent: "PERMISSION_DENIED",
        headline: "Permission Required",
        answerMarkdown:
          pppoeRes.message || "You don't have permission to view active sessions.",
        metricsCited: [],
        proposedActions: [],
      });
    }
    const onlinePppoe = pppoeRes.data ?? [];
    const onlineHotspot = hsRes.data ?? [];
    const totalOnline = onlinePppoe.length + onlineHotspot.length;

    const rows = onlinePppoe
      .map(
        (s) =>
          `Customer: ${s.fullName} (${s.accountNumber}) | Package: ${
            s.packageName
          } | IP address: ${s.ipAddress || "Assigned"} | Router: ${
            s.routerName || "—"
          } | POP: ${s.popSiteName} | Uptime: ${s.uptime || "Active"}`
      )
      .join("\n");

    return finalize({
      intent: "SUBSCRIBER_LIST_FILTER",
      headline: `${totalOnline} Active Online Sessions`,
      answerMarkdown: `Active sessions online: ${totalOnline}\nPPPoE subscribers online: ${onlinePppoe.length}\nHotspot voucher sessions online: ${onlineHotspot.length}\n\nConnected PPPoE subscribers:\n${rows}`,
      metricsCited: [
        { label: "Total Online", value: String(totalOnline) },
        { label: "PPPoE Online", value: String(onlinePppoe.length) },
        { label: "Hotspot Online", value: String(onlineHotspot.length) },
      ],
      proposedActions: [],
      confidenceLevel: "CONFIRMED",
    });
  }

  // ==========================================================================
  // 7. PACKAGE POPULARITY & PACKAGE REVENUE
  // ==========================================================================
  if (
    /\b(package|packages|plan|plans)\b/i.test(q) &&
    !/\b(how do i|where do i|create|can i)\b/i.test(q)
  ) {
    if (
      /\b(revenue|money|earning|highest revenue|most money|generate|generated)\b/i.test(
        q
      )
    ) {
      const revRes = toolkit.getPackageRevenue();
      if (!revRes.ok) {
        return finalize({
          intent: "PERMISSION_DENIED",
          headline: "Permission Required",
          answerMarkdown:
            revRes.message || "You don't have permission to view package revenue.",
          metricsCited: [],
          proposedActions: [],
        });
      }
      const list = revRes.data ?? [];
      const top = list[0];
      const rows = list
        .map(
          (p, idx) =>
            `${idx + 1}. Package: ${p.planName} (${p.serviceType}) | Price: ${
              p.currency
            } ${p.price.toLocaleString()} | Subscribers: ${
              p.subscriberCount
            } | Confirmed collections: ${
              p.currency
            } ${p.confirmedPaymentsCollected.toLocaleString()} | Monthly recurring revenue: ${
              p.currency
            } ${p.contractedMrr.toLocaleString()}`
        )
        .join("\n");

      return finalize({
        intent: "PACKAGE_ANALYTICS",
        headline: `Package Revenue Summary (Top Package: ${top?.planName || "N/A"})`,
        answerMarkdown: `Highest revenue package: ${top?.planName || "N/A"} with ${
          top?.currency || ctx.currency
        } ${(top?.confirmedPaymentsCollected ?? 0).toLocaleString()} in confirmed collections.\n\nPackage revenue breakdown:\n${rows}`,
        metricsCited: top
          ? [
              { label: "Top Package", value: top.planName },
              {
                label: "Confirmed Collected",
                value: `${top.currency} ${top.confirmedPaymentsCollected.toLocaleString()}`,
              },
              {
                label: "Contracted MRR",
                value: `${top.currency} ${top.contractedMrr.toLocaleString()}`,
              },
            ]
          : [],
        proposedActions: [],
        confidenceLevel: "CONFIRMED",
      });
    }

    const pkgRes = toolkit.searchPackages();
    if (!pkgRes.ok) {
      return finalize({
        intent: "PERMISSION_DENIED",
        headline: "Permission Required",
        answerMarkdown:
          pkgRes.message || "You don't have permission to view packages.",
        metricsCited: [],
        proposedActions: [],
      });
    }
    const list = pkgRes.data ?? [];
    const top = list[0];
    const rankedPlain = list
      .map(
        (p, idx) =>
          `${idx + 1}. ${p.name} (${p.serviceType}): ${
            p.totalSubscribers
          } subscribers, ${p.currency} ${p.price.toLocaleString()}`
      )
      .join("\n");

    return finalize({
      intent: "PACKAGE_ANALYTICS",
      headline: "Service Packages Ranked by Subscribers",
      answerMarkdown: `Most popular package: ${top?.name || "N/A"} with ${
        top?.totalSubscribers ?? 0
      } subscribers.\n\n${rankedPlain}`,
      metricsCited: top
        ? [
            { label: "Most Popular", value: top.name },
            { label: "Subscribers", value: String(top.totalSubscribers) },
            { label: "Total Plans", value: String(list.length) },
          ]
        : [],
      proposedActions: [],
      confidenceLevel: "CONFIRMED",
    });
  }

  // ==========================================================================
  // 8. TODAY'S COLLECTIONS, REVENUE, MRR, ARPU & LEDGER
  // ==========================================================================
  if (
    /\b(collect|collected|today's revenue|revenue today|payments came in|who paid|revenue|ledger|mrr|arpu|balance|payment|reconcil)\b/i.test(
      q
    ) &&
    !/\b(how does|where can i|where do i|can i)\b/i.test(q)
  ) {
    const revRes = toolkit.getRevenueMetrics();
    if (!revRes.ok || !revRes.data) {
      return finalize({
        intent: "PERMISSION_DENIED",
        headline: "Permission Required",
        answerMarkdown:
          revRes.message ||
          "You don't have permission to view financial and billing records.",
        metricsCited: [],
        proposedActions: [],
      });
    }
    const f = revRes.data;

    if (
      /\b(today|collected today|collect today|came in today|paid recently)\b/i.test(
        q
      ) &&
      !/\b(mrr|arpu|trial balance|ledger)\b/i.test(q)
    ) {
      const latestPays = toolkit.getLatestPayments(5).data ?? [];
      const methodLines = Object.entries(f.todayByMethod)
        .map(([m, amt]) => `${m}: ${f.currency} ${amt.toLocaleString()}`)
        .join("\n");
      const recentTxLines = latestPays
        .map(
          (p) =>
            `Reference: ${p.transactionReference} | Customer: ${
              p.customerName || p.senderName || "Hotspot"
            } | Amount: ${p.currency} ${p.amount.toLocaleString()} (${
              p.paymentMethod
            }, ${p.status})`
        )
        .join("\n");

      return finalize({
        intent: "TODAYS_COLLECTIONS_SUMMARY",
        headline: `Today's Confirmed Collections: ${f.currency} ${f.collectedToday.toLocaleString()}`,
        answerMarkdown: `Today's collections (last 24 hours): ${f.currency} ${f.collectedToday.toLocaleString()}\n${
          methodLines || `M-Pesa: ${f.currency} ${f.collectedToday.toLocaleString()}`
        }\nConfirmed transactions today: ${f.todayTransactionsCount}\nFailed payments: ${
          f.failedPaymentsCount
        }\n\nRecent confirmed transactions:\n${
          recentTxLines || "No transactions recorded."
        }`,
        metricsCited: [
          {
            label: "Collected (24h)",
            value: `${f.currency} ${f.collectedToday.toLocaleString()}`,
          },
          { label: "Transactions", value: String(f.todayTransactionsCount) },
          {
            label: "Period Collections",
            value: `${f.currency} ${f.collectedThisPeriod.toLocaleString()}`,
          },
          { label: "Failed Payments", value: String(f.failedPaymentsCount) },
        ],
        proposedActions: [],
        confidenceLevel: "CONFIRMED",
      });
    }

    return finalize({
      intent: "REVENUE_AND_LEDGER_SUMMARY",
      headline: "Financial Ledger and Revenue Summary",
      answerMarkdown: `Monthly Recurring Revenue (MRR): ${f.currency} ${f.mrr.toLocaleString()}\nAnnualized Run Rate (ARR): ${f.currency} ${f.arr.toLocaleString()}\nARPU: ${f.currency} ${f.arpu.toLocaleString()}\nCollected this period: ${f.currency} ${f.collectedThisPeriod.toLocaleString()} (${f.collectionRatePercent}% collection rate)\nOutstanding receivables: ${f.currency} ${f.totalArOutstanding.toLocaleString()}\nTrial balance status: ${
        f.trialBalanceBalanced ? "BALANCED (0.00 discrepancy)" : "Discrepancy detected"
      }\nUnmatched payments: ${f.unmatchedPaymentsCount}\nPending approvals: ${
        f.pendingApprovalsCount
      }`,
      metricsCited: [
        { label: "MRR", value: `${f.currency} ${f.mrr.toLocaleString()}` },
        { label: "ARPU", value: `${f.currency} ${f.arpu.toLocaleString()}` },
        { label: "Collection Rate", value: `${f.collectionRatePercent}%` },
        {
          label: "AR Outstanding",
          value: `${f.currency} ${f.totalArOutstanding.toLocaleString()}`,
        },
      ],
      proposedActions:
        f.unmatchedPaymentsCount > 0
          ? [
              {
                actionId: "act-open-recon",
                label: `Review ${f.unmatchedPaymentsCount} Unmatched Payments in Reconciliation Queue`,
                permissionRequired: "billing.reconcile",
                requiresConfirmation: true,
                commandPreview: `Open reconciliation queue in Billing (${f.unmatchedPaymentsCount} unmatched payments)`,
              },
            ]
          : [],
      confidenceLevel: "CONFIRMED",
    });
  }

  // ==========================================================================
  // 9. ROUTER SESSIONS, OFFLINE/UNHEALTHY ROUTERS, OUTAGES & NETWORK HEALTH
  // ==========================================================================
  if (
    /\b(router|routers|olt|outage|outages|network|blast|noc|unhealthy|active sessions|affected)\b/i.test(
      q
    ) &&
    !/\b(how do i|where can i|where do i|can i)\b/i.test(q)
  ) {
    const rtrHealthRes = toolkit.getRouterHealth();
    const rtrSessionsRes = toolkit.getRouterSessions();
    const incidentsRes = toolkit.getNetworkIncidents();

    if (!rtrHealthRes.ok) {
      return finalize({
        intent: "PERMISSION_DENIED",
        headline: "Permission Required",
        answerMarkdown:
          rtrHealthRes.message ||
          "You don't have permission to view router and network monitoring data.",
        metricsCited: [],
        proposedActions: [],
      });
    }

    const routers = rtrHealthRes.data ?? [];
    const routerSessions = rtrSessionsRes.data ?? [];
    const incidents = incidentsRes.data;

    // Simple question: "Which routers are offline?"
    if (/\b(which routers are offline|routers offline|offline routers)\b/i.test(q)) {
      const offlineRouters = routers.filter((r) => r.status !== "ONLINE");
      if (offlineRouters.length === 0) {
        return finalize({
          intent: "ROUTER_SESSIONS_AND_HEALTH",
          headline: "All Routers Online",
          answerMarkdown: `No routers are currently offline. All ${routers.length} MikroTik routers are online.`,
          metricsCited: [
            {
              label: "Routers Online",
              value: `${routers.length}/${routers.length}`,
            },
          ],
          proposedActions: [],
          confidenceLevel: "CONFIRMED",
        });
      }
      const offlineText = offlineRouters
        .map(
          (r) =>
            `Router: ${r.name} | POP: ${r.siteName || "—"} | Status: ${r.status}`
        )
        .join("\n");
      return finalize({
        intent: "ROUTER_SESSIONS_AND_HEALTH",
        headline: `Offline Routers (${offlineRouters.length})`,
        answerMarkdown: `${offlineRouters.length} router(s) currently offline:\n${offlineText}`,
        metricsCited: [
          { label: "Offline Routers", value: String(offlineRouters.length) },
        ],
        proposedActions: [],
        confidenceLevel: "CONFIRMED",
      });
    }

    // "Which router has the most active sessions?"
    if (/\b(most active sessions|most sessions|highest sessions)\b/i.test(q)) {
      const topRtr = routerSessions[0];
      const rows = routerSessions
        .map(
          (r, i) =>
            `${i + 1}. Router: ${r.routerName} | POP: ${
              r.siteName || "—"
            } | Active sessions: ${r.totalActiveSessions} | CPU load: ${
              r.cpuLoad
            }% | Status: ${r.status}`
        )
        .join("\n");

      return finalize({
        intent: "ROUTER_SESSIONS_AND_HEALTH",
        headline: `Router Session Ranking: ${topRtr?.routerName || "N/A"} (${
          topRtr?.totalActiveSessions ?? 0
        } Active Sessions)`,
        answerMarkdown: `${topRtr?.routerName || "N/A"} at ${
          topRtr?.siteName || "—"
        } has the highest load with ${
          topRtr?.totalActiveSessions ?? 0
        } active sessions.\n\nRouter session breakdown:\n${rows}`,
        metricsCited: topRtr
          ? [
              { label: "Top Router", value: topRtr.routerName },
              {
                label: "Active Sessions",
                value: String(topRtr.totalActiveSessions),
              },
              { label: "CPU Load", value: `${topRtr.cpuLoad}%` },
            ]
          : [],
        proposedActions: [],
        confidenceLevel: "CONFIRMED",
      });
    }

    if (
      /\b(unhealthy|causing the most problems|outage|outages|affected|having problems)\b/i.test(
        q
      )
    ) {
      const flaggedRouters = routers.filter(
        (r) => !r.isHealthy || r.cpuLoad >= 40
      );
      const losOnts = incidents?.losOnts ?? [];
      const degradedNodes = incidents?.degradedNodes ?? [];
      const openAlerts = incidents?.openAlerts ?? [];

      const rtrLines =
        flaggedRouters.length === 0
          ? "All MikroTik routers are online with normal CPU and memory utilization."
          : flaggedRouters
              .map(
                (r) =>
                  `Router: ${r.name} (${r.siteName}) | Status: ${
                    r.status
                  } | CPU: ${r.cpuLoad}% | Active sessions: ${
                    r.activeSessions
                  } | Alerts: ${r.unhealthyReasons.join(", ") || "None"}`
              )
              .join("\n");

      const ontLines =
        losOnts.length === 0
          ? "Zero optical loss of signal alarms."
          : losOnts
              .map(
                (o) =>
                  `Customer: ${o.customerName} (${o.accountNumber}) | ONT: ${
                    o.serialNumber
                  } on ${o.ponPortLabel} (${o.oltName}) | Status: ${
                    o.status
                  } (${o.rxPowerDbm.toFixed(1)} dBm)`
              )
              .join("\n");

      const nodeLines =
        degradedNodes.length === 0
          ? "All fiber distribution splitters are operating normally."
          : degradedNodes
              .map(
                (n) =>
                  `Node: ${n.name} (${n.nodeCode}) | Status: ${n.status} | Latency: ${n.latencyMs} ms | Utilization: ${n.utilizationPercent}% | Subscribers on node: ${n.subscriberCount}`
              )
              .join("\n");

      return finalize({
        intent: "NETWORK_AND_OUTAGE_STATUS",
        headline: "Active Network Incidents, Router Health, and Affected Subscribers",
        answerMarkdown: `Router fleet warnings:\n${rtrLines}\n\nDistribution node alerts:\n${nodeLines}\n\nAffected subscribers:\n${ontLines}`,
        metricsCited: [
          {
            label: "Routers Online",
            value: `${routers.filter((r) => r.status === "ONLINE").length}/${routers.length}`,
          },
          { label: "ONT LOS Alarms", value: String(losOnts.length) },
          { label: "Degraded Nodes", value: String(degradedNodes.length) },
          { label: "Open NOC Alerts", value: String(openAlerts.length) },
        ],
        proposedActions: [],
        confidenceLevel: "CONFIRMED",
      });
    }

    const onlineRoutersCount = routers.filter(
      (r) => r.status === "ONLINE"
    ).length;
    const oltsCount = dataset.olts.filter(
      (o) => o.organizationId === ctx.organizationId
    ).length;
    const losOntCount = (incidents?.losOnts ?? []).length;
    const openAlertsCount = (incidents?.openAlerts ?? []).length;

    const overallHealth =
      onlineRoutersCount < routers.length
        ? "Critical"
        : losOntCount > 0 || openAlertsCount > 0
        ? "Warning"
        : "Healthy";

    return finalize({
      intent: "NETWORK_AND_OUTAGE_STATUS",
      headline: "Network Operations and Router Health Summary",
      answerMarkdown: `Overall network status: ${overallHealth}\nMikroTik routers online: ${onlineRoutersCount} of ${routers.length}\nActive OLT units: ${oltsCount}\nONT optical alarms: ${losOntCount}\nOpen network alerts: ${openAlertsCount}`,
      metricsCited: [
        {
          label: "Routers Online",
          value: `${onlineRoutersCount}/${routers.length}`,
        },
        { label: "Active OLTs", value: String(oltsCount) },
        { label: "ONT Alarms", value: String(losOntCount) },
        { label: "Open Alerts", value: String(openAlertsCount) },
      ],
      proposedActions: [],
      confidenceLevel: "CONFIRMED",
    });
  }

  // ==========================================================================
  // 10. BUSINESS PERFORMANCE EXECUTIVE SUMMARY (Section 13)
  // ==========================================================================
  if (
    /\b(how is the business performing|business performance|executive summary)\b/i.test(
      q
    )
  ) {
    const growth = toolkit.getCustomerGrowth().data;
    const rev = toolkit.getRevenueMetrics().data;
    const churn = toolkit.getChurnMetrics().data;
    const routers = toolkit.getRouterHealth().data ?? [];
    const onlineRouters = routers.filter((r) => r.status === "ONLINE").length;

    return finalize({
      intent: "BUSINESS_PERFORMANCE_SUMMARY",
      headline: `${ctx.organizationName} Business Performance`,
      answerMarkdown: [
        "Business performance",
        "Subscriber Base and Retention",
        `Total subscribers: ${growth?.totalCustomers ?? 0}`,
        `Active: ${growth?.activeCustomers ?? 0}`,
        `Suspended: ${growth?.suspendedCustomers ?? 0}`,
        `Pending installation: ${growth?.pendingInstallations ?? 0}`,
        `Retention and optical alerts: ${churn?.atRiskCount ?? 0}`,
        "",
        "Financial Performance",
        `Monthly Recurring Revenue (MRR): ${ctx.currency} ${(rev?.mrr ?? 0).toLocaleString()}`,
        `ARR: ${ctx.currency} ${(rev?.arr ?? 0).toLocaleString()}`,
        `ARPU: ${ctx.currency} ${(rev?.arpu ?? 0).toLocaleString()}`,
        `Collection rate: ${rev?.collectionRatePercent ?? 0}% (${ctx.currency} ${(rev?.collectedThisPeriod ?? 0).toLocaleString()} collected)`,
        `Outstanding receivables: ${ctx.currency} ${(rev?.totalArOutstanding ?? 0).toLocaleString()}`,
        "",
        "Network Availability",
        `Routers online: ${onlineRouters} of ${routers.length}`,
      ].join("\n"),
      metricsCited: [
        {
          label: "Active Subscribers",
          value: `${growth?.activeCustomers ?? 0}/${growth?.totalCustomers ?? 0}`,
        },
        {
          label: "MRR",
          value: `${ctx.currency} ${(rev?.mrr ?? 0).toLocaleString()}`,
        },
        {
          label: "ARPU",
          value: `${ctx.currency} ${(rev?.arpu ?? 0).toLocaleString()}`,
        },
        {
          label: "Collection Rate",
          value: `${rev?.collectionRatePercent ?? 0}%`,
        },
      ],
      proposedActions: [],
      confidenceLevel: "CONFIRMED",
    });
  }

  // ==========================================================================
  // 11. FEATURE EXPLANATION & NAVIGATION ASSISTANCE (Sections 9, 16, 39)
  // ==========================================================================
  if (
    /\b(how does|how do i|where do i|where can i|what does this|explain|configure|can i|captive portal|add a subscriber|create a package|connect a mikrotik|reconcile a payment)\b/i.test(
      q
    )
  ) {
    const capRes = toolkit.getFeatureCapabilities(prompt);
    const matched = capRes.data?.[0];
    if (matched) {
      const howSteps = matched.howItWorks.join("\n");
      const actionsList = matched.availableActions.join("\n");

      const technicalFooter = allowTechnical
        ? `\n\nTechnical route: ${matched.route}${
            matched.apiEndpoints.length > 0
              ? ` | API endpoints: ${matched.apiEndpoints.join(", ")}`
              : ""
          }`
        : "";

      return finalize({
        intent: "FEATURE_AND_NAVIGATION_GUIDE",
        headline: matched.featureName,
        answerMarkdown: `${matched.description}\n\nWhere to access it: You can manage this from the ${matched.navigationSection}.\n\nHow it works:\n${howSteps}\n\nAvailable actions:\n${actionsList}${technicalFooter}`,
        metricsCited: [{ label: "Section", value: matched.module }],
        proposedActions: [],
        confidenceLevel: "CONFIRMED",
      });
    }
  }

  // ==========================================================================
  // 12. DEFAULT: GENERAL OPERATIONS BRIEF
  // ==========================================================================
  const allSubs = toolkit.searchCustomers("").data ?? [];
  const rev = toolkit.getRevenueMetrics().data;
  const routers = toolkit.getRouterHealth().data ?? [];
  const incidents = toolkit.getNetworkIncidents().data;

  const onlineSubsCount = allSubs.filter((s) => s.isOnline).length;
  const activeSubsCount = allSubs.filter((s) => s.status === "ACTIVE").length;
  const onlineRoutersCount = routers.filter((r) => r.status === "ONLINE").length;

  return finalize({
    intent: "GENERAL_OPERATIONS_BRIEF",
    headline: `${ctx.organizationName} Operations Summary`,
    answerMarkdown: `Subscribers: ${allSubs.length} total (${activeSubsCount} active, ${onlineSubsCount} online sessions)\nMonthly Recurring Revenue: ${ctx.currency} ${(rev?.mrr ?? 0).toLocaleString()} (${rev?.collectionRatePercent ?? 0}% collection rate)\nTrial balance: ${
      rev?.trialBalanceBalanced ? "Verified" : "Review needed"
    }\nNetwork availability: ${onlineRoutersCount} of ${
      routers.length
    } MikroTik routers online, ${dataset.olts.length} OLT units monitored`,
    metricsCited: [
      {
        label: "MRR",
        value: `${ctx.currency} ${(rev?.mrr ?? 0).toLocaleString()}`,
      },
      {
        label: "Online Sessions",
        value: `${onlineSubsCount}/${allSubs.length}`,
      },
      {
        label: "Routers Online",
        value: `${onlineRoutersCount}/${routers.length}`,
      },
      {
        label: "Open Alerts",
        value: String(incidents?.openAlerts.length ?? 0),
      },
    ],
    proposedActions: [],
    confidenceLevel: "CONFIRMED",
  });
}

/**
 * Backward-compatible synchronous entry point `runCopilotQuery(prompt, snapshot?, memory?)`
 * used by UI components and unit tests.
 */
export function runCopilotQuery(
  prompt: string,
  ctxSnapshot?: CopilotContextSnapshot,
  memory?: CopilotConversationMemory,
  options?: { userRole?: UserRole; organizationId?: string }
): CopilotResponse {
  const env = ctxSnapshot
    ? adaptSnapshotToEnvironment(ctxSnapshot)
    : buildDemoCopilotEnvironment({
        userRole: options?.userRole,
        organizationId: options?.organizationId,
      });

  if (options?.userRole) {
    env.ctx.userRole = options.userRole;
  }

  return executeCopilotIntelligence({
    prompt,
    ctx: env.ctx,
    dataset: env.dataset,
    memory,
  });
}
