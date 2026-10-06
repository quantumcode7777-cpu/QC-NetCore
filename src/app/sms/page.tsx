"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Send,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Search,
  Filter,
  FileText,
  Sliders,
  Phone,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  X,
  Plus,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, btnClass } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/States";
import { cn, formatShortDate } from "@/lib/utils";
import {
  calculateSmsSegments,
  EVENT_SUPPORTED_VARIABLES,
  validateTemplateVariables,
  resolvePersonalizedMessage,
  type SmsRecipientMode,
  type SmsCategory,
  type SmsMessageType,
  type SmsDeliveryStatus,
  type SmsProviderType,
  type SmsEnvironmentType,
  type SmsOverviewMetrics,
  type SmsProviderClientSummary,
  type EnrichedSmsRecipient,
  type SmsTemplateRecord,
  type SmsMessageRecord,
} from "@/lib/sms/engine";
import type { ServicePlan, Site, Router } from "@/types";

type ActiveTab =
  | "COMPOSE"
  | "HISTORY"
  | "TEMPLATES"
  | "DIRECTORY"
  | "PROVIDER";

const RECIPIENT_MODES: Array<{
  value: SmsRecipientMode;
  label: string;
  description: string;
}> = [
  {
    value: "INDIVIDUAL",
    label: "Individual customer",
    description: "Send to a single subscriber",
  },
  {
    value: "SELECTED",
    label: "Selected customers",
    description: "Hand-pick multiple subscribers",
  },
  {
    value: "OVERDUE_CUSTOMERS",
    label: "Overdue customers",
    description: "Subscribers with unpaid balances",
  },
  {
    value: "EXPIRING_SUBSCRIBERS",
    label: "Expiring subscribers",
    description: "Subscriptions expiring soon",
  },
  {
    value: "PACKAGE_SUBSCRIBERS",
    label: "Package subscribers",
    description: "Target by service plan",
  },
  {
    value: "ACTIVE_SUBSCRIBERS",
    label: "Active subscribers",
    description: "All active connections",
  },
  {
    value: "SUSPENDED_SUBSCRIBERS",
    label: "Suspended subscribers",
    description: "Accounts currently suspended",
  },
  {
    value: "NETWORK_POP_OR_ROUTER",
    label: "POP / Router subscribers",
    description: "Target by POP site or NAS router",
  },
  {
    value: "RECENTLY_REGISTERED",
    label: "Recently registered",
    description: "Newest onboarded customers",
  },
  {
    value: "ALL_ELIGIBLE",
    label: "All eligible customers",
    description: "All subscribers with valid phone numbers",
  },
];

const MESSAGE_TYPES: Array<{
  value: SmsMessageType;
  label: string;
  defaultCategory: SmsCategory;
}> = [
  {
    value: "PAYMENT_REMINDER",
    label: "Payment Reminder",
    defaultCategory: "TRANSACTIONAL",
  },
  {
    value: "PAYMENT_CONFIRMATION",
    label: "Payment Notification",
    defaultCategory: "TRANSACTIONAL",
  },
  {
    value: "EXPIRY_REMINDER",
    label: "Subscription Expiry Reminder",
    defaultCategory: "TRANSACTIONAL",
  },
  {
    value: "SUBSCRIPTION_NOTIFICATION",
    label: "Subscription Notification",
    defaultCategory: "TRANSACTIONAL",
  },
  {
    value: "SUSPENSION_NOTICE",
    label: "Suspension Notification",
    defaultCategory: "TRANSACTIONAL",
  },
  {
    value: "RESTORATION_NOTICE",
    label: "Service Restoration Notice",
    defaultCategory: "TRANSACTIONAL",
  },
  {
    value: "OUTAGE_ANNOUNCEMENT",
    label: "Outage Announcement",
    defaultCategory: "OPERATIONAL",
  },
  {
    value: "MAINTENANCE_NOTICE",
    label: "Maintenance Notice",
    defaultCategory: "OPERATIONAL",
  },
  {
    value: "PACKAGE_UPGRADE",
    label: "Package Upgrade / Promotion",
    defaultCategory: "MARKETING",
  },
  {
    value: "GENERAL_ANNOUNCEMENT",
    label: "General Customer Announcement",
    defaultCategory: "TRANSACTIONAL",
  },
];

const inputClass =
  "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";

