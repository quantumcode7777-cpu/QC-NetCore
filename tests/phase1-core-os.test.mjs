import test from "node:test";
import assert from "node:assert/strict";

import {
  STANDARD_CHART_OF_ACCOUNTS,
  createBalancedJournalEntry,
  createReversalJournalEntry,
  postInvoiceToLedger,
  postPaymentToLedger,
  postCreditNoteToLedger,
  computeTrialBalance,
  computeArAgingBuckets,
  computeExecutiveRevenueMetrics,
} from "../src/lib/ledger/ledger.ts";

import {
  normalizeKenyanMsisdn,
  normalizeAccountRef,
  reconcileIncomingPayment,
  requiresDualApproval,
  decideApprovalRequest,
} from "../src/lib/payments/reconciliation.ts";

import {
  hasPermission,
  canManageTenant,
  listRolePermissions,
} from "../src/lib/auth/rbac.ts";

import {
  createSystemEvent,
  evaluateSocSignal,
} from "../src/lib/events/event-bus.ts";

import {
  DEFAULT_NOTIFICATION_TEMPLATES,
  renderNotificationTemplate,
  buildNotificationDispatch,
} from "../src/lib/communications/notifier.ts";

import {
  computeConnectionQualityScore,
  predictSubscriberChurnRisk,
} from "../src/lib/intelligence/subscriber-360.ts";

test("Double-Entry Ledger: enforces balanced debits and credits and computes balanced Trial Balance", () => {
  assert.ok(STANDARD_CHART_OF_ACCOUNTS.length >= 10);

  // Reject unbalanced journal entry
  assert.throws(() => {
    createBalancedJournalEntry({
      organizationId: "org-1",
      entryNumber: "JE-UNBAL",
      referenceType: "ADJUSTMENT",
      referenceId: "adj-1",
      description: "Unbalanced test",
      lines: [
        { accountCode: "1100", debit: 2500, credit: 0 },
        { accountCode: "4100", debit: 0, credit: 2000 },
      ],
    });
  }, /Unbalanced journal entry/);

  // Post Invoice (KES 2500 subtotal + 400 VAT = 2900 AR)
  const invEntry = postInvoiceToLedger({
    organizationId: "org-1",
    entryNumber: "JE-0001",
    invoiceId: "inv-01",
    invoiceNumber: "INV-2026-001",
    customerId: "cust-01",
    customerName: "John Kamau",
    subtotal: 2500,
    taxAmount: 400,
  });

  assert.equal(invEntry.totalDebit, 2900);
  assert.equal(invEntry.totalCredit, 2900);

  // Post Payment with Overpayment (KES 3000 paid -> 2900 AR + 100 Wallet credit)
  const payEntry = postPaymentToLedger({
    organizationId: "org-1",
    entryNumber: "JE-0002",
    paymentId: "pay-01",
    transactionReference: "RKF9283KDJ",
    customerId: "cust-01",
    customerName: "John Kamau",
    totalAmount: 3000,
    allocatedToAr: 2900,
    creditedToWallet: 100,
  });

  assert.equal(payEntry.totalDebit, 3000);
  assert.equal(payEntry.totalCredit, 3000);

  // Post Credit Note
  const cnEntry = postCreditNoteToLedger({
    organizationId: "org-1",
    entryNumber: "JE-0003",
    creditNoteId: "CN-01",
    customerId: "cust-02",
    customerName: "Grace Njeri",
    amount: 500,
    reason: "SLA outage goodwill credit",
  });

  // Trial Balance across all 3 entries must balance to the cent
  const tb = computeTrialBalance([invEntry, payEntry, cnEntry]);
  assert.equal(tb.isBalanced, true);
  assert.equal(tb.discrepancy, 0);
  assert.equal(tb.totalDebits, 6400);
  assert.equal(tb.totalCredits, 6400);

  // Reversal entry swaps debits and credits and preserves Trial Balance
  const { reversedOriginal, reversalEntry } = createReversalJournalEntry(
    cnEntry,
    "JE-0004-REV",
    "Erroneous credit note"
  );
  assert.equal(reversedOriginal.status, "REVERSED");
  assert.equal(reversalEntry.totalDebit, 500);
  assert.equal(reversalEntry.totalCredit, 500);

  const tbAfterReversal = computeTrialBalance([
    invEntry,
    payEntry,
    reversedOriginal,
    reversalEntry,
  ]);
  assert.equal(tbAfterReversal.isBalanced, true);
});

