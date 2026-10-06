import test from "node:test";
import assert from "node:assert/strict";

import {
  validateAndNormalizePhone,
  formatPhoneForDisplay,
  isSamePhoneNumber,
} from "../src/lib/sms/phone.ts";
import {
  calculateSmsSegments,
  validateTemplateVariables,
  resolvePersonalizedMessage,
  buildEnrichedSmsRecipients,
  resolveSmsRecipients,
  previewSmsCampaign,
  dispatchSmsCampaign,
  processSmsDeliveryWebhook,
  getSmsOverviewMetrics,
  getSmsHistory,
  updateCustomerSmsPreferences,
  updateTenantSmsProviderConfig,
} from "../src/lib/sms/engine.ts";
import { SEED_ORGANIZATION } from "../src/lib/db/mock-db.ts";
import { hasPermission } from "../src/lib/auth/rbac.ts";
import { runCopilotQuery } from "../src/lib/ai/copilot.ts";

const DEMO_ORG_ID = SEED_ORGANIZATION.id;

// ============================================================================
// 1. PHONE NUMBER VALIDATION, NORMALIZATION & FORMATTING
// ============================================================================

test("Phone validation normalizes Kenyan local mobile numbers (07xx / 01xx) to E.164", () => {
  const res1 = validateAndNormalizePhone("0712052104");
  assert.equal(res1.valid, true);
  assert.equal(res1.normalizedPhoneNumber, "+254712052104");
  assert.equal(res1.nationalNumber, "712052104");
  assert.equal(res1.formattedDisplay, "+254 712 052 104");

  const res2 = validateAndNormalizePhone("0110345678");
  assert.equal(res2.valid, true);
  assert.equal(res2.normalizedPhoneNumber, "+254110345678");
});

test("Phone validation accepts international E.164 numbers and strips formatting noise", () => {
  const ke = validateAndNormalizePhone("+254 712-052-104");
  assert.equal(ke.valid, true);
  assert.equal(ke.normalizedPhoneNumber, "+254712052104");

  const ug = validateAndNormalizePhone("+256772123456");
  assert.equal(ug.valid, true);
  assert.equal(ug.normalizedPhoneNumber, "+256772123456");

  const ng = validateAndNormalizePhone("+2348031234567");
  assert.equal(ng.valid, true);
  assert.equal(ng.normalizedPhoneNumber, "+2348031234567");
});

test("Phone validation rejects empty, alphabetical, too-short, and too-long numbers", () => {
  assert.equal(validateAndNormalizePhone("").valid, false);
  assert.equal(validateAndNormalizePhone("071205ABCD").valid, false);
  assert.equal(validateAndNormalizePhone("0712").valid, false);
  assert.equal(validateAndNormalizePhone("+254712052104999999").valid, false);
});

test("isSamePhoneNumber matches equivalent local and E.164 representations", () => {
  assert.equal(isSamePhoneNumber("0712052104", "+254712052104"), true);
  assert.equal(isSamePhoneNumber("0712052104", "+254722111222"), false);
  assert.equal(formatPhoneForDisplay("0712052104"), "+254 712 052 104");
});

// ============================================================================
// 2. SMS ENCODING, LENGTH & SEGMENT CALCULATION
// ============================================================================

test("calculateSmsSegments computes GSM-7 and UCS-2 single/multi-part segments accurately", () => {
  const shortGsm = calculateSmsSegments("Hello John, your WiFi is active.");
  assert.equal(shortGsm.encoding, "GSM_7");
  assert.equal(shortGsm.segments, 1);
  assert.equal(shortGsm.maxSingleSegment, 160);

  const longGsmText = "A".repeat(165);
  const multiGsm = calculateSmsSegments(longGsmText);
  assert.equal(multiGsm.encoding, "GSM_7");
  assert.equal(multiGsm.segments, 2);
  assert.equal(multiGsm.maxConcatSegment, 153);

  const unicodeText = "Hello John 🚀 Your fiber link is live!";
  const ucs2 = calculateSmsSegments(unicodeText);
  assert.equal(ucs2.encoding, "UCS_2");
  assert.equal(ucs2.segments, 1);
  assert.equal(ucs2.maxSingleSegment, 70);
});

