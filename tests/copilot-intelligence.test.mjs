import test from "node:test";
import assert from "node:assert/strict";
import {
  runCopilotQuery,
  executeCopilotIntelligence,
} from "../src/lib/ai/copilot.ts";
import {
  CopilotToolkit,
  redactSecrets,
  getCopilotAuditLog,
} from "../src/lib/ai/copilot-tools.ts";
import { buildDemoCopilotEnvironment } from "../src/lib/ai/live-data-loader.ts";

test("Subscriber Intelligence: 'Who is our newest subscriber?' invokes getNewestSubscriber and returns clean plain-text enriched context", () => {
  const res = runCopilotQuery("Who is our newest subscriber?");
  assert.equal(res.intent, "NEWEST_SUBSCRIBER_LOOKUP");
  assert.ok(res.toolsInvoked?.includes("getNewestSubscriber"));
  // In SEED_CUSTOMERS, Ahmed Hassan Omar (2025-02-01) is the most recently registered subscriber
  assert.match(res.answerMarkdown, /Ahmed Hassan Omar/);
  assert.match(res.answerMarkdown, /GT-8925/);
  assert.match(res.answerMarkdown, /Package:/);
  assert.match(res.answerMarkdown, /Status:/);
  assert.match(res.answerMarkdown, /POP:/);
  assert.match(res.answerMarkdown, /Balance due:/i);
  // Strict plain text: no Markdown bold, headings, backticks, or raw debug metadata
  assert.doesNotMatch(res.answerMarkdown, /\*\*|###|`|Sources:|Environment:/);

  // Oldest subscriber check
  const oldest = runCopilotQuery("Who is our oldest subscriber?");
  assert.equal(oldest.intent, "NEWEST_SUBSCRIBER_LOOKUP");
  assert.ok(oldest.toolsInvoked?.includes("getOldestSubscriber"));
  assert.match(oldest.answerMarkdown, /John Kamau Mwangi/);
  assert.match(oldest.answerMarkdown, /GT-8921/);
  assert.doesNotMatch(oldest.answerMarkdown, /\*\*|###|`/);

  // Top 10 newest subscribers check (clean numbered list, no Markdown pipe tables)
  const top10 = runCopilotQuery("Who are our 10 newest subscribers?");
  assert.equal(top10.intent, "NEWEST_SUBSCRIBER_LOOKUP");
  assert.match(top10.answerMarkdown, /1\. Customer: Ahmed Hassan Omar/);
  assert.doesNotMatch(top10.answerMarkdown, /\| # \| Subscriber \|/);
});

test("Concise Simple Questions & AI Feature Discovery", () => {
  const activeCount = runCopilotQuery("How many active subscribers do we have?");
  assert.match(
    activeCount.answerMarkdown,
    /There are \d+ active subscribers out of \d+ total subscribers\./
  );
  assert.doesNotMatch(activeCount.answerMarkdown, /\*\*|###|`/);

  const offlineRouters = runCopilotQuery("Which routers are offline?");
  assert.match(offlineRouters.answerMarkdown, /No routers are currently offline/i);

  const whatCanDo = runCopilotQuery("What can QC NetCore do?");
  assert.equal(whatCanDo.intent, "FEATURE_AND_NAVIGATION_GUIDE");
  assert.match(whatCanDo.answerMarkdown, /Network Operations:/);
  assert.match(whatCanDo.answerMarkdown, /Billing and Payments:/);
  assert.match(whatCanDo.answerMarkdown, /Subscriber Management:/);
  assert.match(whatCanDo.answerMarkdown, /Hotspot and Captive Portal:/);
  assert.match(whatCanDo.answerMarkdown, /SMS Communications:/);
  assert.doesNotMatch(whatCanDo.answerMarkdown, /\*\*|###|`|\/api\/v1\//);
});

test("Conversational Context & Follow-up Pronoun Resolution across multi-turn questions", () => {
  // Turn 1: Ask about John Kamau
  const turn1 = runCopilotQuery("Tell me about John Kamau");
  assert.ok(turn1.conversationContext?.lastSubscriberId);
  assert.equal(turn1.conversationContext?.lastAccountNumber, "GT-8921");

  const mem = turn1.conversationContext;

  // Turn 2: "What package is that customer using?"
  const turn2 = runCopilotQuery("What package is that customer using?", undefined, mem);
  assert.equal(turn2.intent, "CONTEXTUAL_FOLLOW_UP");
  assert.match(turn2.answerMarkdown, /John Kamau Mwangi/);
  assert.match(turn2.answerMarkdown, /Silver Fiber - 10 Mbps/);

  // Turn 3: "What is their IP?"
  const turn3 = runCopilotQuery("What is their IP?", undefined, turn2.conversationContext);
  assert.equal(turn3.intent, "CONTEXTUAL_FOLLOW_UP");
  assert.match(turn3.answerMarkdown, /10\.10\.12\.45/);

  // Turn 4: "Are they online?"
  const turn4 = runCopilotQuery("Are they online?", undefined, turn3.conversationContext);
  assert.equal(turn4.intent, "CONTEXTUAL_FOLLOW_UP");
  assert.match(turn4.answerMarkdown, /ONLINE/);

  // Turn 5: "When did they last pay?"
  const turn5 = runCopilotQuery("When did they last pay?", undefined, turn4.conversationContext);
  assert.equal(turn5.intent, "CONTEXTUAL_FOLLOW_UP");
  assert.ok(turn5.toolsInvoked?.includes("getCustomerPayments"));
  assert.match(turn5.answerMarkdown, /2,500/);
  assert.match(turn5.answerMarkdown, /RKF9283KDJ/);

  // Turn 6: "When does their service expire?"
  const turn6 = runCopilotQuery(
    "When does their service expire?",
    undefined,
    turn5.conversationContext
  );
  assert.equal(turn6.intent, "CONTEXTUAL_FOLLOW_UP");
  assert.match(turn6.answerMarkdown, /Next Expiry Date:/i);
});

test("Financial, Overdue & Package Intelligence: overdue accounts, highest revenue package, and today's collections", () => {
  const overdue = runCopilotQuery("Who owes the most?");
  assert.equal(overdue.intent, "OVERDUE_ACCOUNTS_RANKING");
  assert.ok(overdue.toolsInvoked?.includes("getOverdueAccounts"));
  assert.match(overdue.answerMarkdown, /Ahmed Hassan Omar/);
  assert.match(overdue.answerMarkdown, /David Kipchumba Koech/);
  assert.doesNotMatch(overdue.answerMarkdown, /\*\*|###|`/);

  const popularPkg = runCopilotQuery("Which package has the most subscribers?");
  assert.equal(popularPkg.intent, "PACKAGE_ANALYTICS");
  assert.ok(popularPkg.toolsInvoked?.includes("searchPackages"));
  assert.match(popularPkg.answerMarkdown, /Hotspot 3 Hours Special/);

  const revenuePkg = runCopilotQuery("Which package generated the most revenue?");
  assert.equal(revenuePkg.intent, "PACKAGE_ANALYTICS");
  assert.ok(revenuePkg.toolsInvoked?.includes("getPackageRevenue"));
  assert.match(revenuePkg.answerMarkdown, /Silver Fiber - 10 Mbps/);

  const todayCol = runCopilotQuery("How much did we collect today?");
  assert.equal(todayCol.intent, "TODAYS_COLLECTIONS_SUMMARY");
  assert.ok(todayCol.toolsInvoked?.includes("getRevenueMetrics"));
  assert.match(todayCol.answerMarkdown, /Today's collections/);
});

test("Network, Router Sessions, Outages & Business Intelligence", () => {
  const onlineSubs = runCopilotQuery("Which customers are currently online?");
  assert.equal(onlineSubs.intent, "SUBSCRIBER_LIST_FILTER");
  assert.ok(onlineSubs.toolsInvoked?.includes("getActivePPPoESessions"));
  assert.match(onlineSubs.answerMarkdown, /John Kamau Mwangi/);
  assert.match(onlineSubs.answerMarkdown, /Grace Njeri Otieno/);

  const topRouter = runCopilotQuery("Which router has the most active sessions?");
  assert.equal(topRouter.intent, "ROUTER_SESSIONS_AND_HEALTH");
  assert.ok(topRouter.toolsInvoked?.includes("getRouterSessions"));
  assert.match(topRouter.answerMarkdown, /MikroTik-Core-CCR2004/);
  assert.match(topRouter.answerMarkdown, /62/);

  const outages = runCopilotQuery("Are there any active outages? Which customers are affected?");
  assert.equal(outages.intent, "NETWORK_AND_OUTAGE_STATUS");
  assert.ok(outages.toolsInvoked?.includes("getNetworkIncidents"));
  assert.match(outages.answerMarkdown, /David Kipchumba Koech/);
  assert.match(outages.answerMarkdown, /-28\.4 dBm/);

  const bizPerf = runCopilotQuery("How is the business performing?");
  assert.equal(bizPerf.intent, "BUSINESS_PERFORMANCE_SUMMARY");
  assert.match(bizPerf.answerMarkdown, /Monthly Recurring Revenue/);
  assert.match(bizPerf.answerMarkdown, /Subscriber Base/);
});

test("Software-Awareness Layer: Feature Explanation & Navigation Assistance", () => {
  const pppoeHow = runCopilotQuery("How does PPPoE billing work?");
  assert.equal(pppoeHow.intent, "FEATURE_AND_NAVIGATION_GUIDE");
  assert.match(pppoeHow.answerMarkdown, /Service Plans and Billing sections/);
  assert.match(pppoeHow.answerMarkdown, /PPPoE/);
  assert.doesNotMatch(pppoeHow.answerMarkdown, /\/api\/v1\//);

  const captiveWhere = runCopilotQuery("Where do I configure the captive portal?");
  assert.equal(captiveWhere.intent, "FEATURE_AND_NAVIGATION_GUIDE");
  assert.match(captiveWhere.answerMarkdown, /Captive Portal Settings and Vouchers sections/);

  const addSubHow = runCopilotQuery("How do I add a subscriber?");
  assert.equal(addSubHow.intent, "FEATURE_AND_NAVIGATION_GUIDE");
  assert.match(addSubHow.answerMarkdown, /Subscribers section/);
});

test("Multi-Tenant Security, RBAC Enforcement, Secret Redaction & Audit Logging", () => {
  // 1. Secret Redaction
  const sanitized = redactSecrets({
    username: "gt_john",
    passwordPlain: "SuperSecret123",
    supabaseServiceRole: "eyJ-secret",
    nested: { apiKey: "secret-api-key", safeField: "visible" },
  });
  assert.equal(sanitized.username, "gt_john");
  assert.equal("passwordPlain" in sanitized, false);
  assert.equal("supabaseServiceRole" in sanitized, false);
  assert.equal("apiKey" in sanitized.nested, false);
  assert.equal(sanitized.nested.safeField, "visible");

  // 2. Direct prompt asking for passwords/keys is refused
  const secretQuery = runCopilotQuery("What is the router password and Supabase service key?");
  assert.equal(secretQuery.intent, "SECURITY_POLICY_REFUSAL");
  assert.match(secretQuery.answerMarkdown, /never exposes passwords/i);

  // 3. RBAC enforcement: 'technician' role does not have 'billing.view'
  const techBillingQuery = runCopilotQuery(
    "Who owes the most?",
    undefined,
    undefined,
    { userRole: "technician" }
  );
  assert.equal(techBillingQuery.intent, "PERMISSION_DENIED");
  assert.match(techBillingQuery.answerMarkdown, /You don't have permission/i);

  // 4. Multi-tenant isolation: Tenant A cannot see Tenant B customers
  const env = buildDemoCopilotEnvironment({ organizationId: "org-nexanet-01" });
  env.dataset.customers.push({
    id: "cust-foreign-99",
    organizationId: "org-other-tenant-99",
    accountNumber: "FOREIGN-9999",
    fullName: "Foreign Tenant Subscriber",
    phoneNumber: "0700999999",
    status: "ACTIVE",
    balanceDue: 0,
    createdAt: new Date(Date.now() + 86400000).toISOString(),
  });

  const isolatedRes = executeCopilotIntelligence({
    prompt: "Who is our newest subscriber?",
    ctx: env.ctx,
    dataset: env.dataset,
  });
  assert.ok(!isolatedRes.answerMarkdown.includes("Foreign Tenant Subscriber"));
  assert.ok(!isolatedRes.answerMarkdown.includes("FOREIGN-9999"));

  // 5. Audit log records AI tool usage
  const audits = getCopilotAuditLog("org-nexanet-01");
  assert.ok(audits.length > 0);
  assert.ok(Array.isArray(audits[0].toolsInvoked));
});