test("AR Aging & Executive Revenue Intelligence: classifies overdue invoices into 0-30, 31-60, 61-90, 90+ buckets", () => {
  const refDate = new Date("2026-10-04T00:00:00Z");
  const invoices = [
    { id: "1", balanceDue: 2500, dueDate: "2026-09-20T00:00:00Z", status: "OVERDUE" }, // 14d -> 0-30
    { id: "2", balanceDue: 4000, dueDate: "2026-08-15T00:00:00Z", status: "OVERDUE" }, // 50d -> 31-60
    { id: "3", balanceDue: 1500, dueDate: "2026-07-15T00:00:00Z", status: "OVERDUE" }, // 81d -> 61-90
    { id: "4", balanceDue: 5000, dueDate: "2026-05-01T00:00:00Z", status: "OVERDUE" }, // 156d -> 90+
  ];

  const aging = computeArAgingBuckets(invoices, refDate);
  assert.equal(aging.totalOutstanding, 13000);
  assert.equal(aging.overdueCount, 4);
  assert.equal(aging.buckets.find((b) => b.bucket === "0-30")?.totalBalanceDue, 2500);
  assert.equal(aging.buckets.find((b) => b.bucket === "31-60")?.totalBalanceDue, 4000);
  assert.equal(aging.buckets.find((b) => b.bucket === "61-90")?.totalBalanceDue, 1500);
  assert.equal(aging.buckets.find((b) => b.bucket === "90+")?.totalBalanceDue, 5000);

  const tb = computeTrialBalance([]);
  const exec = computeExecutiveRevenueMetrics({
    customers: [
      { id: "c1", status: "ACTIVE", balanceDue: 0, planPrice: 2500 },
      { id: "c2", status: "ACTIVE", balanceDue: 0, planPrice: 4000 },
      { id: "c3", status: "SUSPENDED", balanceDue: 2500, planPrice: 2500 },
    ],
    payments: [{ amount: 6500, status: "COMPLETED" }],
    trialBalance: tb,
    arAging: aging,
  });

  assert.equal(exec.mrr, 6500);
  assert.equal(exec.arr, 78000);
  assert.equal(exec.arpu, 3250);
  assert.equal(exec.badDebtExposure, 5000);
});

test("Multi-Channel Payment Reconciliation: handles exact, overpayment, partial, unmatched, and duplicate callbacks", () => {
  assert.equal(normalizeKenyanMsisdn("0799112233"), "254799112233");
  assert.equal(normalizeAccountRef("gt 8921"), "GT-8921");

  const subscribers = [
    {
      id: "cust-01",
      accountNumber: "GT-8921",
      fullName: "John Kamau Mwangi",
      phoneNumber: "0799112233",
      balanceDue: 2500,
      planPrice: 2500,
    },
  ];
  const openInvoices = [
    {
      id: "inv-01",
      customerId: "cust-01",
      invoiceNumber: "INV-01",
      totalAmount: 2500,
      amountPaid: 0,
      balanceDue: 2500,
      status: "UNPAID",
    },
  ];

  // 1. Exact Match by normalized account reference
  const exact = reconcileIncomingPayment({
    payment: {
      transactionReference: "RKF1001AAA",
      channel: "MPESA_C2B",
      amount: 2500,
      accountReference: "gt8921",
      msisdnPhone: "0799112233",
    },
    subscribers,
    openInvoices,
  });
  assert.equal(exact.matchStatus, "MATCHED");
  assert.equal(exact.allocatedToInvoice, 2500);
  assert.equal(exact.creditedToWallet, 0);
  assert.equal(exact.shouldAutoReconnect, true);

  // 2. Overpayment matched by phone number when account ref is mistyped
  const overpay = reconcileIncomingPayment({
    payment: {
      transactionReference: "RKF1002BBB",
      channel: "MPESA_C2B",
      amount: 3200,
      accountReference: "WRONG",
      msisdnPhone: "+254799112233",
    },
    subscribers,
    openInvoices,
  });
  assert.equal(overpay.matchStatus, "OVERPAYMENT");
  assert.equal(overpay.matchedBy, "PHONE_NUMBER");
  assert.equal(overpay.allocatedToInvoice, 2500);
  assert.equal(overpay.creditedToWallet, 700);
  assert.equal(overpay.shouldAutoReconnect, true);

  // 3. Partial payment
  const partial = reconcileIncomingPayment({
    payment: {
      transactionReference: "RKF1003CCC",
      channel: "AIRTEL_MONEY",
      amount: 1000,
      accountReference: "GT-8921",
    },
    subscribers,
    openInvoices,
  });
  assert.equal(partial.matchStatus, "PARTIAL");
  assert.equal(partial.remainingInvoiceBalance, 1500);
  assert.equal(partial.shouldAutoReconnect, false);

  // 4. Duplicate reference idempotency guard
  const dup = reconcileIncomingPayment({
    payment: {
      transactionReference: "RKF1001AAA",
      channel: "MPESA_C2B",
      amount: 2500,
      accountReference: "GT-8921",
    },
    subscribers,
    openInvoices,
    processedReferences: ["RKF1001AAA"],
  });
  assert.equal(dup.matchStatus, "DUPLICATE");

  // 5. Unmatched payment queued for manual resolution
  const unmatched = reconcileIncomingPayment({
    payment: {
      transactionReference: "RKF1004DDD",
      channel: "BANK_TRANSFER",
      amount: 4000,
      accountReference: "UNKNOWN-99",
      msisdnPhone: "0700000000",
    },
    subscribers,
    openInvoices,
  });
  assert.equal(unmatched.matchStatus, "UNMATCHED");
});

