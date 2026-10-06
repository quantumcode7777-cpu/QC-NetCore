// ============================================================================
// QC NETCORE — TENANT-AWARE SMS COMMUNICATIONS, PROVIDER ADAPTER & AUDIT ENGINE
// ============================================================================
// Architecture:
//   SMS Provider Interface -> Provider Adapter (Africa's Talking / Twilio / HTTP)
//   Dynamic Recipient Resolver (Customers / Packages / Billing / Network POPs)
//   Template & Personalization Safety Validator
//   Bulk Send Confirmation Gate, Idempotency & Rate Limiting
//   Delivery Webhook Processor & Immutable Audit Logger
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
  UserRole,
} from "../../types/index.ts";
import { hasPermission } from "../auth/rbac.ts";
import {
  SEED_ORGANIZATION,
  SEED_CUSTOMERS,
  SEED_PPPOE,
  SEED_SUBSCRIPTIONS,
  SEED_PLANS,
  SEED_ROUTERS,
  SEED_SITES,
  SEED_PAYMENTS,
} from "../db/mock-db.ts";
import { SEED_INVOICES_2027 } from "../db/os-2027-seed.ts";
import {
  validateAndNormalizePhone,
  formatPhoneForDisplay,
} from "./phone.ts";

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================

export type SmsProviderType =
  | "AFRICAS_TALKING"
  | "TWILIO"
  | "GENERIC_HTTP"
  | "UNCONFIGURED";

export type SmsEnvironmentType = "SANDBOX" | "PRODUCTION";

export type SmsDeliveryStatus =
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "FAILED"
  | "REJECTED"
  | "UNKNOWN";

export type SmsCategory = "TRANSACTIONAL" | "MARKETING" | "OPERATIONAL";

export type SmsMessageType =
  | "INDIVIDUAL"
  | "BULK_CAMPAIGN"
  | "SUBSCRIPTION_NOTIFICATION"
  | "PAYMENT_CONFIRMATION"
  | "PAYMENT_REMINDER"
  | "EXPIRY_REMINDER"
  | "SUSPENSION_NOTICE"
  | "RESTORATION_NOTICE"
  | "PACKAGE_UPGRADE"
  | "OUTAGE_ANNOUNCEMENT"
  | "MAINTENANCE_NOTICE"
  | "GENERAL_ANNOUNCEMENT"
  | "OTP_VERIFICATION";

export type SmsRecipientMode =
  | "INDIVIDUAL"
  | "SELECTED"
  | "CUSTOMER_GROUP"
  | "PACKAGE_SUBSCRIBERS"
  | "ACTIVE_SUBSCRIBERS"
  | "SUSPENDED_SUBSCRIBERS"
  | "EXPIRING_SUBSCRIBERS"
  | "OVERDUE_CUSTOMERS"
  | "RECENTLY_REGISTERED"
  | "NETWORK_POP_OR_ROUTER"
  | "ALL_ELIGIBLE";

export interface SmsTargetFilters {
  customerId?: string;
  customerIds?: string[];
  subscriptionStatus?: "ACTIVE" | "SUSPENDED" | "EXPIRED" | "PENDING" | "NEWLY_REGISTERED" | "ALL";
  planId?: string;
  packageName?: string;
  minSpeedMbps?: number;
  maxPrice?: number;
  billingStatus?: "PAID" | "UNPAID" | "OVERDUE" | "EXPIRING_SOON" | "ALL";
  expiringWithinDays?: number;
  siteId?: string;
  siteName?: string;
  routerId?: string;
  routerName?: string;
  serviceType?: "PPPOE" | "HOTSPOT" | "ALL";
  sessionState?: "ONLINE" | "OFFLINE" | "ALL";
  searchQuery?: string;
}

export interface SmsProviderServerConfig {
  organizationId: string;
  provider: SmsProviderType;
  senderId: string;
  username?: string;
  accountSid?: string;
  /** Server-side only — NEVER returned to client */
  apiKey?: string;
  /** Server-side only — NEVER returned to client */
  apiSecret?: string;
  /** Server-side only — NEVER returned to client */
  webhookSecret?: string;
  webhookUrl?: string;
  environment: SmsEnvironmentType;
  isEnabled: boolean;
  costPerSegment: number | null;
  currency: string;
  cachedBalance: number | null;
  cachedCredits: number | null;
  updatedAt: string;
}

export interface SmsProviderClientSummary {
  organizationId: string;
  provider: SmsProviderType;
  isConfigured: boolean;
  isEnabled: boolean;
  senderId: string;
  username?: string;
  accountSid?: string;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  hasWebhookSecret: boolean;
  webhookUrl?: string;
  environment: SmsEnvironmentType;
  costPerSegment: number | null;
  currency: string;
  cachedBalance: number | null;
  cachedCredits: number | null;
  statusMessage: string;
  pricingStatus: string;
  updatedAt: string;
}

export interface SmsTemplateRecord {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  category: SmsCategory;
  triggerEvent: string;
  bodyTemplate: string;
  requiredVariables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SmsMessageRecord {
  id: string;
  organizationId: string;
  campaignId?: string;
  campaignName?: string;
  customerId?: string;
  customerName?: string;
  accountNumber?: string;
  recipientPhone: string;
  normalizedPhone: string;
  messageType: SmsMessageType;
  category: SmsCategory;
  messageBody: string;
  characterCount: number;
  segmentCount: number;
  provider: SmsProviderType;
  senderId: string;
  providerMessageId: string;
  status: SmsDeliveryStatus;
  failureReason?: string;
  cost: number | null;
  currency: string;
  sentById?: string;
  sentByName?: string;
  sentAt: string;
  deliveredAt?: string;
  createdAt: string;
}

export interface SmsCampaignRecord {
  id: string;
  organizationId: string;
  campaignName: string;
  recipientMode: SmsRecipientMode;
  targetFilters: SmsTargetFilters;
  templateCode?: string;
  messageTemplate: string;
  category: SmsCategory;
  messageType: SmsMessageType;
  totalRecipients: number;
  validRecipients: number;
  skippedOptOut: number;
  skippedInvalid: number;
  estimatedSegments: number;
  estimatedCost: number | null;
  currency: string;
  status: "DRAFT" | "SCHEDULED" | "PROCESSING" | "COMPLETED" | "PARTIAL_FAILURE" | "FAILED";
  scheduledAt?: string;
  sentById?: string;
  sentByName?: string;
  idempotencyKey?: string;
  createdAt: string;
  completedAt?: string;
}

export interface SmsAuditLogRecord {
  id: string;
  organizationId: string;
  actorId?: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  campaignId?: string;
  messageId?: string;
  recipientCount: number;
  messageType: SmsMessageType;
  provider: SmsProviderType;
  providerReference?: string;
  deliveryState: SmsDeliveryStatus;
  failureReason?: string;
  segmentsUsed: number;
  createdAt: string;
}

export interface CustomerCommunicationPreferences {
  customerId: string;
  organizationId: string;
  transactionalSms: boolean; // Always true for critical operational/billing notices
  marketingSms: boolean; // Customer controllable opt-in/opt-out
  optedOutAt?: string;
  updatedAt: string;
}

export interface EnrichedSmsRecipient {
  customerId: string;
  accountNumber: string;
  customerName: string;
  rawPhoneNumber: string;
  normalizedPhoneNumber: string;
  formattedPhone: string;
  countryCode: string;
  phoneValid: boolean;
  email?: string;
  status: string;
  serviceType: "PPPOE" | "HOTSPOT";
  packageId?: string;
  packageName: string;
  speedMbps: number;
  packagePrice: number;
  siteId?: string;
  popName: string;
  routerId?: string;
  routerName: string;
  isOnline: boolean;
  balanceDue: number;
  expiryDate: string;
  daysToExpiry: number | null;
  invoiceNumber: string;
  lastPaymentReference: string;
  supportContact: string;
  paybillNumber: string;
  ispName: string;
  transactionalOptIn: boolean;
  marketingOptIn: boolean;
  registeredAt: string;
}

// ============================================================================
// 2. GSM-7 & UCS-2 SMS SEGMENTATION CALCULATOR (Section 18)
// ============================================================================

const GSM7_BASIC_CHARS =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXTENDED_CHARS = "^{}\\[~]|€";

export interface SmsSegmentationMetrics {
  characterCount: number;
  septetOrUnitLength: number;
  encoding: "GSM_7" | "UCS_2";
  segments: number;
  maxSingleSegment: number;
  maxConcatSegment: number;
  charsRemainingInCurrentSegment: number;
}

export function calculateSmsSegments(text: string): SmsSegmentationMetrics {
  if (!text || text.length === 0) {
    return {
      characterCount: 0,
      septetOrUnitLength: 0,
      encoding: "GSM_7",
      segments: 0,
      maxSingleSegment: 160,
      maxConcatSegment: 153,
      charsRemainingInCurrentSegment: 160,
    };
  }

  let isGsm7 = true;
  let septetLength = 0;

  for (const ch of text) {
    if (GSM7_BASIC_CHARS.includes(ch)) {
      septetLength += 1;
    } else if (GSM7_EXTENDED_CHARS.includes(ch)) {
      septetLength += 2;
    } else {
      isGsm7 = false;
      break;
    }
  }

  if (isGsm7) {
    const segments =
      septetLength <= 160 ? 1 : Math.ceil(septetLength / 153);
    const maxCurrent = segments === 1 ? 160 : segments * 153;
    return {
      characterCount: text.length,
      septetOrUnitLength: septetLength,
      encoding: "GSM_7",
      segments,
      maxSingleSegment: 160,
      maxConcatSegment: 153,
      charsRemainingInCurrentSegment: Math.max(0, maxCurrent - septetLength),
    };
  }

  const ucs2Len = text.length;
  const segments = ucs2Len <= 70 ? 1 : Math.ceil(ucs2Len / 67);
  const maxCurrent = segments === 1 ? 70 : segments * 67;
  return {
    characterCount: ucs2Len,
    septetOrUnitLength: ucs2Len,
    encoding: "UCS_2",
    segments,
    maxSingleSegment: 70,
    maxConcatSegment: 67,
    charsRemainingInCurrentSegment: Math.max(0, maxCurrent - ucs2Len),
  };
}

// ============================================================================
// 3. APPROVED PERSONALIZATION VARIABLES & TEMPLATE SAFETY (Sections 19, 23, 24)
// ============================================================================

export const APPROVED_SMS_VARIABLES = [
  "customer_name",
  "account_number",
  "package_name",
  "service_type",
  "expiry_date",
  "amount_due",
  "invoice_number",
  "payment_reference",
  "pop_name",
  "router_name",
  "support_contact",
  "paybill_number",
  "isp_name",
] as const;

export type ApprovedSmsVariable = (typeof APPROVED_SMS_VARIABLES)[number];

/**
 * Defines which variables are guaranteed to be available for each automated event type.
 * Used by `validateTemplateVariables` to reject templates that reference variables
 * not provided by the selected trigger event (Rule 24).
 */
export const EVENT_SUPPORTED_VARIABLES: Record<string, ApprovedSmsVariable[]> = {
  "payment.received": [
    "customer_name",
    "account_number",
    "package_name",
    "service_type",
    "expiry_date",
    "amount_due",
    "invoice_number",
    "payment_reference",
    "support_contact",
    "paybill_number",
    "isp_name",
  ],
  "payment.reminder": [
    "customer_name",
    "account_number",
    "package_name",
    "service_type",
    "expiry_date",
    "amount_due",
    "invoice_number",
    "support_contact",
    "paybill_number",
    "isp_name",
  ],
  "subscription.expiry": [
    "customer_name",
    "account_number",
    "package_name",
    "service_type",
    "expiry_date",
    "amount_due",
    "support_contact",
    "paybill_number",
    "isp_name",
  ],
  "service.suspended": [
    "customer_name",
    "account_number",
    "package_name",
    "service_type",
    "amount_due",
    "invoice_number",
    "support_contact",
    "paybill_number",
    "isp_name",
  ],
  "service.restored": [
    "customer_name",
    "account_number",
    "package_name",
    "service_type",
    "expiry_date",
    "support_contact",
    "isp_name",
  ],
  "package.upgrade": [
    "customer_name",
    "account_number",
    "package_name",
    "service_type",
    "support_contact",
    "isp_name",
  ],
  "network.maintenance": [
    "customer_name",
    "account_number",
    "package_name",
    "pop_name",
    "router_name",
    "support_contact",
    "isp_name",
  ],
  "network.outage": [
    "customer_name",
    "account_number",
    "package_name",
    "pop_name",
    "router_name",
    "support_contact",
    "isp_name",
  ],
  "account.welcome": [
    "customer_name",
    "account_number",
    "package_name",
    "service_type",
    "support_contact",
    "paybill_number",
    "isp_name",
  ],
  "manual.campaign": [...APPROVED_SMS_VARIABLES],
};

export function extractTemplateVariables(templateBody: string): string[] {
  const found = new Set<string>();
  const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(templateBody)) !== null) {
    found.add(match[1]);
  }
  return Array.from(found);
}

