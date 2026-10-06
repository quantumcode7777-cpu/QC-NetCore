// ============================================================================
// QC NETCORE — MULTI-CHANNEL AUTOMATED COMMUNICATIONS ENGINE
// SMS, WhatsApp, Email, and In-App notification templating & dispatch.
// ============================================================================

export type NotificationChannel = "SMS" | "WHATSAPP" | "EMAIL" | "IN_APP";

export interface NotificationTemplate {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  channel: NotificationChannel;
  triggerEvent: string;
  subject?: string;
  bodyTemplate: string;
  isActive: boolean;
}

export interface NotificationDispatchLog {
  id: string;
  organizationId: string;
  customerId?: string;
  customerName?: string;
  channel: NotificationChannel;
  recipient: string;
  templateCode: string;
  messageBody: string;
  status: "QUEUED" | "SENT" | "DELIVERED" | "FAILED";
  providerReference: string;
  createdAt: string;
}

export const DEFAULT_NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  {
    id: "tpl-payment-confirm-sms",
    organizationId: "org-nexanet-01",
    code: "PAYMENT_CONFIRMED",
    name: "Payment Receipt & Reconnection (SMS)",
    channel: "SMS",
    triggerEvent: "payment.completed",
    bodyTemplate:
      "Confirmed: KES {{amount}} received (Ref {{reference}}) for account {{account_number}}. Your {{plan_name}} internet is ACTIVE until {{expiry_date}}. QC NetCore Support: {{support_phone}}",
    isActive: true,
  },
  {
    id: "tpl-payment-confirm-wa",
    organizationId: "org-nexanet-01",
    code: "PAYMENT_CONFIRMED_WA",
    name: "Payment Receipt & Reconnection (WhatsApp)",
    channel: "WHATSAPP",
    triggerEvent: "payment.completed",
    bodyTemplate:
      "Hello {{customer_name}}, we have received your payment of *KES {{amount}}* (Ref `{{reference}}`) for account *{{account_number}}*. Your *{{plan_name}}* connection is active through *{{expiry_date}}*.",
    isActive: true,
  },
  {
    id: "tpl-expiry-reminder-sms",
    organizationId: "org-nexanet-01",
    code: "EXPIRY_REMINDER_48H",
    name: "48-Hour Subscription Expiry Notice (SMS)",
    channel: "SMS",
    triggerEvent: "subscription.expiring_48h",
    bodyTemplate:
      "Dear {{customer_name}}, your {{plan_name}} subscription (Acc: {{account_number}}) expires on {{expiry_date}}. Renew KES {{amount}} via M-Pesa Paybill {{paybill}} Account {{account_number}} to stay connected.",
    isActive: true,
  },
  {
    id: "tpl-outage-advisory-wa",
    organizationId: "org-nexanet-01",
    code: "OUTAGE_ADVISORY",
    name: "Proactive Area Outage Advisory (WhatsApp)",
    channel: "WHATSAPP",
    triggerEvent: "network.outage_detected",
    bodyTemplate:
      "Notice for {{customer_name}} ({{site_name}}): Our engineering team is resolving a fiber/node event affecting your area. Estimated restoration: {{eta}}. Apologies for the inconvenience.",
    isActive: true,
  },
  {
    id: "tpl-tech-dispatch-sms",
    organizationId: "org-nexanet-01",
    code: "TECH_DISPATCHED",
    name: "Field Technician En-Route (SMS)",
    channel: "SMS",
    triggerEvent: "work_order.assigned",
    bodyTemplate:
      "Hello {{customer_name}}, technician {{tech_name}} ({{tech_phone}}) has been assigned to ticket {{ticket_number}} at {{address}}.",
    isActive: true,
  },
];

/**
 * Safely interpolates `{{variable}}` placeholders inside a notification template.
 */
export function renderNotificationTemplate(
  templateBody: string,
  variables: Record<string, string | number | undefined | null>
): string {
  return templateBody.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const val = variables[key];
    if (val === undefined || val === null || val === "") {
      return `—`;
    }
    return String(val);
  });
}

/**
 * Creates a structured NotificationDispatchLog record from a template and variables.
 */
export function buildNotificationDispatch(params: {
  template: NotificationTemplate;
  recipient: string;
  customerId?: string;
  customerName?: string;
  variables: Record<string, string | number | undefined | null>;
  createdAt?: string;
}): NotificationDispatchLog {
  const messageBody = renderNotificationTemplate(
    params.template.bodyTemplate,
    params.variables
  );
  const prefix =
    params.template.channel === "WHATSAPP"
      ? "WA"
      : params.template.channel === "SMS"
      ? "AT"
      : params.template.channel === "EMAIL"
      ? "EM"
      : "IN";

  return {
    id: `ntf-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
    organizationId: params.template.organizationId,
    customerId: params.customerId,
    customerName: params.customerName,
    channel: params.template.channel,
    recipient: params.recipient.trim(),
    templateCode: params.template.code,
    messageBody,
    status: "DELIVERED",
    providerReference: `${prefix}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    createdAt: params.createdAt || new Date().toISOString(),
  };
}