// ============================================================================
// 3. TEMPLATE VARIABLE VALIDATION & SAFE PERSONALIZATION
// ============================================================================

test("validateTemplateVariables permits approved placeholders and blocks unknown tokens or mismatched braces", () => {
  const valid = validateTemplateVariables(
    "Hello {{customer_name}}, your {{package_name}} invoice {{invoice_number}} of {{amount_due}} is due on {{expiry_date}}."
  );
  assert.equal(valid.valid, true);
  assert.equal(valid.unknownVariables.length, 0);

  const unknown = validateTemplateVariables(
    "Hello {{customer_name}}, your password is {{admin_password}}."
  );
  assert.equal(unknown.valid, false);
  assert.deepEqual(unknown.unknownVariables, ["admin_password"]);

  const mismatched = validateTemplateVariables(
    "Hello {{customer_name}, your balance is {{amount_due}}."
  );
  assert.equal(mismatched.valid, false);
});

test("resolvePersonalizedMessage safely substitutes customer variables", () => {
  const recipients = buildEnrichedSmsRecipients(DEMO_ORG_ID);
  const john = recipients.find((r) => r.customerName.includes("John Kamau"));
  assert.ok(john, "Expected John Kamau in enriched recipients");

  const rendered = resolvePersonalizedMessage(
    "Hi {{customer_name}} ({{account_number}}), plan {{package_name}} at {{isp_name}}.",
    john
  );
  assert.equal(rendered.ok, true);
  assert.ok(rendered.resolvedMessage.includes("John Kamau"));
  assert.ok(rendered.resolvedMessage.includes(john.accountNumber));
  assert.ok(rendered.resolvedMessage.includes(john.packageName));
  assert.ok(!rendered.resolvedMessage.includes("{{"));
});

// ============================================================================
// 4. TARGETING, OPT-OUT PREFERENCES & DEDUPLICATION
// ============================================================================

test("resolveSmsRecipients filters by OVERDUE_CUSTOMERS, SUSPENDED_SUBSCRIBERS, and PACKAGE_SUBSCRIBERS", () => {
  const overdueRes = resolveSmsRecipients({
    organizationId: DEMO_ORG_ID,
    recipientMode: "OVERDUE_CUSTOMERS",
    category: "TRANSACTIONAL",
  });
  assert.ok(overdueRes.eligibleRecipients.length >= 1);
  assert.ok(overdueRes.eligibleRecipients.every((r) => r.balanceDue > 0));

  const suspendedRes = resolveSmsRecipients({
    organizationId: DEMO_ORG_ID,
    recipientMode: "SUSPENDED_SUBSCRIBERS",
    category: "TRANSACTIONAL",
  });
  assert.ok(suspendedRes.eligibleRecipients.length >= 1);
  assert.ok(
    suspendedRes.eligibleRecipients.every((r) => r.status === "SUSPENDED")
  );

  const pkgRes = resolveSmsRecipients({
    organizationId: DEMO_ORG_ID,
    recipientMode: "PACKAGE_SUBSCRIBERS",
    category: "OPERATIONAL",
    filters: { packageName: "10 Mbps" },
  });
  assert.ok(pkgRes.eligibleRecipients.length >= 1);
  assert.ok(
    pkgRes.eligibleRecipients.every((r) => r.packageName.includes("10 Mbps"))
  );
});