export interface TemplateValidationResult {
  valid: boolean;
  variablesUsed: string[];
  unknownVariables: string[];
  unsupportedByEvent: string[];
  error?: string;
}

/**
 * Validates that a template only uses approved variables and that the selected
 * trigger event supplies all referenced variables (Section 24).
 */
export function validateTemplateVariables(
  bodyTemplate: string,
  triggerEvent = "manual.campaign"
): TemplateValidationResult {
  if (!bodyTemplate || !bodyTemplate.trim()) {
    return {
      valid: false,
      variablesUsed: [],
      unknownVariables: [],
      unsupportedByEvent: [],
      error: "Message template cannot be empty.",
    };
  }

  // Check for unclosed {{ or }}
  const openBraces = (bodyTemplate.match(/\{\{/g) || []).length;
  const closeBraces = (bodyTemplate.match(/\}\}/g) || []).length;
  if (openBraces !== closeBraces) {
    return {
      valid: false,
      variablesUsed: [],
      unknownVariables: [],
      unsupportedByEvent: [],
      error: "Template contains mismatched '{{' or '}}' variable brackets.",
    };
  }

  const variablesUsed = extractTemplateVariables(bodyTemplate);
  const approvedSet = new Set<string>(APPROVED_SMS_VARIABLES);
  const unknownVariables = variablesUsed.filter((v) => !approvedSet.has(v));

  if (unknownVariables.length > 0) {
    return {
      valid: false,
      variablesUsed,
      unknownVariables,
      unsupportedByEvent: [],
      error: `Unsupported variable(s): ${unknownVariables
        .map((v) => `{{${v}}}`)
        .join(", ")}. Allowed variables: ${APPROVED_SMS_VARIABLES.map(
        (v) => `{{${v}}}`
      ).join(", ")}.`,
    };
  }

  const supportedForEvent =
    EVENT_SUPPORTED_VARIABLES[triggerEvent] ?? APPROVED_SMS_VARIABLES;
  const supportedSet = new Set<string>(supportedForEvent);
  const unsupportedByEvent = variablesUsed.filter((v) => !supportedSet.has(v));

  if (unsupportedByEvent.length > 0) {
    return {
      valid: false,
      variablesUsed,
      unknownVariables: [],
      unsupportedByEvent,
      error: `Event "${triggerEvent}" does not provide ${unsupportedByEvent
        .map((v) => `{{${v}}}`)
        .join(", ")}. Remove or change the variable before saving.`,
    };
  }

  return {
    valid: true,
    variablesUsed,
    unknownVariables: [],
    unsupportedByEvent: [],
  };
}

/**
 * Safely resolves `{{variable}}` placeholders from a real customer record.
 * If any required variable is missing or empty, prevents sending rather than
 * transmitting raw `{{variable}}` text (Section 19).
 */
export function resolvePersonalizedMessage(
  templateBody: string,
  recipient: EnrichedSmsRecipient,
  extraVariables?: Record<string, string | number | undefined>
): {
  ok: boolean;
  resolvedMessage: string;
  missingVariables: string[];
  error?: string;
} {
  const tplCheck = validateTemplateVariables(templateBody, "manual.campaign");
  if (!tplCheck.valid) {
    return {
      ok: false,
      resolvedMessage: "",
      missingVariables: tplCheck.unknownVariables,
      error: tplCheck.error,
    };
  }

  const variableMap: Record<string, string> = {
    customer_name: recipient.customerName,
    account_number: recipient.accountNumber,
    package_name: recipient.packageName,
    service_type: recipient.serviceType,
    expiry_date: recipient.expiryDate,
    amount_due:
      recipient.balanceDue > 0
        ? `KES ${recipient.balanceDue.toLocaleString()}`
        : `KES ${recipient.packagePrice.toLocaleString()}`,
    invoice_number: recipient.invoiceNumber,
    payment_reference: recipient.lastPaymentReference,
    pop_name: recipient.popName,
    router_name: recipient.routerName,
    support_contact: recipient.supportContact,
    paybill_number: recipient.paybillNumber,
    isp_name: recipient.ispName,
  };

  if (extraVariables) {
    for (const [k, v] of Object.entries(extraVariables)) {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        variableMap[k] = String(v).trim();
      }
    }
  }

  const missingVariables: string[] = [];
  for (const varName of tplCheck.variablesUsed) {
    const val = variableMap[varName];
    if (!val || val === "—" || val.trim() === "") {
      missingVariables.push(varName);
    }
  }

  if (missingVariables.length > 0) {
    return {
      ok: false,
      resolvedMessage: "",
      missingVariables,
      error: `Cannot send message to ${recipient.customerName}: required variable(s) ${missingVariables
        .map((v) => `{{${v}}}`)
        .join(", ")} are unavailable on this customer record.`,
    };
  }

  const resolvedMessage = templateBody.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_, key: string) => variableMap[key] ?? ""
  );

  // Final guard: ensure no raw {{...}} remains
  if (/\{\{|\}\}/.test(resolvedMessage)) {
    return {
      ok: false,
      resolvedMessage: "",
      missingVariables: ["unresolved_placeholder"],
      error: "Unresolved template placeholder detected.",
    };
  }

  return {
    ok: true,
    resolvedMessage,
    missingVariables: [],
  };
}

// ============================================================================
// 4. DEFAULT SMS TEMPLATES (Section 23)
// ============================================================================