test("Maker-Checker & RBAC: enforces dual authorization and prevents self-approval", () => {
  const check1 = requiresDualApproval({
    actionType: "CREDIT_NOTE",
    amount: 2500,
    actorRole: "support",
  });
  assert.equal(check1.required, true);

  const reqRecord = {
    id: "apr-01",
    organizationId: "org-1",
    requestNumber: "APR-2026-001",
    actionType: "REFUND",
    targetEntityType: "customer",
    targetEntityId: "cust-01",
    targetLabel: "John Kamau (GT-8921)",
    amount: 2500,
    reason: "Duplicate M-Pesa transfer refund",
    status: "PENDING",
    requestedById: "user-support-1",
    requestedByName: "Alice Support",
    requestedByRole: "support",
    createdAt: new Date().toISOString(),
  };

  // Maker cannot approve own request
  assert.throws(() => {
    decideApprovalRequest({
      request: reqRecord,
      decision: "APPROVED",
      decidedById: "user-support-1",
      decidedByName: "Alice Support",
      decidedByRole: "isp_owner",
    });
  }, /Maker-Checker violation/);

  // Unauthorized role cannot approve
  assert.throws(() => {
    decideApprovalRequest({
      request: reqRecord,
      decision: "APPROVED",
      decidedById: "user-tech-1",
      decidedByName: "Brian Tech",
      decidedByRole: "technician",
    });
  }, /not authorized/);

  // Valid supervisor approval succeeds
  const decided = decideApprovalRequest({
    request: reqRecord,
    decision: "APPROVED",
    decidedById: "user-owner-1",
    decidedByName: "Baraka Owner",
    decidedByRole: "isp_owner",
    decisionNote: "Verified duplicate receipt RKF9283KDJ",
  });
  assert.equal(decided.status, "APPROVED");

  // RBAC checks
  assert.equal(hasPermission("noc_engineer", "olt.manage"), true);
  assert.equal(hasPermission("noc_engineer", "billing.refund"), false);
  assert.equal(hasPermission("auditor", "ledger.view"), true);
  assert.equal(hasPermission("auditor", "ledger.post"), false);
  assert.equal(canManageTenant("isp_owner"), true);
  assert.ok(listRolePermissions("finance").includes("approvals.decide"));
});

test("Event Bus, SOC, Communications & Subscriber 360 Intelligence", () => {
  const evt = createSystemEvent({
    organizationId: "org-1",
    eventType: "payment.reconciled",
    category: "BILLING",
    summary: "Payment RKF9283KDJ reconciled to GT-8921",
  });
  assert.equal(evt.category, "BILLING");

  const soc = evaluateSocSignal({
    organizationId: "org-1",
    signalType: "FAILED_AUTH_BURST",
    sourceIp: "197.232.61.99",
    count: 12,
  });
  assert.equal(soc.severity, "CRITICAL");
  assert.equal(soc.eventCode, "SOC_BRUTE_FORCE_DETECTED");

  const msg = renderNotificationTemplate(
    DEFAULT_NOTIFICATION_TEMPLATES[0].bodyTemplate,
    {
      amount: "2,500",
      reference: "RKF9283KDJ",
      account_number: "GT-8921",
      plan_name: "Silver Fiber - 10 Mbps",
      expiry_date: "04 Nov 2026",
      support_phone: "+254712345678",
    }
  );
  assert.ok(msg.includes("KES 2,500"));
  assert.ok(msg.includes("GT-8921"));

  const dispatch = buildNotificationDispatch({
    template: DEFAULT_NOTIFICATION_TEMPLATES[1],
    recipient: "+254799112233",
    customerName: "John Kamau",
    variables: {
      customer_name: "John Kamau",
      amount: "2,500",
      reference: "RKF9283KDJ",
      account_number: "GT-8921",
      plan_name: "Silver Fiber",
      expiry_date: "04 Nov 2026",
    },
  });
  assert.equal(dispatch.channel, "WHATSAPP");
  assert.equal(dispatch.status, "DELIVERED");

  // Subscriber 360 Quality & Churn
  const qGood = computeConnectionQualityScore({
    isOnline: true,
    latencyMs: 8,
    packetLossPercent: 0,
    opticalRxDbm: -19.2,
    sessionDropCount7d: 0,
    attainedSpeedRatio: 0.98,
  });
  assert.equal(qGood.tier, "EXCELLENT");
  assert.ok(qGood.score >= 90);

  const qDegraded = computeConnectionQualityScore({
    isOnline: false,
    latencyMs: 95,
    packetLossPercent: 6.2,
    opticalRxDbm: -28.9,
    sessionDropCount7d: 6,
    attainedSpeedRatio: 0.5,
  });
  assert.equal(qDegraded.tier, "POOR");
  assert.ok(qDegraded.diagnosticFlags.length >= 3);

  const churnHigh = predictSubscriberChurnRisk({
    status: "SUSPENDED",
    balanceDue: 2500,
    planPrice: 2500,
    daysUntilExpiry: -5,
    openSupportTickets: 2,
    connectionQualityScore: qDegraded.score,
  });
  assert.equal(churnHigh.riskTier, "CRITICAL");
  assert.ok(churnHigh.riskScore >= 75);
});