test("Marketing SMS respects customer opt-out while Transactional SMS remains deliverable", () => {
  const recipients = buildEnrichedSmsRecipients(DEMO_ORG_ID);
  const target = recipients[0];
  assert.ok(target);

  // Opt customer out of marketing SMS
  updateCustomerSmsPreferences({
    organizationId: DEMO_ORG_ID,
    customerId: target.customerId,
    marketingSms: false,
  });

  const promoCheck = resolveSmsRecipients({
    organizationId: DEMO_ORG_ID,
    recipientMode: "INDIVIDUAL",
    category: "MARKETING",
    filters: { customerId: target.customerId },
  });
  assert.equal(promoCheck.eligibleRecipients.length, 0);
  assert.equal(promoCheck.skippedOptOut.length, 1);

  const transactionalCheck = resolveSmsRecipients({
    organizationId: DEMO_ORG_ID,
    recipientMode: "INDIVIDUAL",
    category: "TRANSACTIONAL",
    filters: { customerId: target.customerId },
  });
  assert.equal(transactionalCheck.eligibleRecipients.length, 1);

  // Restore preference
  updateCustomerSmsPreferences({
    organizationId: DEMO_ORG_ID,
    customerId: target.customerId,
    marketingSms: true,
  });
});

// ============================================================================
// 5. BULK CONFIRMATION GATE, DISPATCH & WEBHOOK REPLAY PROTECTION
// ============================================================================

test("dispatchSmsCampaign enforces confirmation gate on bulk sends and logs confirmed sends", () => {
  // Unconfirmed bulk campaign must fail with CONFIRMATION_REQUIRED
  const unconfirmedBulk = dispatchSmsCampaign({
    organizationId: DEMO_ORG_ID,
    actorId: "usr-admin-1",
    actorName: "Grace Njeri",
    actorRole: "isp_owner",
    recipientMode: "OVERDUE_CUSTOMERS",
    messageType: "PAYMENT_REMINDER",
    category: "TRANSACTIONAL",
    messageTemplate:
      "Dear {{customer_name}}, your balance of {{amount_due}} is overdue. Support: {{support_contact}}",
    confirmed: false,
    isDemoMode: true,
  });
  assert.equal(unconfirmedBulk.ok, false);
  assert.equal(unconfirmedBulk.code, "CONFIRMATION_REQUIRED");

  // Confirmed bulk campaign succeeds
  const confirmedBulk = dispatchSmsCampaign({
    organizationId: DEMO_ORG_ID,
    actorId: "usr-admin-1",
    actorName: "Grace Njeri",
    actorRole: "isp_owner",
    recipientMode: "OVERDUE_CUSTOMERS",
    messageType: "PAYMENT_REMINDER",
    category: "TRANSACTIONAL",
    messageTemplate:
      "Dear {{customer_name}}, your balance of {{amount_due}} is overdue. Support: {{support_contact}}",
    confirmed: true,
    isDemoMode: true,
  });
  assert.equal(confirmedBulk.ok, true);
  assert.ok((confirmedBulk.messagesDispatched?.length ?? 0) >= 1);
});

test("processSmsDeliveryWebhook updates delivery status and blocks duplicate replay attacks", () => {
  const history = getSmsHistory(DEMO_ORG_ID, undefined, true);
  const targetMsg = history.find((m) => m.providerMessageId);
  assert.ok(targetMsg?.providerMessageId);

  const firstHook = processSmsDeliveryWebhook({
    organizationId: DEMO_ORG_ID,
    webhookToken: "whsec_demo_99182",
    eventId: "evt-dlr-unique-001",
    providerMessageId: targetMsg.providerMessageId,
    status: "DELIVERED",
  });
  assert.equal(firstHook.ok, true);
  assert.equal(firstHook.updatedMessage?.status, "DELIVERED");

  const replayHook = processSmsDeliveryWebhook({
    organizationId: DEMO_ORG_ID,
    webhookToken: "whsec_demo_99182",
    eventId: "evt-dlr-unique-001",
    providerMessageId: targetMsg.providerMessageId,
    status: "DELIVERED",
  });
  assert.equal(replayHook.ok, false);
  assert.equal(replayHook.code, "REPLAY_DETECTED");
});

// ============================================================================
// 6. RBAC, TENANT ISOLATION & SECRET PROTECTION
// ============================================================================