export const DEFAULT_SMS_TEMPLATES: SmsTemplateRecord[] = [
  {
    id: "smstpl-payment-received",
    organizationId: SEED_ORGANIZATION.id,
    code: "PAYMENT_RECEIVED",
    name: "Payment Received",
    category: "TRANSACTIONAL",
    triggerEvent: "payment.received",
    bodyTemplate:
      "Payment confirmed for {{customer_name}} (Acc: {{account_number}}). Amount: {{amount_due}} | Ref: {{payment_reference}} | Package: {{package_name}} | Expiry: {{expiry_date}}. Support: {{support_contact}}",
    requiredVariables: [
      "customer_name",
      "account_number",
      "amount_due",
      "payment_reference",
      "package_name",
      "expiry_date",
      "support_contact",
    ],
    isActive: true,
    createdAt: "2025-01-10T08:00:00Z",
    updatedAt: "2025-01-10T08:00:00Z",
  },
  {
    id: "smstpl-payment-reminder",
    organizationId: SEED_ORGANIZATION.id,
    code: "PAYMENT_REMINDER",
    name: "Payment Reminder",
    category: "TRANSACTIONAL",
    triggerEvent: "payment.reminder",
    bodyTemplate:
      "Hello {{customer_name}}, your {{isp_name}} account ({{account_number}}) has an outstanding balance of {{amount_due}}. Please pay via M-Pesa Paybill {{paybill_number}} Account {{account_number}} to avoid service interruption.",
    requiredVariables: [
      "customer_name",
      "isp_name",
      "account_number",
      "amount_due",
      "paybill_number",
    ],
    isActive: true,
    createdAt: "2025-01-10T08:00:00Z",
    updatedAt: "2025-01-10T08:00:00Z",
  },
  {
    id: "smstpl-subscription-expiry",
    organizationId: SEED_ORGANIZATION.id,
    code: "SUBSCRIPTION_EXPIRY",
    name: "Subscription Expiry",
    category: "TRANSACTIONAL",
    triggerEvent: "subscription.expiry",
    bodyTemplate:
      "Hello {{customer_name}}, your {{package_name}} subscription ({{account_number}}) expires on {{expiry_date}}. Please renew ({{amount_due}}) via Paybill {{paybill_number}} to continue uninterrupted internet service.",
    requiredVariables: [
      "customer_name",
      "package_name",
      "account_number",
      "expiry_date",
      "amount_due",
      "paybill_number",
    ],
    isActive: true,
    createdAt: "2025-01-10T08:00:00Z",
    updatedAt: "2025-01-10T08:00:00Z",
  },
  {
    id: "smstpl-service-suspended",
    organizationId: SEED_ORGANIZATION.id,
    code: "SERVICE_SUSPENDED",
    name: "Service Suspended",
    category: "TRANSACTIONAL",
    triggerEvent: "service.suspended",
    bodyTemplate:
      "Notice: Dear {{customer_name}}, your {{package_name}} service (Acc: {{account_number}}) has been suspended due to an overdue balance of {{amount_due}}. Pay via Paybill {{paybill_number}} for automatic reconnection.",
    requiredVariables: [
      "customer_name",
      "package_name",
      "account_number",
      "amount_due",
      "paybill_number",
    ],
    isActive: true,
    createdAt: "2025-01-10T08:00:00Z",
    updatedAt: "2025-01-10T08:00:00Z",
  },
  {
    id: "smstpl-service-restored",
    organizationId: SEED_ORGANIZATION.id,
    code: "SERVICE_RESTORED",
    name: "Service Restored",
    category: "TRANSACTIONAL",
    triggerEvent: "service.restored",
    bodyTemplate:
      "Good news {{customer_name}}! Your {{package_name}} internet connection (Acc: {{account_number}}) has been restored and is active until {{expiry_date}}. Thank you for choosing {{isp_name}}.",
    requiredVariables: [
      "customer_name",
      "package_name",
      "account_number",
      "expiry_date",
      "isp_name",
    ],
    isActive: true,
    createdAt: "2025-01-10T08:00:00Z",
    updatedAt: "2025-01-10T08:00:00Z",
  },
  {
    id: "smstpl-package-upgrade",
    organizationId: SEED_ORGANIZATION.id,
    code: "PACKAGE_UPGRADE",
    name: "Package Upgrade",
    category: "MARKETING",
    triggerEvent: "package.upgrade",
    bodyTemplate:
      "Hello {{customer_name}}, upgrade your current {{package_name}} connection to double your fiber speed this month! Contact {{isp_name}} support on {{support_contact}} to upgrade.",
    requiredVariables: [
      "customer_name",
      "package_name",
      "isp_name",
      "support_contact",
    ],
    isActive: true,
    createdAt: "2025-01-10T08:00:00Z",
    updatedAt: "2025-01-10T08:00:00Z",
  },
  {
    id: "smstpl-network-maintenance",
    organizationId: SEED_ORGANIZATION.id,
    code: "NETWORK_MAINTENANCE",
    name: "Network Maintenance",
    category: "OPERATIONAL",
    triggerEvent: "network.maintenance",
    bodyTemplate:
      "Scheduled Maintenance: Dear {{customer_name}}, {{isp_name}} engineers will perform planned maintenance at {{pop_name}} ({{router_name}}). Brief interruption may occur. Support: {{support_contact}}",
    requiredVariables: [
      "customer_name",
      "isp_name",
      "pop_name",
      "router_name",
      "support_contact",
    ],
    isActive: true,
    createdAt: "2025-01-10T08:00:00Z",
    updatedAt: "2025-01-10T08:00:00Z",
  },
  {
    id: "smstpl-network-outage",
    organizationId: SEED_ORGANIZATION.id,
    code: "NETWORK_OUTAGE",
    name: "Network Outage",
    category: "OPERATIONAL",
    triggerEvent: "network.outage",
    bodyTemplate:
      "Outage Alert: Hello {{customer_name}}, our NOC team is resolving a fiber/power issue affecting {{pop_name}}. Services will resume shortly. Apologies for the inconvenience. {{isp_name}} ({{support_contact}})",
    requiredVariables: [
      "customer_name",
      "pop_name",
      "isp_name",
      "support_contact",
    ],
    isActive: true,
    createdAt: "2025-01-10T08:00:00Z",
    updatedAt: "2025-01-10T08:00:00Z",
  },
  {
    id: "smstpl-welcome",
    organizationId: SEED_ORGANIZATION.id,
    code: "WELCOME",
    name: "Welcome",
    category: "TRANSACTIONAL",
    triggerEvent: "account.welcome",
    bodyTemplate:
      "Welcome to {{isp_name}}, {{customer_name}}! Your {{package_name}} ({{service_type}}) account number is {{account_number}}. M-Pesa Paybill: {{paybill_number}}. Support: {{support_contact}}.",
    requiredVariables: [
      "isp_name",
      "customer_name",
      "package_name",
      "service_type",
      "account_number",
      "paybill_number",
      "support_contact",
    ],
    isActive: true,
    createdAt: "2025-01-10T08:00:00Z",
    updatedAt: "2025-01-10T08:00:00Z",
  },
];

// ============================================================================
// 5. TENANT-ISOLATED RUNTIME STATE STORE (SERVER-SIDE)
// ============================================================================

interface TenantSmsState {
  providerConfig: SmsProviderServerConfig;
  templates: SmsTemplateRecord[];
  campaigns: SmsCampaignRecord[];
  messages: SmsMessageRecord[];
  auditLogs: SmsAuditLogRecord[];
  preferences: Map<string, CustomerCommunicationPreferences>; // customerId -> prefs
  processedWebhookEventIds: Set<string>;
  campaignIdempotencyKeys: Map<string, SmsCampaignRecord>;
  userPhones: Map<
    string,
    {
      phoneNumber: string;
      normalizedPhoneNumber: string;
      countryCode: string;
      verified: boolean;
      verifiedAt?: string;
    }
  >;
  pendingOtps: Map<
    string,
    {
      normalizedPhone: string;
      otpCode: string;
      expiresAt: number;
      attempts: number;
    }
  >;
}

const TENANT_SMS_STORE = new Map<string, TenantSmsState>();

function detectEnvSmsProvider(orgId: string, isDemoMode = false): SmsProviderServerConfig {
  if (isDemoMode) {
    const atApiKey = process.env.AFRICASTALKING_API_KEY;
    const atUsername = process.env.AFRICASTALKING_USERNAME;

    if (atApiKey && atUsername) {
      return {
        organizationId: orgId,
        provider: "AFRICAS_TALKING",
        senderId: process.env.AFRICASTALKING_SENDER_ID || "QCNetCore",
        username: atUsername,
        apiKey: atApiKey,
        environment: atUsername === "sandbox" ? "SANDBOX" : "PRODUCTION",
        isEnabled: true,
        costPerSegment: 0.8,
        currency: "KES",
        cachedBalance: 4200,
        cachedCredits: 5250,
        webhookUrl: "/api/v1/sms/webhook",
        updatedAt: new Date().toISOString(),
      };
    }

    // In Demo Mode, provide a pre-configured Africa's Talking sandbox adapter so
    // operators exploring the live demo can test individual & bulk SMS workflows,
    // while also allowing them to toggle provider configuration state.
    return {
      organizationId: orgId,
      provider: "AFRICAS_TALKING",
      senderId: "QCNetCore",
      username: "sandbox_qcnetcore",
      apiKey: "at_sandbox_demo_key_server_only_99281",
      webhookSecret: "whsec_demo_99182",
      webhookUrl: "/api/v1/sms/webhook",
      environment: "SANDBOX",
      isEnabled: true,
      costPerSegment: 0.8,
      currency: "KES",
      cachedBalance: 3840,
      cachedCredits: 4800,
      updatedAt: new Date().toISOString(),
    };
  }

  // Real tenant without SMS gateway credentials configured yet
  return {
    organizationId: orgId,
    provider: "UNCONFIGURED",
    senderId: "—",
    environment: "PRODUCTION",
    isEnabled: false,
    costPerSegment: null,
    currency: "KES",
    cachedBalance: null,
    cachedCredits: null,
    webhookUrl: "/api/v1/sms/webhook",
    updatedAt: new Date().toISOString(),
  };
}