export default function SmsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("COMPOSE");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Server state
  const [overview, setOverview] = useState<SmsOverviewMetrics | null>(null);
  const [provider, setProvider] = useState<SmsProviderClientSummary | null>(null);
  const [recipients, setRecipients] = useState<EnrichedSmsRecipient[]>([]);
  const [templates, setTemplates] = useState<SmsTemplateRecord[]>([]);
  const [history, setHistory] = useState<SmsMessageRecord[]>([]);
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [routers, setRouters] = useState<Router[]>([]);
  const [permissions, setPermissions] = useState({
    canSend: true,
    canSendBulk: true,
    canManageTemplates: true,
    canManageProvider: true,
    canViewHistory: true,
    canViewUsage: true,
  });

  // Composer state
  const [recipientMode, setRecipientMode] =
    useState<SmsRecipientMode>("INDIVIDUAL");
  const [messageType, setMessageType] =
    useState<SmsMessageType>("PAYMENT_REMINDER");
  const [category, setCategory] = useState<SmsCategory>("TRANSACTIONAL");
  const [selectedTemplateCode, setSelectedTemplateCode] = useState<string>("");
  const [messageText, setMessageText] = useState<string>("");

  // Recipient filters & selection
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [filterPlanId, setFilterPlanId] = useState<string>("");
  const [filterSiteId, setFilterSiteId] = useState<string>("");
  const [filterRouterId, setFilterRouterId] = useState<string>("");
  const [filterServiceType, setFilterServiceType] = useState<
    "ALL" | "PPPOE" | "HOTSPOT"
  >("ALL");
  const [filterSessionState, setFilterSessionState] = useState<
    "ALL" | "ONLINE" | "OFFLINE"
  >("ALL");
  const [filterBillingStatus, setFilterBillingStatus] = useState<
    "ALL" | "PAID" | "UNPAID" | "OVERDUE" | "EXPIRING_SOON"
  >("ALL");
  const [expiringDays, setExpiringDays] = useState<number>(7);

  // Dispatch & confirmation state
  const [isDispatching, setIsDispatching] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    tone: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  // History filters
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState<SmsDeliveryStatus | "ALL">(
    "ALL"
  );
  const [historyType, setHistoryType] = useState<SmsMessageType | "ALL">("ALL");
  const [historyProvider, setHistoryProvider] = useState<
    SmsProviderType | "ALL"
  >("ALL");

  // Template Editor state
  const [tplName, setTplName] = useState("");
  const [tplCode, setTplCode] = useState("");
  const [tplCategory, setTplCategory] = useState<SmsCategory>("TRANSACTIONAL");
  const [tplEvent, setTplEvent] = useState("payment.reminder");
  const [tplBody, setTplBody] = useState("");
  const [tplError, setTplError] = useState<string | null>(null);

  // Provider Config state
  const [cfgProvider, setCfgProvider] =
    useState<SmsProviderType>("AFRICAS_TALKING");
  const [cfgSenderId, setCfgSenderId] = useState("");
  const [cfgUsername, setCfgUsername] = useState("");
  const [cfgAccountSid, setCfgAccountSid] = useState("");
  const [cfgApiKey, setCfgApiKey] = useState("");
  const [cfgApiSecret, setCfgApiSecret] = useState("");
  const [cfgEnvironment, setCfgEnvironment] =
    useState<SmsEnvironmentType>("PRODUCTION");
  const [cfgCostPerSegment, setCfgCostPerSegment] = useState("");
  const [cfgEnabled, setCfgEnabled] = useState(false);

  const loadSmsData = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/v1/sms", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setLoadError(json?.message || "Unable to load SMS communications.");
        return;
      }
      const d = json.data;
      setOverview(d.overview);
      setProvider(d.provider);
      const loadedRecipients = (d.recipients || []) as EnrichedSmsRecipient[];
      setRecipients(loadedRecipients);
      if (loadedRecipients.length > 0) {
        setSelectedCustomerIds((prev) =>
          prev.length === 0 ? [loadedRecipients[0].customerId] : prev
        );
      }
      setTemplates(d.templates || []);
      setHistory(d.history || []);
      setPlans(d.plans || []);
      setSites(d.sites || []);
      setRouters(d.routers || []);
      if (d.permissions) setPermissions(d.permissions);

      if (d.provider) {
        setCfgProvider(
          d.provider.provider === "UNCONFIGURED"
            ? "AFRICAS_TALKING"
            : d.provider.provider
        );
        setCfgSenderId(
          d.provider.senderId && d.provider.senderId !== "—"
            ? d.provider.senderId
            : ""
        );
        setCfgUsername(d.provider.username || "");
        setCfgAccountSid(d.provider.accountSid || "");
        setCfgApiKey(d.provider.hasApiKey ? "••••••••" : "");
        setCfgApiSecret(d.provider.hasApiSecret ? "••••••••" : "");
        setCfgEnvironment(d.provider.environment || "PRODUCTION");
        setCfgCostPerSegment(
          d.provider.costPerSegment !== null
            ? String(d.provider.costPerSegment)
            : ""
        );
        setCfgEnabled(Boolean(d.provider.isEnabled));
      }
    } catch {
      setLoadError("Unable to load SMS communications right now.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSmsData();
  }, [loadSmsData]);

  // Searchable customer list in Composer
  const searchedCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter(
      (r) =>
        r.customerName.toLowerCase().includes(q) ||
        r.accountNumber.toLowerCase().includes(q) ||
        r.rawPhoneNumber.toLowerCase().includes(q) ||
        r.normalizedPhoneNumber.toLowerCase().includes(q) ||
        r.formattedPhone.toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q) ||
        r.packageName.toLowerCase().includes(q) ||
        r.serviceType.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
    );
  }, [recipients, customerSearch]);

  // Dynamically compute targeted recipients on client for instant feedback
  const targetedResolution = useMemo(() => {
    let matched = recipients.filter((r) => r.status !== "TERMINATED");

    const sortedByRegDesc = [...matched].sort(
      (a, b) =>
        new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
    );
    const recentIds = new Set(
      sortedByRegDesc.slice(0, 3).map((r) => r.customerId)
    );

    switch (recipientMode) {
      case "INDIVIDUAL":
        matched = matched.filter(
          (r) => r.customerId === selectedCustomerIds[0]
        );
        break;
      case "SELECTED":
        matched = matched.filter((r) =>
          selectedCustomerIds.includes(r.customerId)
        );
        break;
      case "ACTIVE_SUBSCRIBERS":
        matched = matched.filter((r) => r.status === "ACTIVE");
        break;
      case "SUSPENDED_SUBSCRIBERS":
        matched = matched.filter((r) => r.status === "SUSPENDED");
        break;
      case "EXPIRING_SUBSCRIBERS":
        matched = matched.filter(
          (r) =>
            (r.daysToExpiry !== null && r.daysToExpiry <= expiringDays) ||
            r.status === "SUSPENDED"
        );
        break;
      case "OVERDUE_CUSTOMERS":
        matched = matched.filter((r) => r.balanceDue > 0);
        break;
      case "RECENTLY_REGISTERED":
        matched = matched.filter((r) => recentIds.has(r.customerId));
        break;
      case "PACKAGE_SUBSCRIBERS":
        if (filterPlanId) {
          matched = matched.filter((r) => r.packageId === filterPlanId);
        }
        break;
      case "NETWORK_POP_OR_ROUTER":
        if (filterSiteId) {
          matched = matched.filter((r) => r.siteId === filterSiteId);
        }
        if (filterRouterId) {
          matched = matched.filter((r) => r.routerId === filterRouterId);
        }
        break;
      default:
        break;
    }

    if (filterServiceType !== "ALL") {
      matched = matched.filter((r) => r.serviceType === filterServiceType);
    }
    if (filterSessionState !== "ALL") {
      matched = matched.filter((r) =>
        filterSessionState === "ONLINE" ? r.isOnline : !r.isOnline
      );
    }
    if (filterBillingStatus !== "ALL") {
      if (filterBillingStatus === "PAID") {
        matched = matched.filter((r) => r.balanceDue <= 0);
      } else if (
        filterBillingStatus === "UNPAID" ||
        filterBillingStatus === "OVERDUE"
      ) {
        matched = matched.filter((r) => r.balanceDue > 0);
      } else if (filterBillingStatus === "EXPIRING_SOON") {
        matched = matched.filter(
          (r) => r.daysToExpiry !== null && r.daysToExpiry <= 5
        );
      }
    }

    const eligible: EnrichedSmsRecipient[] = [];
    const skippedOptOut: EnrichedSmsRecipient[] = [];
    const skippedInvalid: EnrichedSmsRecipient[] = [];
    const seenPhones = new Set<string>();

    for (const r of matched) {
      if (!r.phoneValid || !r.normalizedPhoneNumber) {
        skippedInvalid.push(r);
        continue;
      }
      if (category === "MARKETING" && !r.marketingOptIn) {
        skippedOptOut.push(r);
        continue;
      }
      if (seenPhones.has(r.normalizedPhoneNumber)) continue;
      seenPhones.add(r.normalizedPhoneNumber);
      eligible.push(r);
    }

    return {
      eligible,
      skippedOptOut,
      skippedInvalid,
    };
  }, [
    recipients,
    recipientMode,
    selectedCustomerIds,
    expiringDays,
    filterPlanId,
    filterSiteId,
    filterRouterId,
    filterServiceType,
    filterSessionState,
    filterBillingStatus,
    category,
  ]);

  // Live segmentation & personalization validation
  const composerAnalysis = useMemo(() => {
    const tplValidation = validateTemplateVariables(
      messageText,
      "manual.campaign"
    );
    const sampleRecipient =
      targetedResolution.eligible[0] || recipients[0] || null;
    const personalized = sampleRecipient
      ? resolvePersonalizedMessage(messageText, sampleRecipient)
      : { ok: tplValidation.valid, resolvedMessage: messageText, missingVariables: [] };

    const seg = calculateSmsSegments(
      personalized.ok && personalized.resolvedMessage
        ? personalized.resolvedMessage
        : messageText
    );

    const recipientCount = targetedResolution.eligible.length;
    const estimatedUnits = recipientCount * Math.max(1, seg.segments);
    const costPerSeg = provider?.isConfigured ? provider.costPerSegment : null;
    const estimatedCost =
      costPerSeg !== null
        ? Number((estimatedUnits * costPerSeg).toFixed(2))
        : null;

    return {
      tplValidation,
      personalized,
      sampleRecipient,
      seg,
      recipientCount,
      estimatedUnits,
      estimatedCost,
    };
  }, [messageText, targetedResolution.eligible, recipients, provider]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return history.filter((m) => {
      if (historyStatus !== "ALL" && m.status !== historyStatus) return false;
      if (historyType !== "ALL" && m.messageType !== historyType) return false;
      if (historyProvider !== "ALL" && m.provider !== historyProvider)
        return false;
      if (!q) return true;
      return (
        (m.customerName || "").toLowerCase().includes(q) ||
        (m.accountNumber || "").toLowerCase().includes(q) ||
        m.recipientPhone.toLowerCase().includes(q) ||
        m.normalizedPhone.toLowerCase().includes(q) ||
        m.messageBody.toLowerCase().includes(q) ||
        m.providerMessageId.toLowerCase().includes(q)
      );
    });
  }, [history, historySearch, historyStatus, historyType, historyProvider]);

  const handleApplyTemplate = (code: string) => {
    setSelectedTemplateCode(code);
    const found = templates.find((t) => t.code === code);
    if (found) {
      setMessageText(found.bodyTemplate);
      setCategory(found.category);
    }
  };

  const handleToggleSelectedCustomer = (customerId: string) => {
    if (recipientMode === "INDIVIDUAL") {
      setSelectedCustomerIds([customerId]);
      return;
    }
    setSelectedCustomerIds((prev) =>
      prev.includes(customerId)
        ? prev.filter((id) => id !== customerId)
        : [...prev, customerId]
    );
  };

  const initiateSend = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackBanner(null);

    if (!composerAnalysis.tplValidation.valid) {
      setFeedbackBanner({
        tone: "error",
        text:
          composerAnalysis.tplValidation.error ||
          "Please fix invalid template variables before sending.",
      });
      return;
    }

    if (!composerAnalysis.personalized.ok) {
      setFeedbackBanner({
        tone: "error",
        text:
          composerAnalysis.personalized.error ||
          "Required personalization variable is unavailable for the selected recipient.",
      });
      return;
    }

    if (composerAnalysis.recipientCount === 0) {
      setFeedbackBanner({
        tone: "error",
        text: "No eligible recipients with valid phone numbers match the current selection.",
      });
      return;
    }

    const isBulk =
      recipientMode !== "INDIVIDUAL" || composerAnalysis.recipientCount > 1;
    if (isBulk) {
      setConfirmModalOpen(true);
      return;
    }

    void executeSend(true);
  };

  const executeSend = async (confirmed: boolean) => {
    setIsDispatching(true);
    setFeedbackBanner(null);
    try {
      const res = await fetch("/api/v1/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SEND",
          recipientMode,
          messageType,
          category,
          templateCode: selectedTemplateCode || undefined,
          messageTemplate: messageText,
          confirmed,
          idempotencyKey: `ui-${recipientMode}-${Date.now()}`,
          filters: {
            customerId:
              recipientMode === "INDIVIDUAL"
                ? selectedCustomerIds[0]
                : undefined,
            customerIds:
              recipientMode === "SELECTED" ? selectedCustomerIds : undefined,
            planId: filterPlanId || undefined,
            siteId: filterSiteId || undefined,
            routerId: filterRouterId || undefined,
            serviceType: filterServiceType,
            sessionState: filterSessionState,
            billingStatus: filterBillingStatus,
            expiringWithinDays: expiringDays,
          },
        }),
      });

      const json = await res.json();
      setConfirmModalOpen(false);

      if (!res.ok || !json?.success) {
        setFeedbackBanner({
          tone: "error",
          text:
            json?.message ||
            json?.error ||
            "SMS could not be sent. Verify your provider configuration and permissions.",
        });
        return;
      }

      setFeedbackBanner({
        tone: "success",
        text:
          json.message ||
          `Successfully dispatched SMS to ${composerAnalysis.recipientCount} recipient(s).`,
      });
      await loadSmsData();
    } catch {
      setFeedbackBanner({
        tone: "error",
        text: "Network error while dispatching SMS.",
      });
    } finally {
      setIsDispatching(false);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setTplError(null);
    const check = validateTemplateVariables(tplBody, tplEvent);
    if (!check.valid) {
      setTplError(check.error || "Invalid template variables.");
      return;
    }

    const res = await fetch("/api/v1/sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "SAVE_TEMPLATE",
        code: tplCode || tplName,
        name: tplName,
        category: tplCategory,
        triggerEvent: tplEvent,
        bodyTemplate: tplBody,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json?.success) {
      setTplError(json?.message || "Could not save template.");
      return;
    }
    setTplName("");
    setTplCode("");
    setTplBody("");
    setFeedbackBanner({
      tone: "success",
      text: `Saved template "${json.data.name}".`,
    });
    await loadSmsData();
  };

  const handleToggleMarketingPref = async (
    customerId: string,
    currentVal: boolean
  ) => {
    await fetch("/api/v1/sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPDATE_PREFERENCES",
        customerId,
        marketingSms: !currentVal,
      }),
    });
    await loadSmsData();
  };

  const handleSaveProviderConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackBanner(null);
    const res = await fetch("/api/v1/sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "CONFIGURE_PROVIDER",
        provider: cfgProvider,
        senderId: cfgSenderId,
        username: cfgUsername,
        accountSid: cfgAccountSid,
        apiKey: cfgApiKey,
        apiSecret: cfgApiSecret,
        environment: cfgEnvironment,
        isEnabled: cfgEnabled,
        costPerSegment: Number(cfgCostPerSegment) || 0.8,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json?.success) {
      setFeedbackBanner({
        tone: "error",
        text: json?.message || "Could not update SMS provider configuration.",
      });
      return;
    }
    setFeedbackBanner({
      tone: "success",
      text: "SMS provider configuration saved securely on the server.",
    });
    await loadSmsData();
  };

  return (
    <AppShell>
      <PageHeader
        title="SMS Communications"
        description="Tenant-isolated subscriber messaging, automated billing alerts, delivery tracking, and E.164 phone management."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadSmsData}
              className={btnClass("secondary")}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("PROVIDER")}
              className={btnClass("secondary")}
            >
              <Sliders className="h-4 w-4" aria-hidden="true" />
              Gateway Setup
            </button>
          </div>
        }
      />

      {/* Provider Configuration Status Banner (Section 4 & 40) */}
      {provider && !provider.isConfigured && (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-xs text-warning"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <span className="font-semibold">SMS provider not configured.</span>{" "}
              Connect an SMS provider to start sending messages.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("PROVIDER")}
            className="rounded-md border border-warning/40 bg-surface px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-surface-elevated"
          >
            Configure SMS Gateway
          </button>
        </div>
      )}

      {feedbackBanner && (
        <div
          role="alert"
          className={cn(
            "mb-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-xs font-medium",
            feedbackBanner.tone === "success"
              ? "border-success/30 bg-success-soft text-success"
              : feedbackBanner.tone === "warning"
              ? "border-warning/30 bg-warning-soft text-warning"
              : "border-danger/30 bg-danger-soft text-danger"
          )}
        >
          <div className="flex items-center gap-2">
            {feedbackBanner.tone === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{feedbackBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-current opacity-75 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loadError && (
        <div className="mb-4">
          <ErrorState title={loadError} onRetry={loadSmsData} />
        </div>
      )}

      {/* Section 4: SMS Overview KPIs (Computed from actual SMS records & provider status) */}
      {overview && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-lg border border-border bg-surface p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Available SMS Credits</span>
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="mt-1.5 font-mono text-lg font-semibold text-foreground">
              {overview.providerConfigured && overview.availableCredits !== null
                ? `${overview.availableCredits.toLocaleString()} units`
                : "Not configured"}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {overview.providerConfigured && overview.remainingBalance !== null
                ? `Balance: ${overview.currency} ${overview.remainingBalance.toLocaleString()}`
                : "Provider pricing unavailable."}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Messages Sent</span>
              <Send className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="mt-1.5 font-mono text-lg font-semibold text-foreground">
              {overview.totalMessagesSent.toLocaleString()}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Today: <strong>{overview.messagesSentToday}</strong> · Month:{" "}
              <strong>{overview.messagesSentThisMonth}</strong>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Delivered &amp; Rate</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            </div>
            <div className="mt-1.5 font-mono text-lg font-semibold text-foreground">
              {overview.deliveredCount.toLocaleString()}{" "}
              <span className="text-xs font-normal text-success">
                ({overview.deliveryRatePercent}%)
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Confirmed by gateway DLR
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Pending / Failed</span>
              <Clock className="h-3.5 w-3.5 text-warning" />
            </div>
            <div className="mt-1.5 font-mono text-lg font-semibold text-foreground">
              {overview.pendingCount} pending ·{" "}
              <span className="text-danger">{overview.failedCount} failed</span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Sender ID:{" "}
              <span className="font-mono font-medium text-foreground">
                {overview.senderId}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Phone Coverage</span>
              <Phone className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="mt-1.5 font-mono text-lg font-semibold text-foreground">
              {overview.customersWithValidPhone} / {overview.totalCustomers}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {overview.customersReachableMarketing} opted-in marketing
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="mb-5 flex flex-wrap items-center gap-1 border-b border-border pb-2">
        {(
          [
            { id: "COMPOSE", label: "Send & Bulk SMS", icon: Send },
            {
              id: "HISTORY",
              label: `SMS History (${history.length})`,
              icon: Clock,
            },
            {
              id: "TEMPLATES",
              label: `Templates (${templates.length})`,
              icon: FileText,
            },
            {
              id: "DIRECTORY",
              label: `Customer Phones (${recipients.length})`,
              icon: Phone,
            },
            { id: "PROVIDER", label: "Gateway Settings", icon: Sliders },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-primary-soft text-primary font-semibold"
                  : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : (
        <>
          {/* ================================================================ */}
          {/* TAB 1: COMPOSE & SEND SMS (Individual, Targeted & Bulk)          */}
          {/* ================================================================ */}
          {activeTab === "COMPOSE" && (
            <form
              onSubmit={initiateSend}
              className="grid grid-cols-1 gap-6 lg:grid-cols-12"
            >
              {/* Left Column: Recipient Mode, Targeting Filters & Customer Search */}
              <div className="space-y-4 lg:col-span-7">
                <section className="rounded-lg border border-border bg-surface p-4 shadow-xs">
                  <h2 className="text-sm font-semibold text-foreground">
                    1. Recipient Mode &amp; Audience Targeting
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Choose an individual subscriber or dynamically target a group by subscription, package, billing, or network POP.
                  </p>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {RECIPIENT_MODES.map((m) => {
                      const active = recipientMode === m.value;
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setRecipientMode(m.value)}
                          className={cn(
                            "flex flex-col items-start rounded-md border p-2.5 text-left transition-colors",
                            active
                              ? "border-primary bg-primary-soft/60 text-foreground"
                              : "border-border bg-surface hover:bg-surface-elevated"
                          )}
                        >
                          <span className="text-xs font-semibold">
                            {m.label}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {m.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Dynamic Contextual Filters (Section 8) */}
                  <div className="mt-4 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Package / Plan
                      </label>
                      <select
                        value={filterPlanId}
                        onChange={(e) => setFilterPlanId(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">All Packages</option>
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.currency} {p.price.toLocaleString()})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Billing State
                      </label>
                      <select
                        value={filterBillingStatus}
                        onChange={(e) =>
                          setFilterBillingStatus(
                            e.target.value as typeof filterBillingStatus
                          )
                        }
                        className={inputClass}
                      >
                        <option value="ALL">All Billing States</option>
                        <option value="PAID">Paid (KES 0 Due)</option>
                        <option value="OVERDUE">Overdue / Unpaid</option>
                        <option value="EXPIRING_SOON">Expiring Soon</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        POP / Site
                      </label>
                      <select
                        value={filterSiteId}
                        onChange={(e) => setFilterSiteId(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">All POPs / Sites</option>
                        {sites.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        NAS Router
                      </label>
                      <select
                        value={filterRouterId}
                        onChange={(e) => setFilterRouterId(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">All Routers</option>
                        {routers.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.managementIp})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Service Type
                      </label>
                      <select
                        value={filterServiceType}
                        onChange={(e) =>
                          setFilterServiceType(
                            e.target.value as typeof filterServiceType
                          )
                        }
                        className={inputClass}
                      >
                        <option value="ALL">PPPoE &amp; Hotspot</option>
                        <option value="PPPOE">PPPoE Only</option>
                        <option value="HOTSPOT">Hotspot Only</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Session State
                      </label>
                      <select
                        value={filterSessionState}
                        onChange={(e) =>
                          setFilterSessionState(
                            e.target.value as typeof filterSessionState
                          )
                        }
                        className={inputClass}
                      >
                        <option value="ALL">Online &amp; Offline</option>
                        <option value="ONLINE">Active Session (Online)</option>
                        <option value="OFFLINE">Currently Offline</option>
                      </select>
                    </div>
                  </div>

                  {recipientMode === "EXPIRING_SUBSCRIBERS" && (
                    <div className="mt-3 flex items-center gap-3 rounded-md border border-border bg-surface-subtle p-2.5 text-xs">
                      <span className="font-medium text-foreground">
                        Expiring within (days):
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={expiringDays}
                        onChange={(e) =>
                          setExpiringDays(Number(e.target.value) || 3)
                        }
                        className="h-8 w-20 rounded border border-border bg-surface px-2 font-mono text-xs"
                      />
                    </div>
                  )}
                </section>

                {/* Section 6: Customer Search & Selection Table */}
                <section className="rounded-lg border border-border bg-surface p-4 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Customer Search &amp; Matched Recipients (
                        {targetedResolution.eligible.length})
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Search by name, customer ID, phone number, email, package, service, or status.
                      </p>
                    </div>
                  </div>

                   <div className="relative mt-3">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="search"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Search by customer name, account number, phone, email, package, or status..."
                      className={cn(inputClass, "pl-9")}
                    />
                  </div>

                  {recipients.length === 0 ? (
                    <div className="mt-4">
                      <EmptyState
                        title="No customer phone numbers available yet."
                        description="Add subscribers with phone numbers to begin sending SMS notifications."
                      />
                    </div>
                  ) : (
                    <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-border">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 border-b border-border bg-surface-subtle text-[11px] uppercase text-muted-foreground">
                          <tr>
                            {(recipientMode === "INDIVIDUAL" ||
                              recipientMode === "SELECTED") && (
                              <th className="w-8 px-2.5 py-2">Sel</th>
                            )}
                            <th className="px-3 py-2">Customer Name</th>
                            <th className="px-3 py-2">Phone Number</th>
                            <th className="px-3 py-2">Service</th>
                            <th className="px-3 py-2">Package</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {(recipientMode === "INDIVIDUAL" ||
                          recipientMode === "SELECTED"
                            ? searchedCustomers
                            : targetedResolution.eligible
                          ).map((r) => {
                            const isChecked = selectedCustomerIds.includes(
                              r.customerId
                            );
                            return (
                              <tr
                                key={r.customerId}
                                onClick={() => {
                                  if (
                                    recipientMode === "INDIVIDUAL" ||
                                    recipientMode === "SELECTED"
                                  ) {
                                    handleToggleSelectedCustomer(r.customerId);
                                  }
                                }}
                                className={cn(
                                  "transition-colors",
                                  (recipientMode === "INDIVIDUAL" ||
                                    recipientMode === "SELECTED") &&
                                    "cursor-pointer hover:bg-surface-elevated",
                                  isChecked &&
                                    (recipientMode === "INDIVIDUAL" ||
                                      recipientMode === "SELECTED") &&
                                    "bg-primary-soft/40"
                                )}
                              >
                                {(recipientMode === "INDIVIDUAL" ||
                                  recipientMode === "SELECTED") && (
                                  <td className="px-2.5 py-2">
                                    <input
                                      type={
                                        recipientMode === "INDIVIDUAL"
                                          ? "radio"
                                          : "checkbox"
                                      }
                                      checked={isChecked}
                                      onChange={() =>
                                        handleToggleSelectedCustomer(
                                          r.customerId
                                        )
                                      }
                                      className="accent-primary"
                                    />
                                  </td>
                                )}
                                <td className="px-3 py-2 font-medium text-foreground">
                                  <div>{r.customerName}</div>
                                  <div className="font-mono text-[11px] text-muted-foreground">
                                    {r.accountNumber} · {r.popName}
                                  </div>
                                </td>
                                <td className="px-3 py-2 font-mono text-foreground">
                                  {r.formattedPhone}
                                </td>
                                <td className="px-3 py-2">{r.serviceType}</td>
                                <td className="px-3 py-2">{r.packageName}</td>
                                <td className="px-3 py-2">
                                  <StatusBadge status={r.status} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>

              {/* Right Column: Message Composer & Campaign Summary */}
              <div className="space-y-4 lg:col-span-5">
                <section className="rounded-lg border border-border bg-surface p-4 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground">
                      2. SMS Message Composer
                    </h2>
                    <span className="rounded border border-border bg-surface-subtle px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {composerAnalysis.seg.encoding}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Message Type
                      </label>
                      <select
                        value={messageType}
                        onChange={(e) => {
                          const nextType = e.target.value as SmsMessageType;
                          setMessageType(nextType);
                          const def = MESSAGE_TYPES.find(
                            (m) => m.value === nextType
                          );
                          if (def) setCategory(def.defaultCategory);
                        }}
                        className={inputClass}
                      >
                        {MESSAGE_TYPES.map((mt) => (
                          <option key={mt.value} value={mt.value}>
                            {mt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Communication Category
                      </label>
                      <select
                        value={category}
                        onChange={(e) =>
                          setCategory(e.target.value as SmsCategory)
                        }
                        className={inputClass}
                      >
                        <option value="TRANSACTIONAL">
                          Transactional SMS (Service / Billing)
                        </option>
                        <option value="OPERATIONAL">
                          Operational SMS (NOC / Outages)
                        </option>
                        <option value="MARKETING">
                          Marketing SMS (Honors Opt-Out)
                        </option>
                      </select>
                    </div>
                  </div>

                  {/* Quick Template Picker */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">
                      Load Approved Template
                    </label>
                    <select
                      value={selectedTemplateCode}
                      onChange={(e) => handleApplyTemplate(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">-- Custom message or select template --</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.code}>
                          {t.name} ({t.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Message Textarea */}
                  <div>
                    <label
                      htmlFor="sms-composer-textarea"
                      className="mb-1 block text-xs font-medium text-foreground"
                    >
                      Message Body
                    </label>
                    <textarea
                      id="sms-composer-textarea"
                      rows={4}
                      required
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Type your SMS message..."
                      className="w-full rounded-md border border-border bg-surface p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    />
                  </div>

                  {/* Section 18: Character, Segment, Recipient & Usage Counter */}
                  <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-surface-subtle p-3 text-xs sm:grid-cols-4">
                    <div>
                      <div className="text-[11px] text-muted-foreground">
                        Characters
                      </div>
                      <div className="font-mono font-semibold text-foreground">
                        {composerAnalysis.seg.characterCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">
                        SMS segments
                      </div>
                      <div className="font-mono font-semibold text-foreground">
                        {composerAnalysis.seg.segments}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">
                        Recipients
                      </div>
                      <div className="font-mono font-semibold text-primary">
                        {composerAnalysis.recipientCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">
                        Estimated SMS units
                      </div>
                      <div className="font-mono font-semibold text-foreground">
                        {composerAnalysis.estimatedUnits}
                      </div>
                    </div>
                  </div>

                  {/* Section 20: Campaign Summary & Live Preview */}
                  <div className="rounded-md border border-border bg-surface-subtle p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-semibold text-foreground">
                      <span>Message Preview</span>
                      {composerAnalysis.sampleRecipient && (
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {composerAnalysis.sampleRecipient.customerName} (
                          {composerAnalysis.sampleRecipient.formattedPhone})
                        </span>
                      )}
                    </div>

                    {!messageText.trim() ? (
                      <p className="rounded border border-border bg-surface p-2.5 text-xs text-muted-foreground">
                        Enter a message above to preview.
                      </p>
                    ) : !composerAnalysis.tplValidation.valid ||
                      !composerAnalysis.personalized.ok ? (
                      <div className="rounded border border-danger/30 bg-danger-soft p-2 text-danger">
                        {composerAnalysis.tplValidation.error ||
                          composerAnalysis.personalized.error}
                      </div>
                    ) : (
                      <p className="rounded border border-border bg-surface p-2.5 text-xs leading-relaxed text-foreground">
                        {composerAnalysis.personalized.resolvedMessage}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground">
                      <span>
                        Estimated Cost:{" "}
                        <strong className="text-foreground">
                          {composerAnalysis.estimatedCost !== null && provider
                            ? `${provider.currency} ${composerAnalysis.estimatedCost.toLocaleString()}`
                            : "Provider pricing unavailable."}
                        </strong>
                      </span>
                      {targetedResolution.skippedOptOut.length > 0 && (
                        <span className="text-warning">
                          {targetedResolution.skippedOptOut.length} opted-out of
                          marketing skipped
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      isDispatching ||
                      !permissions.canSend ||
                      !messageText.trim() ||
                      !composerAnalysis.tplValidation.valid ||
                      !composerAnalysis.personalized.ok ||
                      composerAnalysis.recipientCount === 0
                    }
                    className={cn(btnClass("primary"), "w-full justify-center py-2.5")}
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    {isDispatching
                      ? "Sending SMS..."
                      : composerAnalysis.recipientCount > 1 ||
                        recipientMode !== "INDIVIDUAL"
                      ? `Review & Send to ${composerAnalysis.recipientCount} Customer(s)`
                      : "Send SMS Now"}
                  </button>
                </section>
              </div>
            </form>
          )}

          {/* ================================================================ */}
          {/* TAB 2: SMS HISTORY & DELIVERY TRACKING (Sections 25 & 26)        */}
          {/* ================================================================ */}
          {activeTab === "HISTORY" && (
            <section className="rounded-lg border border-border bg-surface p-4 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    SMS Message History &amp; Delivery Status
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Immutable log of all individual, bulk, and automated SMS dispatches with carrier delivery statuses.
                  </p>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="relative sm:col-span-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Filter by customer, phone, message content, or provider ID..."
                    className={cn(inputClass, "pl-9")}
                  />
                </div>

                <div>
                  <select
                    value={historyStatus}
                    onChange={(e) =>
                      setHistoryStatus(
                        e.target.value as SmsDeliveryStatus | "ALL"
                      )
                    }
                    className={inputClass}
                  >
                    <option value="ALL">All Delivery Statuses</option>
                    <option value="DELIVERED">Delivered</option>
                    <option value="SENT">Sent</option>
                    <option value="QUEUED">Queued</option>
                    <option value="FAILED">Failed</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="UNKNOWN">Unknown</option>
                  </select>
                </div>

                <div>
                  <select
                    value={historyType}
                    onChange={(e) =>
                      setHistoryType(e.target.value as SmsMessageType | "ALL")
                    }
                    className={inputClass}
                  >
                    <option value="ALL">All Message Types</option>
                    {MESSAGE_TYPES.map((mt) => (
                      <option key={mt.value} value={mt.value}>
                        {mt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredHistory.length === 0 ? (
                <EmptyState
                  title="No SMS activity yet."
                  description="Messages sent to subscribers will appear here with real-time gateway delivery statuses."
                />
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-surface-subtle text-[11px] uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Recipient</th>
                        <th className="px-3 py-2.5">Type</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5">Message</th>
                        <th className="px-3 py-2.5">Provider Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredHistory.map((m) => (
                        <tr key={m.id} className="hover:bg-surface-elevated">
                          <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                            {formatShortDate(m.sentAt)}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="font-medium text-foreground">
                              {m.customerName || "Subscriber"}
                            </div>
                            <div className="font-mono text-[11px] text-muted-foreground">
                              {m.normalizedPhone}
                              {m.accountNumber ? ` · ${m.accountNumber}` : ""}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="font-medium text-foreground">
                              {m.messageType.replace(/_/g, " ")}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {m.category} · {m.segmentCount} seg
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={m.status} />
                            {m.failureReason && (
                              <div className="mt-1 max-w-44 text-[10px] text-danger">
                                {m.failureReason}
                              </div>
                            )}
                          </td>
                          <td className="max-w-md px-3 py-2.5 text-foreground">
                            <p className="line-clamp-2">{m.messageBody}</p>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                            <div>{m.providerMessageId}</div>
                            <div>
                              {m.provider} ({m.senderId})
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* ================================================================ */}
          {/* TAB 3: SMS TEMPLATES & AUTOMATED EVENTS (Sections 22, 23, 24)     */}
          {/* ================================================================ */}
          {activeTab === "TEMPLATES" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-7">
                <section className="rounded-lg border border-border bg-surface p-4 shadow-xs space-y-3">
                  <h2 className="text-sm font-semibold text-foreground">
                    Approved SMS Templates &amp; Automated Event Triggers
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Templates are validated against event variables so incomplete placeholders are never sent to customers.
                  </p>

                  <div className="divide-y divide-border rounded-md border border-border">
                    {templates.map((t) => (
                      <div
                        key={t.id}
                        className="flex flex-col justify-between gap-2 p-3 sm:flex-row sm:items-start"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">
                              {t.name}
                            </span>
                            <span className="rounded border border-border bg-surface-subtle px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                              {t.code}
                            </span>
                            <span className="rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              {t.category}
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              Event: {t.triggerEvent}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {t.bodyTemplate}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            handleApplyTemplate(t.code);
                            setActiveTab("COMPOSE");
                          }}
                          className={cn(
                            btnClass("secondary"),
                            "h-7 shrink-0 px-2.5 text-xs"
                          )}
                        >
                          Use Template
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="lg:col-span-5">
                <form
                  onSubmit={handleSaveTemplate}
                  className="rounded-lg border border-border bg-surface p-4 shadow-xs space-y-3"
                >
                  <h3 className="text-sm font-semibold text-foreground">
                    Create or Update SMS Template
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Template variables are strictly verified against the selected trigger event.
                  </p>

                  {tplError && (
                    <div className="rounded border border-danger/30 bg-danger-soft p-2.5 text-xs text-danger">
                      {tplError}
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">
                      Template Name
                    </label>
                    <input
                      type="text"
                      required
                      value={tplName}
                      onChange={(e) => setTplName(e.target.value)}
                      placeholder="e.g. 48h Expiry Reminder"
                      className={inputClass}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Trigger Event
                      </label>
                      <select
                        value={tplEvent}
                        onChange={(e) => setTplEvent(e.target.value)}
                        className={inputClass}
                      >
                        {Object.keys(EVENT_SUPPORTED_VARIABLES).map((ev) => (
                          <option key={ev} value={ev}>
                            {ev}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Category
                      </label>
                      <select
                        value={tplCategory}
                        onChange={(e) =>
                          setTplCategory(e.target.value as SmsCategory)
                        }
                        className={inputClass}
                      >
                        <option value="TRANSACTIONAL">Transactional</option>
                        <option value="OPERATIONAL">Operational</option>
                        <option value="MARKETING">Marketing</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">
                      Template Body
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={tplBody}
                      onChange={(e) => setTplBody(e.target.value)}
                      placeholder="Enter template message body..."
                      className="w-full rounded-md border border-border bg-surface p-3 text-sm text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!permissions.canManageTemplates}
                    className={cn(btnClass("primary"), "w-full justify-center")}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Validate &amp; Save Template
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 4: CUSTOMER PHONE DIRECTORY & PREFERENCES (Sections 30-34)   */}
          {/* ================================================================ */}
          {activeTab === "DIRECTORY" && (
            <section className="rounded-lg border border-border bg-surface p-4 shadow-xs space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Customer Phone Directory &amp; Communication Preferences
                </h2>
                <p className="text-xs text-muted-foreground">
                  Normalized E.164 subscriber phone numbers. Critical transactional/service SMS remain enabled while customers can opt in or out of marketing SMS.
                </p>
              </div>

              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-surface-subtle text-[11px] uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5">Customer</th>
                      <th className="px-3 py-2.5">Normalized Phone</th>
                      <th className="px-3 py-2.5">Service &amp; Package</th>
                      <th className="px-3 py-2.5">POP / Router</th>
                      <th className="px-3 py-2.5">Transactional SMS</th>
                      <th className="px-3 py-2.5">Marketing SMS</th>
                      <th className="px-3 py-2.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recipients.map((r) => (
                      <tr
                        key={r.customerId}
                        className="hover:bg-surface-elevated"
                      >
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-foreground">
                            {r.customerName}
                          </div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {r.accountNumber} · <StatusBadge status={r.status} />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-mono">
                          <div className="font-semibold text-foreground">
                            {r.formattedPhone}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            E.164: {r.normalizedPhoneNumber || "Invalid"} (
                            {r.countryCode})
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-foreground">
                            {r.packageName}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {r.serviceType} · Expiry: {r.expiryDate}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div>{r.popName}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {r.routerName}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1 rounded bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
                            <CheckCircle2 className="h-3 w-3" /> Required Active
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleMarketingPref(
                                r.customerId,
                                r.marketingOptIn
                              )
                            }
                            className={cn(
                              "rounded border px-2 py-0.5 text-[11px] font-medium transition-colors",
                              r.marketingOptIn
                                ? "border-primary/30 bg-primary-soft text-primary"
                                : "border-border bg-surface-subtle text-muted-foreground"
                            )}
                          >
                            {r.marketingOptIn ? "Opted In" : "Opted Out"}
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              setRecipientMode("INDIVIDUAL");
                              setSelectedCustomerIds([r.customerId]);
                              setActiveTab("COMPOSE");
                            }}
                            className={cn(
                              btnClass("secondary"),
                              "h-7 px-2.5 text-xs"
                            )}
                          >
                            Message
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ================================================================ */}
          {/* TAB 5: SMS GATEWAY & PROVIDER CONFIGURATION (Sections 15-17)     */}
          {/* ================================================================ */}
          {activeTab === "PROVIDER" && (
            <form
              onSubmit={handleSaveProviderConfig}
              className="mx-auto max-w-2xl rounded-lg border border-border bg-surface p-5 shadow-xs space-y-4"
            >
              <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    SMS Provider &amp; Gateway Configuration
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    API credentials are encrypted and stored strictly server-side. They are never exposed to browser JavaScript or AI responses.
                  </p>
                </div>
                <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    SMS Gateway Provider
                  </label>
                  <select
                    value={cfgProvider}
                    onChange={(e) =>
                      setCfgProvider(e.target.value as SmsProviderType)
                    }
                    className={inputClass}
                  >
                    <option value="AFRICAS_TALKING">
                      Africa&apos;s Talking
                    </option>
                    <option value="TWILIO">Twilio Programmable SMS</option>
                    <option value="GENERIC_HTTP">
                      Compatible HTTP SMS Gateway
                    </option>
                    <option value="UNCONFIGURED">
                      Disabled / Unconfigured
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    Environment
                  </label>
                  <select
                    value={cfgEnvironment}
                    onChange={(e) =>
                      setCfgEnvironment(e.target.value as SmsEnvironmentType)
                    }
                    className={inputClass}
                  >
                    <option value="SANDBOX">Sandbox / Testing</option>
                    <option value="PRODUCTION">Production Carrier Network</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    Sender ID (Alphanumeric, max 11 chars)
                  </label>
                  <input
                    type="text"
                    maxLength={11}
                    value={cfgSenderId}
                    onChange={(e) => setCfgSenderId(e.target.value)}
                    placeholder="QCNetCore"
                    className={inputClass}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Subject to carrier &amp; CA regulatory registration.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    Rate per SMS Segment ({provider?.currency || "KES"})
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={cfgCostPerSegment}
                    onChange={(e) => setCfgCostPerSegment(e.target.value)}
                    className={inputClass}
                  />
                </div>

                {cfgProvider === "AFRICAS_TALKING" && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">
                      Africa&apos;s Talking Username
                    </label>
                    <input
                      type="text"
                      value={cfgUsername}
                      onChange={(e) => setCfgUsername(e.target.value)}
                      placeholder="sandbox or app username"
                      className={inputClass}
                    />
                  </div>
                )}

                {cfgProvider === "TWILIO" && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">
                      Twilio Account SID
                    </label>
                    <input
                      type="text"
                      value={cfgAccountSid}
                      onChange={(e) => setCfgAccountSid(e.target.value)}
                      placeholder="ACxxxxxxxxxxxxxxxx"
                      className={inputClass}
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    API Key (Server-Side Secret)
                  </label>
                  <input
                    type="password"
                    value={cfgApiKey}
                    onChange={(e) => setCfgApiKey(e.target.value)}
                    placeholder="Enter gateway API key"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    API Secret / Auth Token (Server-Side)
                  </label>
                  <input
                    type="password"
                    value={cfgApiSecret}
                    onChange={(e) => setCfgApiSecret(e.target.value)}
                    placeholder="Enter gateway secret"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="rounded-md border border-border bg-surface-subtle p-3 text-xs">
                <div className="font-semibold text-foreground">
                  Delivery Report Webhook Endpoint
                </div>
                <div className="mt-1 font-mono text-[11px] text-primary">
                  POST /api/v1/sms/webhook
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Configure your SMS provider to send delivery callbacks to this endpoint with header <code>x-sms-webhook-signature</code>.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  disabled={!permissions.canManageProvider}
                  className={btnClass("primary")}
                >
                  Save Gateway Configuration
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {/* ==================================================================== */}
      {/* SECTION 21: EXPLICIT BULK SEND CONFIRMATION MODAL                    */}
      {/* ==================================================================== */}
      {confirmModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-sms-confirm-title"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-[var(--shadow-pop)] space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-warning">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <h3
                  id="bulk-sms-confirm-title"
                  className="text-sm font-semibold text-foreground"
                >
                  Confirm Bulk SMS Transmission
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-surface-elevated"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-foreground">
              You are about to send this message to{" "}
              <strong>{composerAnalysis.recipientCount} customers</strong>.
            </p>

            <div className="rounded-md border border-border bg-surface-subtle p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recipients:</span>
                <strong className="font-mono text-foreground">
                  {composerAnalysis.recipientCount}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SMS segments:</span>
                <strong className="font-mono text-foreground">
                  {composerAnalysis.seg.segments}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Estimated SMS usage:
                </span>
                <strong className="font-mono text-foreground">
                  {composerAnalysis.estimatedUnits} units
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated cost:</span>
                <strong className="font-mono text-foreground">
                  {composerAnalysis.estimatedCost !== null && provider
                    ? `${provider.currency} ${composerAnalysis.estimatedCost.toLocaleString()}`
                    : "Provider pricing unavailable."}
                </strong>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="font-semibold text-foreground">
                Message Preview:
              </div>
              <div className="rounded border border-border bg-surface-subtle p-2.5 text-xs text-foreground">
                {composerAnalysis.personalized.resolvedMessage}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className={btnClass("secondary")}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDispatching}
                onClick={() => executeSend(true)}
                className={btnClass("primary")}
              >
                {isDispatching ? "Sending..." : "Confirm & Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