test("RBAC permissions for SMS are strictly enforced across roles", () => {
  assert.equal(hasPermission("isp_owner", "sms.send_bulk"), true);
  assert.equal(hasPermission("isp_owner", "sms.manage_provider"), true);
  assert.equal(hasPermission("finance", "sms.send_bulk"), true);
  assert.equal(hasPermission("finance", "sms.manage_provider"), false);
  assert.equal(hasPermission("support", "sms.send"), true);
  assert.equal(hasPermission("support", "sms.send_bulk"), false);
  assert.equal(hasPermission("technician", "sms.send"), false);
  assert.equal(hasPermission("auditor", "sms.view_history"), true);
  assert.equal(hasPermission("auditor", "sms.send"), false);
  assert.equal(hasPermission("customer", "sms.view"), false);
});

test("Tenant isolation prevents Tenant B from viewing or targeting Tenant A customer phone numbers", () => {
  const tenantBMetrics = getSmsOverviewMetrics("org-other-tenant-999");
  assert.equal(tenantBMetrics.totalCustomers, 0);
  assert.equal(tenantBMetrics.customersWithValidPhone, 0);

  const tenantBPreview = previewSmsCampaign({
    organizationId: "org-other-tenant-999",
    recipientMode: "ALL_ELIGIBLE",
    category: "TRANSACTIONAL",
    messageTemplate: "Hello {{customer_name}}",
  });
  assert.equal(tenantBPreview.recipientCount, 0);
});

test("updateTenantSmsProviderConfig and client summary never leak SMS gateway API keys", () => {
  const updated = updateTenantSmsProviderConfig({
    organizationId: DEMO_ORG_ID,
    actorName: "Grace Njeri",
    actorRole: "isp_owner",
    provider: "AFRICAS_TALKING",
    senderId: "QCNETCORE",
    username: "qcnetcore_prod",
    apiKey: "AT_SUPER_SECRET_LIVE_KEY_998877",
    isEnabled: true,
  });

  assert.equal(updated.ok, true);
  assert.ok(updated.config);
  const serialized = JSON.stringify(updated.config);
  assert.equal(updated.config.hasApiKey, true);
  assert.ok(!serialized.includes("AT_SUPER_SECRET_LIVE_KEY_998877"));
  assert.ok(!("apiKey" in updated.config));
});

// ============================================================================
// 7. AI COPILOT SMS QUERIES & CONFIRMATION-GATED CAMPAIGN PROPOSALS
// ============================================================================

test("AI Copilot answers SMS reachability and sent-count questions from live SMS records", () => {
  const res = runCopilotQuery(
    "How many customers have valid phone numbers and can receive SMS?"
  );
  assert.equal(res.intent, "SMS_COMMUNICATIONS_QUERY");
  assert.ok(res.toolsInvoked?.includes("getSmsMetrics"));
  assert.ok(res.answerMarkdown.includes("Customers with Valid Phone Numbers"));
});

test("AI Copilot prepares confirmation-gated bulk SMS campaign and never dispatches without confirmation", () => {
  const res = runCopilotQuery(
    "Send a payment reminder to customers with overdue balances."
  );
  assert.equal(res.intent, "SMS_CAMPAIGN_PROPOSAL");
  assert.ok(res.toolsInvoked?.includes("previewSmsCampaignTool"));
  assert.ok(res.answerMarkdown.includes("No SMS messages have been sent yet"));
  assert.ok(res.proposedActions.length > 0);
  assert.equal(res.proposedActions[0].requiresConfirmation, true);
  assert.equal(res.proposedActions[0].permissionRequired, "sms.send_bulk");

  // Role without sms.send_bulk is denied
  const denied = runCopilotQuery(
    "Send a payment reminder to customers with overdue balances.",
    undefined,
    undefined,
    { userRole: "technician" }
  );
  assert.equal(denied.intent, "PERMISSION_DENIED");
});