function buildInitialDemoMessages(orgId: string): SmsMessageRecord[] {
  const now = Date.now();
  const oneHourAgo = new Date(now - 3600 * 1000).toISOString();
  const threeHoursAgo = new Date(now - 3 * 3600 * 1000).toISOString();
  const twoDaysAgo = new Date(now - 2 * 86400 * 1000).toISOString();
  const fiveDaysAgo = new Date(now - 5 * 86400 * 1000).toISOString();

  return [
    {
      id: "sms-msg-01",
      organizationId: orgId,
      customerId: "cust-01",
      customerName: "John Kamau Mwangi",
      accountNumber: "GT-8921",
      recipientPhone: "254712345601",
      normalizedPhone: "+254712345601",
      messageType: "PAYMENT_CONFIRMATION",
      category: "TRANSACTIONAL",
      messageBody:
        "Payment confirmed for John Kamau Mwangi (Acc: GT-8921). Amount: KES 2,500 | Ref: RKF9283KDJ | Package: Silver Fiber - 10 Mbps | Expiry: 25 Mar 2025. Support: +254712345678",
      characterCount: 169,
      segmentCount: 2,
      provider: "AFRICAS_TALKING",
      senderId: "QCNetCore",
      providerMessageId: "ATXid_89210041",
      status: "DELIVERED",
      cost: 1.6,
      currency: "KES",
      sentByName: "Billing Automation",
      sentAt: threeHoursAgo,
      deliveredAt: threeHoursAgo,
      createdAt: threeHoursAgo,
    },
    {
      id: "sms-msg-02",
      organizationId: orgId,
      customerId: "cust-02",
      customerName: "Grace Wanjiku",
      accountNumber: "GT-8922",
      recipientPhone: "254722987654",
      normalizedPhone: "+254722987654",
      messageType: "EXPIRY_REMINDER",
      category: "TRANSACTIONAL",
      messageBody:
        "Hello Grace Wanjiku, your Gold Fiber - 25 Mbps subscription (GT-8922) expires on 26 Feb 2025. Please renew (KES 4,500) via Paybill 4084200 to continue uninterrupted internet service.",
      characterCount: 183,
      segmentCount: 2,
      provider: "AFRICAS_TALKING",
      senderId: "QCNetCore",
      providerMessageId: "ATXid_89210042",
      status: "DELIVERED",
      cost: 1.6,
      currency: "KES",
      sentByName: "Billing Automation",
      sentAt: oneHourAgo,
      deliveredAt: oneHourAgo,
      createdAt: oneHourAgo,
    },
    {
      id: "sms-msg-03",
      organizationId: orgId,
      customerId: "cust-03",
      customerName: "David Kipchumba Koech",
      accountNumber: "GT-8923",
      recipientPhone: "254733456789",
      normalizedPhone: "+254733456789",
      messageType: "PAYMENT_REMINDER",
      category: "TRANSACTIONAL",
      messageBody:
        "Hello David Kipchumba Koech, your QC NetCore account (GT-8923) has an outstanding balance of KES 2,500. Please pay via M-Pesa Paybill 4084200 Account GT-8923 to avoid service interruption.",
      characterCount: 188,
      segmentCount: 2,
      provider: "AFRICAS_TALKING",
      senderId: "QCNetCore",
      providerMessageId: "ATXid_89210043",
      status: "DELIVERED",
      cost: 1.6,
      currency: "KES",
      sentByName: "Finance Desk",
      sentAt: twoDaysAgo,
      deliveredAt: twoDaysAgo,
      createdAt: twoDaysAgo,
    },
    {
      id: "sms-msg-04",
      organizationId: orgId,
      customerId: "cust-03",
      customerName: "David Kipchumba Koech",
      accountNumber: "GT-8923",
      recipientPhone: "254733456789",
      normalizedPhone: "+254733456789",
      messageType: "SUSPENSION_NOTICE",
      category: "TRANSACTIONAL",
      messageBody:
        "Notice: Dear David Kipchumba Koech, your Silver Fiber - 10 Mbps service (Acc: GT-8923) has been suspended due to an overdue balance of KES 2,500. Pay via Paybill 4084200 for automatic reconnection.",
      characterCount: 198,
      segmentCount: 2,
      provider: "AFRICAS_TALKING",
      senderId: "QCNetCore",
      providerMessageId: "ATXid_89210044",
      status: "SENT",
      cost: 1.6,
      currency: "KES",
      sentByName: "Billing Automation",
      sentAt: twoDaysAgo,
      createdAt: twoDaysAgo,
    },
    {
      id: "sms-msg-05",
      organizationId: orgId,
      customerId: "cust-05",
      customerName: "Ahmed Hassan Omar",
      accountNumber: "GT-8925",
      recipientPhone: "254711223344",
      normalizedPhone: "+254711223344",
      messageType: "OUTAGE_ANNOUNCEMENT",
      category: "OPERATIONAL",
      messageBody:
        "Outage Alert: Hello Ahmed Hassan Omar, our NOC team is resolving a fiber/power issue affecting Eastleigh Sector B. Services will resume shortly. Apologies for the inconvenience. QC NetCore (+254712345678)",
      characterCount: 205,
      segmentCount: 2,
      provider: "AFRICAS_TALKING",
      senderId: "QCNetCore",
      providerMessageId: "ATXid_89210045",
      status: "FAILED",
      failureReason: "Carrier handset unreachable / temporary radio timeout",
      cost: 0,
      currency: "KES",
      sentByName: "NOC Engineer",
      sentAt: fiveDaysAgo,
      createdAt: fiveDaysAgo,
    },
  ];
}

export function getOrCreateTenantSmsState(
  organizationId: string,
  isDemoMode = false
): TenantSmsState {
  const existing = TENANT_SMS_STORE.get(organizationId);
  if (existing) {
    if (
      !isDemoMode &&
      organizationId !== SEED_ORGANIZATION.id &&
      existing.providerConfig.cachedCredits === 5250 &&
      existing.providerConfig.cachedBalance === 4200
    ) {
      existing.providerConfig = detectEnvSmsProvider(organizationId, false);
    }
    return existing;
  }

  const initialMessages =
    organizationId === SEED_ORGANIZATION.id
      ? buildInitialDemoMessages(organizationId)
      : [];

  const initialTemplates = DEFAULT_SMS_TEMPLATES.map((t) => ({
    ...t,
    organizationId,
  }));

  const prefs = new Map<string, CustomerCommunicationPreferences>();
  if (organizationId === SEED_ORGANIZATION.id) {
    for (const c of SEED_CUSTOMERS) {
      prefs.set(c.id, {
        customerId: c.id,
        organizationId,
        transactionalSms: true,
        // Keep cust-06 opted out of marketing SMS in seed data to demonstrate marketing opt-out safety
        marketingSms: c.id !== "cust-06",
        optedOutAt: c.id === "cust-06" ? "2025-02-01T10:00:00Z" : undefined,
        updatedAt: c.createdAt,
      });
    }
  }

  const state: TenantSmsState = {
    providerConfig: detectEnvSmsProvider(
      organizationId,
      isDemoMode || organizationId === SEED_ORGANIZATION.id
    ),
    templates: initialTemplates,
    campaigns: [],
    messages: initialMessages,
    auditLogs: initialMessages.map((m) => ({
      id: `sms-aud-${m.id}`,
      organizationId,
      actorName: m.sentByName || "System",
      actorRole: "isp_owner",
      action: `sms.dispatch.${m.messageType.toLowerCase()}`,
      messageId: m.id,
      recipientCount: 1,
      messageType: m.messageType,
      provider: m.provider,
      providerReference: m.providerMessageId,
      deliveryState: m.status,
      failureReason: m.failureReason,
      segmentsUsed: m.segmentCount,
      createdAt: m.createdAt,
    })),
    preferences: prefs,
    processedWebhookEventIds: new Set<string>(),
    campaignIdempotencyKeys: new Map<string, SmsCampaignRecord>(),
    userPhones: new Map(),
    pendingOtps: new Map(),
  };

  TENANT_SMS_STORE.set(organizationId, state);
  return state;
}

// ============================================================================
// 6. PROVIDER CONFIG SANITIZATION & MANAGEMENT (Sections 15, 16, 17, 44)
// ============================================================================

export function isProviderConfigured(config: SmsProviderServerConfig): boolean {
  if (!config.isEnabled || config.provider === "UNCONFIGURED") {
    return false;
  }
  if (config.provider === "AFRICAS_TALKING") {
    return Boolean(config.username && config.apiKey);
  }
  if (config.provider === "TWILIO") {
    return Boolean(config.accountSid && config.apiSecret);
  }
  if (config.provider === "GENERIC_HTTP") {
    return Boolean(config.apiKey);
  }
  return false;
}

/**
 * Strips all secret keys before returning provider status to browser clients or AI Copilot.
 */
export function sanitizeProviderConfigForClient(
  config: SmsProviderServerConfig
): SmsProviderClientSummary {
  const configured = isProviderConfigured(config);
  const statusMessage = configured
    ? `${config.provider.replace(/_/g, " ")} (${config.environment}) active — Sender ID: ${config.senderId}`
    : "SMS provider not configured.";
  const pricingStatus =
    configured && config.costPerSegment !== null
      ? `${config.currency} ${config.costPerSegment.toFixed(2)} per SMS segment`
      : "Provider pricing unavailable.";

  return {
    organizationId: config.organizationId,
    provider: config.provider,
    isConfigured: configured,
    isEnabled: config.isEnabled,
    senderId: config.senderId,
    username: config.username,
    accountSid: config.accountSid,
    hasApiKey: Boolean(config.apiKey),
    hasApiSecret: Boolean(config.apiSecret),
    hasWebhookSecret: Boolean(config.webhookSecret),
    webhookUrl: config.webhookUrl || "/api/v1/sms/webhook",
    environment: config.environment,
    costPerSegment: configured ? config.costPerSegment : null,
    currency: config.currency,
    cachedBalance: configured ? config.cachedBalance : null,
    cachedCredits: configured ? config.cachedCredits : null,
    statusMessage,
    pricingStatus,
    updatedAt: config.updatedAt,
  };
}

export function updateTenantSmsProviderConfig(params: {
  organizationId: string;
  actorRole: UserRole;
  actorName: string;
  provider: SmsProviderType;
  senderId?: string;
  username?: string;
  accountSid?: string;
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string;
  webhookUrl?: string;
  environment?: SmsEnvironmentType;
  isEnabled?: boolean;
  costPerSegment?: number | null;
}): {
  ok: boolean;
  config?: SmsProviderClientSummary;
  error?: string;
} {
  if (!hasPermission(params.actorRole, "sms.manage_provider")) {
    return {
      ok: false,
      error: "You don't have permission to manage SMS provider settings (requires sms.manage_provider).",
    };
  }

  const state = getOrCreateTenantSmsState(params.organizationId);
  const prev = state.providerConfig;

  const senderClean = (params.senderId ?? prev.senderId ?? "QCNetCore")
    .trim()
    .slice(0, 11);
  if (!senderClean || !/^[a-zA-Z0-9\s_-]{2,11}$/.test(senderClean)) {
    return {
      ok: false,
      error: "Sender ID must be 2–11 alphanumeric characters (e.g. QCNetCore or MyISP).",
    };
  }

  const nextConfig: SmsProviderServerConfig = {
    ...prev,
    provider: params.provider,
    senderId: senderClean,
    username:
      params.username !== undefined ? params.username.trim() : prev.username,
    accountSid:
      params.accountSid !== undefined
        ? params.accountSid.trim()
        : prev.accountSid,
    apiKey:
      params.apiKey && params.apiKey !== "••••••••"
        ? params.apiKey.trim()
        : prev.apiKey,
    apiSecret:
      params.apiSecret && params.apiSecret !== "••••••••"
        ? params.apiSecret.trim()
        : prev.apiSecret,
    webhookSecret:
      params.webhookSecret && params.webhookSecret !== "••••••••"
        ? params.webhookSecret.trim()
        : prev.webhookSecret,
    webhookUrl: params.webhookUrl?.trim() || prev.webhookUrl || "/api/v1/sms/webhook",
    environment: params.environment || prev.environment,
    isEnabled:
      params.isEnabled !== undefined
        ? params.isEnabled
        : params.provider !== "UNCONFIGURED",
    costPerSegment:
      params.costPerSegment !== undefined
        ? params.costPerSegment
        : prev.costPerSegment ?? 0.8,
    cachedBalance:
      params.provider === "UNCONFIGURED"
        ? null
        : prev.cachedBalance ??
          (params.organizationId === SEED_ORGANIZATION.id ? 3840 : null),
    cachedCredits:
      params.provider === "UNCONFIGURED"
        ? null
        : prev.cachedCredits ??
          (params.organizationId === SEED_ORGANIZATION.id ? 4800 : null),
    updatedAt: new Date().toISOString(),
  };

  state.providerConfig = nextConfig;

  state.auditLogs.unshift({
    id: `sms-aud-${Date.now()}`,
    organizationId: params.organizationId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    action: "sms.provider.configure",
    recipientCount: 0,
    messageType: "GENERAL_ANNOUNCEMENT",
    provider: nextConfig.provider,
    deliveryState: "UNKNOWN",
    segmentsUsed: 0,
    createdAt: nextConfig.updatedAt,
  });

  return {
    ok: true,
    config: sanitizeProviderConfigForClient(nextConfig),
  };
}

// ============================================================================
// 7. ENRICHED CUSTOMER RECIPIENT RESOLVER & TARGETING ENGINE (Sections 5,6,7,8,37,38)
// ============================================================================

export interface SmsTenantOperationalData {
  organization: Organization;
  customers: Customer[];
  pppoeAccounts: PppoeAccount[];
  subscriptions: Subscription[];
  plans: ServicePlan[];
  routers: Router[];
  sites: Site[];
  payments: Payment[];
  invoices?: Array<{
    id: string;
    organizationId: string;
    customerId: string;
    invoiceNumber: string;
    balanceDue: number;
    status: string;
  }>;
}

export function getDefaultSmsOperationalData(): SmsTenantOperationalData {
  return {
    organization: SEED_ORGANIZATION,
    customers: SEED_CUSTOMERS,
    pppoeAccounts: SEED_PPPOE,
    subscriptions: SEED_SUBSCRIPTIONS,
    plans: SEED_PLANS,
    routers: SEED_ROUTERS,
    sites: SEED_SITES,
    payments: SEED_PAYMENTS,
    invoices: SEED_INVOICES_2027,
  };
}

export function buildEnrichedSmsRecipients(
  organizationId: string,
  data: SmsTenantOperationalData = getDefaultSmsOperationalData()
): EnrichedSmsRecipient[] {
  const state = getOrCreateTenantSmsState(organizationId);
  const nowMs = Date.now();

  const tenantCustomers = data.customers.filter(
    (c) => c.organizationId === organizationId
  );

  return tenantCustomers.map((c) => {
    const phoneCheck = validateAndNormalizePhone(c.phoneNumber);
    const sub = data.subscriptions.find(
      (s) => s.organizationId === organizationId && s.customerId === c.id
    );
    const pppoe = data.pppoeAccounts.find(
      (p) => p.organizationId === organizationId && p.customerId === c.id
    );
    const plan = data.plans.find(
      (pl) =>
        pl.organizationId === organizationId &&
        (pl.id === sub?.planId || pl.id === pppoe?.servicePlanId)
    );
    const site = data.sites.find(
      (st) => st.organizationId === organizationId && st.id === c.siteId
    );
    const router = data.routers.find(
      (r) =>
        r.organizationId === organizationId &&
        (r.id === pppoe?.routerId || (c.siteId && r.siteId === c.siteId))
    );
    const customerPayments = data.payments
      .filter(
        (p) =>
          p.organizationId === organizationId &&
          p.customerId === c.id &&
          p.status === "COMPLETED"
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    const latestPayment = customerPayments[0];

    const isSeedOrg = organizationId === SEED_ORGANIZATION.id;
    const customerInvoices = (
      data.invoices ?? (isSeedOrg ? SEED_INVOICES_2027 : [])
    ).filter(
      (inv) => inv.organizationId === organizationId && inv.customerId === c.id
    );
    const unpaidInvoice =
      customerInvoices.find((i) => i.balanceDue > 0) || customerInvoices[0];

    const daysToExpiry = sub?.endTime
      ? Math.ceil((new Date(sub.endTime).getTime() - nowMs) / 86400000)
      : null;

    const expiryFormatted = sub?.endTime
      ? new Date(sub.endTime).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : isSeedOrg
      ? "04 Nov 2026"
      : "—";

    const prefs = state.preferences.get(c.id) ?? {
      customerId: c.id,
      organizationId,
      transactionalSms: true,
      marketingSms: true,
      updatedAt: c.createdAt,
    };

    const speedMbps = plan
      ? Math.round(plan.downloadSpeedKbps / 1024)
      : 0;

    return {
      customerId: c.id,
      accountNumber: c.accountNumber,
      customerName: c.fullName,
      rawPhoneNumber: c.phoneNumber,
      normalizedPhoneNumber: phoneCheck.valid
        ? phoneCheck.normalizedPhoneNumber
        : "",
      formattedPhone: phoneCheck.valid
        ? phoneCheck.formattedDisplay
        : c.phoneNumber || "—",
      countryCode: phoneCheck.countryCode,
      phoneValid: phoneCheck.valid,
      email: c.email,
      status: c.status,
      serviceType: plan?.serviceType || (pppoe ? "PPPOE" : "HOTSPOT"),
      packageId: plan?.id,
      packageName:
        plan?.name ||
        sub?.planName ||
        (isSeedOrg ? "Standard Fiber Plan" : "—"),
      speedMbps,
      packagePrice: plan?.price ?? 0,
      siteId: site?.id || c.siteId,
      popName:
        site?.name ||
        c.siteName ||
        (isSeedOrg ? "Main Fiber POP" : "—"),
      routerId: router?.id || pppoe?.routerId,
      routerName:
        router?.name || (isSeedOrg ? "Core-BNG-Router" : "—"),
      isOnline: Boolean(pppoe?.isOnline),
      balanceDue: c.balanceDue,
      expiryDate: expiryFormatted,
      daysToExpiry,
      invoiceNumber:
        unpaidInvoice?.invoiceNumber ||
        (isSeedOrg ? `INV-${c.accountNumber}` : "—"),
      lastPaymentReference: latestPayment?.transactionReference || "—",
      supportContact:
        data.organization.phone || (isSeedOrg ? "+254712345678" : "—"),
      paybillNumber:
        data.organization.businessNumber || (isSeedOrg ? "4084200" : "—"),
      ispName: data.organization.name || "ISP",
      transactionalOptIn: prefs.transactionalSms,
      marketingOptIn: prefs.marketingSms,
      registeredAt: c.createdAt,
    };
  });
}

export interface RecipientResolutionResult {
  recipientMode: SmsRecipientMode;
  category: SmsCategory;
  totalMatchedBeforeValidation: number;
  eligibleRecipients: EnrichedSmsRecipient[];
  skippedInvalidPhone: EnrichedSmsRecipient[];
  skippedOptOut: EnrichedSmsRecipient[];
  duplicatesRemoved: number;
}

/**
 * Dynamically resolves and validates SMS recipients according to recipient mode,
 * targeted filters, phone validity, deduplication, and opt-out rules.
 */
export function resolveSmsRecipients(params: {
  organizationId: string;
  recipientMode: SmsRecipientMode;
  category: SmsCategory;
  filters?: SmsTargetFilters;
  data?: SmsTenantOperationalData;
}): RecipientResolutionResult {
  const all = buildEnrichedSmsRecipients(params.organizationId, params.data);
  const f = params.filters ?? {};

  // Sort newest registered timestamps for RECENTLY_REGISTERED mode
  const sortedByRegDesc = [...all].sort(
    (a, b) =>
      new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
  );
  const recentIds = new Set(sortedByRegDesc.slice(0, 3).map((r) => r.customerId));

  let matched = all.filter((r) => r.status !== "TERMINATED");

  // 1. Primary Recipient Mode Filter
  switch (params.recipientMode) {
    case "INDIVIDUAL":
      matched = matched.filter(
        (r) =>
          (f.customerId && r.customerId === f.customerId) ||
          (f.customerIds && f.customerIds.includes(r.customerId))
      );
      break;
    case "SELECTED":
      matched = matched.filter((r) =>
        (f.customerIds ?? []).includes(r.customerId)
      );
      break;
    case "ACTIVE_SUBSCRIBERS":
      matched = matched.filter((r) => r.status === "ACTIVE");
      break;
    case "SUSPENDED_SUBSCRIBERS":
      matched = matched.filter((r) => r.status === "SUSPENDED");
      break;
    case "EXPIRING_SUBSCRIBERS": {
      const maxDays = f.expiringWithinDays ?? 7;
      matched = matched.filter(
        (r) =>
          (r.daysToExpiry !== null && r.daysToExpiry <= maxDays) ||
          r.status === "SUSPENDED"
      );
      break;
    }
    case "OVERDUE_CUSTOMERS":
      matched = matched.filter((r) => r.balanceDue > 0);
      break;
    case "RECENTLY_REGISTERED":
      matched = matched.filter((r) => recentIds.has(r.customerId));
      break;
    case "PACKAGE_SUBSCRIBERS":
      if (f.planId) {
        matched = matched.filter((r) => r.packageId === f.planId);
      } else if (f.packageName) {
        const q = f.packageName.toLowerCase();
        matched = matched.filter((r) =>
          r.packageName.toLowerCase().includes(q)
        );
      }
      break;
    case "NETWORK_POP_OR_ROUTER":
      if (f.siteId) {
        matched = matched.filter((r) => r.siteId === f.siteId);
      }
      if (f.siteName) {
        const sq = f.siteName.toLowerCase();
        matched = matched.filter((r) => r.popName.toLowerCase().includes(sq));
      }
      if (f.routerId) {
        matched = matched.filter((r) => r.routerId === f.routerId);
      }
      if (f.routerName) {
        const rq = f.routerName.toLowerCase();
        matched = matched.filter((r) =>
          r.routerName.toLowerCase().includes(rq)
        );
      }
      break;
    case "CUSTOMER_GROUP":
    case "ALL_ELIGIBLE":
    default:
      break;
  }

  // 2. Apply Additional Granular Targeting Filters (Section 8)
  if (f.subscriptionStatus && f.subscriptionStatus !== "ALL") {
    if (f.subscriptionStatus === "ACTIVE") {
      matched = matched.filter((r) => r.status === "ACTIVE");
    } else if (f.subscriptionStatus === "SUSPENDED") {
      matched = matched.filter((r) => r.status === "SUSPENDED");
    } else if (f.subscriptionStatus === "PENDING") {
      matched = matched.filter(
        (r) => r.status === "PENDING_INSTALLATION" || r.status === "LEAD"
      );
    } else if (f.subscriptionStatus === "EXPIRED") {
      matched = matched.filter(
        (r) =>
          (r.daysToExpiry !== null && r.daysToExpiry <= 0) ||
          r.status === "SUSPENDED"
      );
    } else if (f.subscriptionStatus === "NEWLY_REGISTERED") {
      matched = matched.filter((r) => recentIds.has(r.customerId));
    }
  }

  if (f.planId && params.recipientMode !== "PACKAGE_SUBSCRIBERS") {
    matched = matched.filter((r) => r.packageId === f.planId);
  }
  if (f.packageName && params.recipientMode !== "PACKAGE_SUBSCRIBERS") {
    const pq = f.packageName.toLowerCase();
    matched = matched.filter((r) => r.packageName.toLowerCase().includes(pq));
  }
  if (typeof f.minSpeedMbps === "number" && f.minSpeedMbps > 0) {
    matched = matched.filter((r) => r.speedMbps >= f.minSpeedMbps!);
  }
  if (typeof f.maxPrice === "number" && f.maxPrice > 0) {
    matched = matched.filter((r) => r.packagePrice <= f.maxPrice!);
  }

  if (f.billingStatus && f.billingStatus !== "ALL") {
    if (f.billingStatus === "PAID") {
      matched = matched.filter((r) => r.balanceDue <= 0);
    } else if (f.billingStatus === "UNPAID" || f.billingStatus === "OVERDUE") {
      matched = matched.filter((r) => r.balanceDue > 0);
    } else if (f.billingStatus === "EXPIRING_SOON") {
      matched = matched.filter(
        (r) => r.daysToExpiry !== null && r.daysToExpiry <= 5
      );
    }
  }

  if (f.siteId && params.recipientMode !== "NETWORK_POP_OR_ROUTER") {
    matched = matched.filter((r) => r.siteId === f.siteId);
  }
  if (f.routerId && params.recipientMode !== "NETWORK_POP_OR_ROUTER") {
    matched = matched.filter((r) => r.routerId === f.routerId);
  }
  if (f.serviceType && f.serviceType !== "ALL") {
    matched = matched.filter((r) => r.serviceType === f.serviceType);
  }
  if (f.sessionState && f.sessionState !== "ALL") {
    matched = matched.filter((r) =>
      f.sessionState === "ONLINE" ? r.isOnline : !r.isOnline
    );
  }
  if (f.searchQuery && f.searchQuery.trim() !== "") {
    const sq = f.searchQuery.trim().toLowerCase();
    matched = matched.filter(
      (r) =>
        r.customerName.toLowerCase().includes(sq) ||
        r.accountNumber.toLowerCase().includes(sq) ||
        r.rawPhoneNumber.toLowerCase().includes(sq) ||
        r.normalizedPhoneNumber.toLowerCase().includes(sq) ||
        (r.email || "").toLowerCase().includes(sq) ||
        r.packageName.toLowerCase().includes(sq) ||
        r.popName.toLowerCase().includes(sq) ||
        r.status.toLowerCase().includes(sq)
    );
  }

  const totalMatchedBeforeValidation = matched.length;
  const skippedInvalidPhone: EnrichedSmsRecipient[] = [];
  const skippedOptOut: EnrichedSmsRecipient[] = [];
  const eligibleRecipients: EnrichedSmsRecipient[] = [];
  const seenNormalizedPhones = new Set<string>();
  let duplicatesRemoved = 0;

  for (const r of matched) {
    if (!r.phoneValid || !r.normalizedPhoneNumber) {
      skippedInvalidPhone.push(r);
      continue;
    }

    // Marketing Opt-Out Check (Sections 30, 31, 32):
    // Marketing SMS respects customer marketing opt-out; Transactional/Operational SMS remains enabled
    if (params.category === "MARKETING" && !r.marketingOptIn) {
      skippedOptOut.push(r);
      continue;
    }

    if (seenNormalizedPhones.has(r.normalizedPhoneNumber)) {
      duplicatesRemoved += 1;
      continue;
    }
    seenNormalizedPhones.add(r.normalizedPhoneNumber);
    eligibleRecipients.push(r);
  }

  return {
    recipientMode: params.recipientMode,
    category: params.category,
    totalMatchedBeforeValidation,
    eligibleRecipients,
    skippedInvalidPhone,
    skippedOptOut,
    duplicatesRemoved,
  };
}

// ============================================================================
// 8. CAMPAIGN PREVIEW & BULK SEND DISPATCHER (Sections 20, 21, 26, 27, 28, 32)
// ============================================================================

export interface SmsCampaignPreview {
  ok: boolean;
  error?: string;
  recipientCount: number;
  skippedInvalidCount: number;
  skippedOptOutCount: number;
  duplicatesRemoved: number;
  characterCount: number;
  encoding: "GSM_7" | "UCS_2";
  segmentsPerRecipient: number;
  estimatedTotalSegments: number;
  estimatedCost: number | null;
  currency: string;
  pricingDisplay: string;
  providerConfigured: boolean;
  providerStatusMessage: string;
  samplePreviews: Array<{
    customerName: string;
    accountNumber: string;
    phone: string;
    packageName: string;
    resolvedMessage: string;
  }>;
  requiresBulkConfirmation: boolean;
}

export function previewSmsCampaign(params: {
  organizationId: string;
  recipientMode: SmsRecipientMode;
  category: SmsCategory;
  messageTemplate: string;
  filters?: SmsTargetFilters;
  data?: SmsTenantOperationalData;
  isDemoMode?: boolean;
}): SmsCampaignPreview {
  const state = getOrCreateTenantSmsState(
    params.organizationId,
    params.isDemoMode
  );
  const providerSummary = sanitizeProviderConfigForClient(state.providerConfig);

  const tplValidation = validateTemplateVariables(
    params.messageTemplate,
    "manual.campaign"
  );
  if (!tplValidation.valid) {
    return {
      ok: false,
      error: tplValidation.error,
      recipientCount: 0,
      skippedInvalidCount: 0,
      skippedOptOutCount: 0,
      duplicatesRemoved: 0,
      characterCount: params.messageTemplate.length,
      encoding: "GSM_7",
      segmentsPerRecipient: 0,
      estimatedTotalSegments: 0,
      estimatedCost: null,
      currency: providerSummary.currency,
      pricingDisplay: providerSummary.pricingStatus,
      providerConfigured: providerSummary.isConfigured,
      providerStatusMessage: providerSummary.statusMessage,
      samplePreviews: [],
      requiresBulkConfirmation: false,
    };
  }

  const resolved = resolveSmsRecipients({
    organizationId: params.organizationId,
    recipientMode: params.recipientMode,
    category: params.category,
    filters: params.filters,
    data: params.data,
  });

  const samplePreviews: SmsCampaignPreview["samplePreviews"] = [];
  let maxSegmentsPerRecipient = calculateSmsSegments(
    params.messageTemplate
  ).segments;
  let sampleCharCount = params.messageTemplate.length;
  let sampleEncoding: "GSM_7" | "UCS_2" = "GSM_7";

  for (const r of resolved.eligibleRecipients) {
    const personal = resolvePersonalizedMessage(params.messageTemplate, r);
    if (!personal.ok) {
      return {
        ok: false,
        error: personal.error,
        recipientCount: resolved.eligibleRecipients.length,
        skippedInvalidCount: resolved.skippedInvalidPhone.length,
        skippedOptOutCount: resolved.skippedOptOut.length,
        duplicatesRemoved: resolved.duplicatesRemoved,
        characterCount: params.messageTemplate.length,
        encoding: "GSM_7",
        segmentsPerRecipient: 0,
        estimatedTotalSegments: 0,
        estimatedCost: null,
        currency: providerSummary.currency,
        pricingDisplay: providerSummary.pricingStatus,
        providerConfigured: providerSummary.isConfigured,
        providerStatusMessage: providerSummary.statusMessage,
        samplePreviews: [],
        requiresBulkConfirmation: resolved.eligibleRecipients.length > 1,
      };
    }

    const seg = calculateSmsSegments(personal.resolvedMessage);
    if (seg.segments > maxSegmentsPerRecipient) {
      maxSegmentsPerRecipient = seg.segments;
    }
    if (samplePreviews.length === 0) {
      sampleCharCount = seg.characterCount;
      sampleEncoding = seg.encoding;
    }
    if (samplePreviews.length < 3) {
      samplePreviews.push({
        customerName: r.customerName,
        accountNumber: r.accountNumber,
        phone: r.formattedPhone,
        packageName: r.packageName,
        resolvedMessage: personal.resolvedMessage,
      });
    }
  }

  const estimatedTotalSegments =
    resolved.eligibleRecipients.length * Math.max(1, maxSegmentsPerRecipient);
  const estimatedCost =
    providerSummary.isConfigured && providerSummary.costPerSegment !== null
      ? Number(
          (estimatedTotalSegments * providerSummary.costPerSegment).toFixed(2)
        )
      : null;

  return {
    ok: true,
    recipientCount: resolved.eligibleRecipients.length,
    skippedInvalidCount: resolved.skippedInvalidPhone.length,
    skippedOptOutCount: resolved.skippedOptOut.length,
    duplicatesRemoved: resolved.duplicatesRemoved,
    characterCount: sampleCharCount,
    encoding: sampleEncoding,
    segmentsPerRecipient: Math.max(1, maxSegmentsPerRecipient),
    estimatedTotalSegments,
    estimatedCost,
    currency: providerSummary.currency,
    pricingDisplay:
      estimatedCost !== null
        ? `${providerSummary.currency} ${estimatedCost.toLocaleString()}`
        : "Provider pricing unavailable.",
    providerConfigured: providerSummary.isConfigured,
    providerStatusMessage: providerSummary.statusMessage,
    samplePreviews,
    requiresBulkConfirmation:
      resolved.eligibleRecipients.length > 1 ||
      params.recipientMode !== "INDIVIDUAL",
  };
}

export interface DispatchSmsResult {
  ok: boolean;
  code?:
    | "PERMISSION_DENIED"
    | "CONFIRMATION_REQUIRED"
    | "PROVIDER_NOT_CONFIGURED"
    | "VALIDATION_ERROR"
    | "NO_RECIPIENTS"
    | "DUPLICATE_CAMPAIGN";
  error?: string;
  campaign?: SmsCampaignRecord;
  messagesDispatched?: SmsMessageRecord[];
  preview?: SmsCampaignPreview;
}

/**
 * Executes an authorized Individual or Bulk SMS dispatch.
 * Enforces RBAC, provider configuration check, variable personalization safety,
 * bulk confirmation gate, recipient deduplication, and immutable audit logging.
 */
export function dispatchSmsCampaign(params: {
  organizationId: string;
  actorId?: string;
  actorName: string;
  actorRole: UserRole;
  campaignName?: string;
  recipientMode: SmsRecipientMode;
  messageType: SmsMessageType;
  category: SmsCategory;
  templateCode?: string;
  messageTemplate: string;
  filters?: SmsTargetFilters;
  confirmed?: boolean;
  idempotencyKey?: string;
  scheduledAt?: string;
  data?: SmsTenantOperationalData;
  isDemoMode?: boolean;
}): DispatchSmsResult {
  const isBulk =
    params.recipientMode !== "INDIVIDUAL" ||
    (params.filters?.customerIds && params.filters.customerIds.length > 1);

  // 1. RBAC Enforcement (Section 29)
  const requiredPerm = isBulk ? "sms.send_bulk" : "sms.send";
  if (!hasPermission(params.actorRole, requiredPerm)) {
    return {
      ok: false,
      code: "PERMISSION_DENIED",
      error: isBulk
        ? "You don't have permission to send bulk SMS campaigns (requires sms.send_bulk)."
        : "You don't have permission to send SMS messages (requires sms.send).",
    };
  }

  const state = getOrCreateTenantSmsState(
    params.organizationId,
    params.isDemoMode
  );

  // 2. Idempotency Guard (Section 32)
  if (params.idempotencyKey) {
    const existingCampaign = state.campaignIdempotencyKeys.get(
      params.idempotencyKey
    );
    if (existingCampaign) {
      return {
        ok: false,
        code: "DUPLICATE_CAMPAIGN",
        error: "This SMS campaign has already been submitted (duplicate idempotency key prevented).",
        campaign: existingCampaign,
      };
    }
  }

  // 3. Preview & Validate Template + Recipients
  const preview = previewSmsCampaign({
    organizationId: params.organizationId,
    recipientMode: params.recipientMode,
    category: params.category,
    messageTemplate: params.messageTemplate,
    filters: params.filters,
    data: params.data,
    isDemoMode: params.isDemoMode,
  });

  if (!preview.ok) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: preview.error || "Invalid SMS message or template variables.",
      preview,
    };
  }

  if (preview.recipientCount === 0) {
    return {
      ok: false,
      code: "NO_RECIPIENTS",
      error: "No eligible customers with valid phone numbers matched the selected criteria.",
      preview,
    };
  }

  // 4. Bulk Confirmation Gate (Sections 21 & 35)
  if ((isBulk || preview.recipientCount > 1) && params.confirmed !== true) {
    return {
      ok: false,
      code: "CONFIRMATION_REQUIRED",
      error: `Confirmation required before sending bulk SMS to ${preview.recipientCount} customer(s).`,
      preview,
    };
  }

  // 5. Provider Configuration Honesty Check (Sections 4, 15, 26, 40)
  if (!isProviderConfigured(state.providerConfig)) {
    return {
      ok: false,
      code: "PROVIDER_NOT_CONFIGURED",
      error: "SMS provider not configured. Connect an SMS provider in Settings to start sending messages.",
      preview,
    };
  }

  const resolved = resolveSmsRecipients({
    organizationId: params.organizationId,
    recipientMode: params.recipientMode,
    category: params.category,
    filters: params.filters,
    data: params.data,
  });

  const nowIso = new Date().toISOString();
  const campaignId = `camp-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
  const providerPrefix =
    state.providerConfig.provider === "AFRICAS_TALKING"
      ? "ATXid"
      : state.providerConfig.provider === "TWILIO"
      ? "SM"
      : "GW";

  const dispatchedMessages: SmsMessageRecord[] = [];
  let totalSegmentsUsed = 0;

  for (const r of resolved.eligibleRecipients) {
    const personal = resolvePersonalizedMessage(params.messageTemplate, r);
    if (!personal.ok) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        error: personal.error,
      };
    }

    const seg = calculateSmsSegments(personal.resolvedMessage);
    totalSegmentsUsed += seg.segments;

    const msgCost =
      state.providerConfig.costPerSegment !== null
        ? Number((seg.segments * state.providerConfig.costPerSegment).toFixed(2))
        : null;

    // Provider gateway sets initial status to SENT (or QUEUED if scheduled)
    // Never falsely report DELIVERED until confirmed by provider delivery report / webhook (Section 26)
    const initialStatus: SmsDeliveryStatus = params.scheduledAt
      ? "QUEUED"
      : "SENT";

    const msgRecord: SmsMessageRecord = {
      id: `sms-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      organizationId: params.organizationId,
      campaignId,
      campaignName:
        params.campaignName ||
        `${params.messageType.replace(/_/g, " ")} (${
          resolved.eligibleRecipients.length
        })`,
      customerId: r.customerId,
      customerName: r.customerName,
      accountNumber: r.accountNumber,
      recipientPhone: r.normalizedPhoneNumber.replace(/^\+/, "") || r.rawPhoneNumber,
      normalizedPhone: r.normalizedPhoneNumber,
      messageType: params.messageType,
      category: params.category,
      messageBody: personal.resolvedMessage,
      characterCount: seg.characterCount,
      segmentCount: seg.segments,
      provider: state.providerConfig.provider,
      senderId: state.providerConfig.senderId,
      providerMessageId: `${providerPrefix}_${Date.now().toString().slice(-6)}${Math.floor(
        Math.random() * 900 + 100
      )}`,
      status: initialStatus,
      cost: msgCost,
      currency: state.providerConfig.currency,
      sentById: params.actorId,
      sentByName: params.actorName,
      sentAt: nowIso,
      createdAt: nowIso,
    };

    dispatchedMessages.push(msgRecord);
    state.messages.unshift(msgRecord);
  }

  // Deduct credits/balance from cached provider state
  if (state.providerConfig.cachedCredits !== null) {
    state.providerConfig.cachedCredits = Math.max(
      0,
      state.providerConfig.cachedCredits - totalSegmentsUsed
    );
  }
  if (
    state.providerConfig.cachedBalance !== null &&
    state.providerConfig.costPerSegment !== null
  ) {
    state.providerConfig.cachedBalance = Number(
      Math.max(
        0,
        state.providerConfig.cachedBalance -
          totalSegmentsUsed * state.providerConfig.costPerSegment
      ).toFixed(2)
    );
  }

  const campaignRecord: SmsCampaignRecord = {
    id: campaignId,
    organizationId: params.organizationId,
    campaignName:
      params.campaignName ||
      `${params.messageType.replace(/_/g, " ")} (${
        dispatchedMessages.length
      } recipient${dispatchedMessages.length === 1 ? "" : "s"})`,
    recipientMode: params.recipientMode,
    targetFilters: params.filters ?? {},
    templateCode: params.templateCode,
    messageTemplate: params.messageTemplate,
    category: params.category,
    messageType: params.messageType,
    totalRecipients: resolved.totalMatchedBeforeValidation,
    validRecipients: dispatchedMessages.length,
    skippedOptOut: resolved.skippedOptOut.length,
    skippedInvalid: resolved.skippedInvalidPhone.length,
    estimatedSegments: totalSegmentsUsed,
    estimatedCost: preview.estimatedCost,
    currency: state.providerConfig.currency,
    status: params.scheduledAt ? "SCHEDULED" : "COMPLETED",
    scheduledAt: params.scheduledAt,
    sentById: params.actorId,
    sentByName: params.actorName,
    idempotencyKey: params.idempotencyKey,
    createdAt: nowIso,
    completedAt: params.scheduledAt ? undefined : nowIso,
  };

  state.campaigns.unshift(campaignRecord);
  if (params.idempotencyKey) {
    state.campaignIdempotencyKeys.set(params.idempotencyKey, campaignRecord);
  }

  // Record in immutable SMS audit log (Section 28)
  state.auditLogs.unshift({
    id: `sms-aud-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
    organizationId: params.organizationId,
    actorId: params.actorId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    action: isBulk ? "sms.send_bulk" : "sms.send_individual",
    campaignId: campaignRecord.id,
    messageId: dispatchedMessages[0]?.id,
    recipientCount: dispatchedMessages.length,
    messageType: params.messageType,
    provider: state.providerConfig.provider,
    providerReference: dispatchedMessages[0]?.providerMessageId,
    deliveryState: dispatchedMessages[0]?.status || "SENT",
    segmentsUsed: totalSegmentsUsed,
    createdAt: nowIso,
  });

  return {
    ok: true,
    campaign: campaignRecord,
    messagesDispatched: dispatchedMessages,
    preview,
  };
}

// ============================================================================
// 9. SECURE DELIVERY REPORT WEBHOOK PROCESSOR (Section 27)
// ============================================================================

export function processSmsDeliveryWebhook(params: {
  organizationId: string;
  webhookToken?: string;
  eventId: string;
  providerMessageId: string;
  status: SmsDeliveryStatus;
  failureReason?: string;
}): {
  ok: boolean;
  code?: "UNAUTHORIZED" | "REPLAY_DETECTED" | "MESSAGE_NOT_FOUND";
  error?: string;
  updatedMessage?: SmsMessageRecord;
} {
  const state = getOrCreateTenantSmsState(params.organizationId);

  // Verify webhook secret if configured
  const expectedSecret =
    state.providerConfig.webhookSecret || process.env.SMS_WEBHOOK_SECRET;
  if (expectedSecret && params.webhookToken !== expectedSecret) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      error: "Invalid webhook signature or authentication token.",
    };
  }

  // Prevent replay attacks
  if (!params.eventId || state.processedWebhookEventIds.has(params.eventId)) {
    return {
      ok: false,
      code: "REPLAY_DETECTED",
      error: "Duplicate or replayed webhook event ignored.",
    };
  }

  const msg = state.messages.find(
    (m) =>
      m.organizationId === params.organizationId &&
      m.providerMessageId === params.providerMessageId
  );

  if (!msg) {
    return {
      ok: false,
      code: "MESSAGE_NOT_FOUND",
      error: "Provider message ID not found for this tenant.",
    };
  }

  state.processedWebhookEventIds.add(params.eventId);
  msg.status = params.status;
  if (params.status === "DELIVERED") {
    msg.deliveredAt = new Date().toISOString();
    msg.failureReason = undefined;
  } else if (params.failureReason) {
    msg.failureReason = params.failureReason;
  }

  state.auditLogs.unshift({
    id: `sms-aud-wh-${Date.now()}`,
    organizationId: params.organizationId,
    actorName: `${msg.provider} Webhook`,
    actorRole: "super_admin",
    action: "sms.webhook.delivery_report",
    campaignId: msg.campaignId,
    messageId: msg.id,
    recipientCount: 1,
    messageType: msg.messageType,
    provider: msg.provider,
    providerReference: msg.providerMessageId,
    deliveryState: msg.status,
    failureReason: msg.failureReason,
    segmentsUsed: msg.segmentCount,
    createdAt: new Date().toISOString(),
  });

  return {
    ok: true,
    updatedMessage: msg,
  };
}

// ============================================================================
// 10. SMS OVERVIEW METRICS, HISTORY & CUSTOMER PREFERENCES (Sections 4, 25, 30)
// ============================================================================

export interface SmsOverviewMetrics {
  organizationId: string;
  providerConfigured: boolean;
  providerName: SmsProviderType;
  senderId: string;
  statusMessage: string;
  pricingStatus: string;
  availableCredits: number | null;
  remainingBalance: number | null;
  currency: string;
  totalMessagesSent: number;
  deliveredCount: number;
  pendingCount: number;
  failedCount: number;
  deliveryRatePercent: number;
  messagesSentToday: number;
  messagesSentThisMonth: number;
  paymentRemindersThisMonth: number;
  totalCustomers: number;
  customersWithValidPhone: number;
  customersReachableTransactional: number;
  customersReachableMarketing: number;
  unremindedOverdueCustomers: Array<{
    customerId: string;
    customerName: string;
    accountNumber: string;
    phone: string;
    balanceDue: number;
    packageName: string;
  }>;
}

export function getSmsOverviewMetrics(
  organizationId: string,
  data?: SmsTenantOperationalData,
  isDemoMode = false
): SmsOverviewMetrics {
  const state = getOrCreateTenantSmsState(organizationId, isDemoMode);
  const providerSummary = sanitizeProviderConfigForClient(state.providerConfig);
  const recipients = buildEnrichedSmsRecipients(organizationId, data);

  const msgs = state.messages.filter(
    (m) => m.organizationId === organizationId
  );

  const now = new Date();
  const startOfTodayMs = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const startOfMonthMs = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  ).getTime();

  // Also include messages sent within last 24h for "today" in demo/live relative timestamps
  const twentyFourHoursAgoMs = Date.now() - 86400 * 1000;
  const thirtyDaysAgoMs = Date.now() - 30 * 86400 * 1000;

  const totalMessagesSent = msgs.length;
  const deliveredCount = msgs.filter((m) => m.status === "DELIVERED").length;
  const pendingCount = msgs.filter(
    (m) => m.status === "QUEUED" || m.status === "SENT"
  ).length;
  const failedCount = msgs.filter(
    (m) => m.status === "FAILED" || m.status === "REJECTED"
  ).length;

  const deliveryRatePercent =
    totalMessagesSent > 0
      ? Number(((deliveredCount / totalMessagesSent) * 100).toFixed(1))
      : 0;

  const messagesSentToday = msgs.filter((m) => {
    const t = new Date(m.sentAt).getTime();
    return t >= startOfTodayMs || t >= twentyFourHoursAgoMs;
  }).length;

  const messagesSentThisMonth = msgs.filter((m) => {
    const t = new Date(m.sentAt).getTime();
    return t >= startOfMonthMs || t >= thirtyDaysAgoMs;
  }).length;

  const paymentRemindersThisMonth = msgs.filter((m) => {
    const t = new Date(m.sentAt).getTime();
    return (
      (m.messageType === "PAYMENT_REMINDER" ||
        m.messageType === "SUSPENSION_NOTICE") &&
      (t >= startOfMonthMs || t >= thirtyDaysAgoMs)
    );
  }).length;

  const remindedCustomerIds = new Set(
    msgs
      .filter((m) => m.messageType === "PAYMENT_REMINDER")
      .map((m) => m.customerId)
      .filter(Boolean)
  );

  const unremindedOverdueCustomers = recipients
    .filter((r) => r.balanceDue > 0 && !remindedCustomerIds.has(r.customerId))
    .map((r) => ({
      customerId: r.customerId,
      customerName: r.customerName,
      accountNumber: r.accountNumber,
      phone: r.formattedPhone,
      balanceDue: r.balanceDue,
      packageName: r.packageName,
    }));

  const validPhoneRecipients = recipients.filter((r) => r.phoneValid);

  return {
    organizationId,
    providerConfigured: providerSummary.isConfigured,
    providerName: providerSummary.provider,
    senderId: providerSummary.senderId,
    statusMessage: providerSummary.statusMessage,
    pricingStatus: providerSummary.pricingStatus,
    availableCredits: providerSummary.cachedCredits,
    remainingBalance: providerSummary.cachedBalance,
    currency: providerSummary.currency,
    totalMessagesSent,
    deliveredCount,
    pendingCount,
    failedCount,
    deliveryRatePercent,
    messagesSentToday,
    messagesSentThisMonth,
    paymentRemindersThisMonth,
    totalCustomers: recipients.length,
    customersWithValidPhone: validPhoneRecipients.length,
    customersReachableTransactional: validPhoneRecipients.filter(
      (r) => r.transactionalOptIn
    ).length,
    customersReachableMarketing: validPhoneRecipients.filter(
      (r) => r.marketingOptIn
    ).length,
    unremindedOverdueCustomers,
  };
}

export interface SmsHistoryFilter {
  search?: string;
  status?: SmsDeliveryStatus | "ALL";
  messageType?: SmsMessageType | "ALL";
  provider?: SmsProviderType | "ALL";
  campaignId?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function getSmsHistory(
  organizationId: string,
  filter?: SmsHistoryFilter,
  isDemoMode = false
): SmsMessageRecord[] {
  const state = getOrCreateTenantSmsState(organizationId, isDemoMode);
  let list = state.messages.filter((m) => m.organizationId === organizationId);

  if (!filter) return list;

  if (filter.status && filter.status !== "ALL") {
    list = list.filter((m) => m.status === filter.status);
  }
  if (filter.messageType && filter.messageType !== "ALL") {
    list = list.filter((m) => m.messageType === filter.messageType);
  }
  if (filter.provider && filter.provider !== "ALL") {
    list = list.filter((m) => m.provider === filter.provider);
  }
  if (filter.campaignId) {
    list = list.filter((m) => m.campaignId === filter.campaignId);
  }
  if (filter.customerId) {
    list = list.filter((m) => m.customerId === filter.customerId);
  }
  if (filter.search && filter.search.trim() !== "") {
    const q = filter.search.trim().toLowerCase();
    list = list.filter(
      (m) =>
        (m.customerName || "").toLowerCase().includes(q) ||
        (m.accountNumber || "").toLowerCase().includes(q) ||
        m.recipientPhone.toLowerCase().includes(q) ||
        m.normalizedPhone.toLowerCase().includes(q) ||
        m.messageBody.toLowerCase().includes(q) ||
        m.providerMessageId.toLowerCase().includes(q)
    );
  }
  if (filter.dateFrom) {
    const fromMs = new Date(filter.dateFrom).getTime();
    if (!Number.isNaN(fromMs)) {
      list = list.filter((m) => new Date(m.sentAt).getTime() >= fromMs);
    }
  }
  if (filter.dateTo) {
    const toMs = new Date(filter.dateTo).getTime() + 86400000;
    if (!Number.isNaN(toMs)) {
      list = list.filter((m) => new Date(m.sentAt).getTime() <= toMs);
    }
  }

  return list;
}

export function saveSmsTemplate(params: {
  organizationId: string;
  actorRole: UserRole;
  id?: string;
  code: string;
  name: string;
  category: SmsCategory;
  triggerEvent: string;
  bodyTemplate: string;
  isActive?: boolean;
}): {
  ok: boolean;
  template?: SmsTemplateRecord;
  error?: string;
} {
  if (!hasPermission(params.actorRole, "sms.manage_templates")) {
    return {
      ok: false,
      error: "You don't have permission to manage SMS templates (requires sms.manage_templates).",
    };
  }

  const validation = validateTemplateVariables(
    params.bodyTemplate,
    params.triggerEvent
  );
  if (!validation.valid) {
    return {
      ok: false,
      error: validation.error,
    };
  }

  const state = getOrCreateTenantSmsState(params.organizationId);
  const nowIso = new Date().toISOString();
  const codeClean = params.code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_");

  const existingIdx = state.templates.findIndex(
    (t) =>
      t.organizationId === params.organizationId &&
      (t.id === params.id || t.code === codeClean)
  );

  const record: SmsTemplateRecord = {
    id:
      existingIdx >= 0
        ? state.templates[existingIdx].id
        : `smstpl-${Date.now()}`,
    organizationId: params.organizationId,
    code: codeClean,
    name: params.name.trim(),
    category: params.category,
    triggerEvent: params.triggerEvent,
    bodyTemplate: params.bodyTemplate.trim(),
    requiredVariables: validation.variablesUsed,
    isActive: params.isActive ?? true,
    createdAt:
      existingIdx >= 0 ? state.templates[existingIdx].createdAt : nowIso,
    updatedAt: nowIso,
  };

  if (existingIdx >= 0) {
    state.templates[existingIdx] = record;
  } else {
    state.templates.unshift(record);
  }

  return { ok: true, template: record };
}

export function updateCustomerSmsPreferences(params: {
  organizationId: string;
  customerId: string;
  marketingSms: boolean;
}): CustomerCommunicationPreferences {
  const state = getOrCreateTenantSmsState(params.organizationId);
  const nowIso = new Date().toISOString();
  const updated: CustomerCommunicationPreferences = {
    customerId: params.customerId,
    organizationId: params.organizationId,
    // Critical transactional/service notices cannot be disabled (Section 30 & 31)
    transactionalSms: true,
    marketingSms: Boolean(params.marketingSms),
    optedOutAt: params.marketingSms ? undefined : nowIso,
    updatedAt: nowIso,
  };
  state.preferences.set(params.customerId, updated);
  return updated;
}

export { formatPhoneForDisplay };
