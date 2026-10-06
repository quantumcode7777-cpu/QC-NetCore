import { NextResponse } from "next/server";
import {
  computeTrialBalance,
  computeArAgingBuckets,
  computeExecutiveRevenueMetrics,
  postCreditNoteToLedger,
} from "@/lib/ledger/ledger";
import {
  decideApprovalRequest,
  requiresDualApproval,
} from "@/lib/payments/reconciliation";
import {
  SEED_CUSTOMERS,
  SEED_PAYMENTS,
  SEED_ORGANIZATION,
} from "@/lib/db/mock-db";
import {
  SEED_INVOICES_2027,
  SEED_APPROVAL_REQUESTS,
  getSeedJournalEntries,
  getSeedReconciliationQueue,
} from "@/lib/db/os-2027-seed";

import { cookies } from "next/headers";
import { loadLiveOrDemoCopilotEnvironment } from "@/lib/ai/live-data-loader";

export async function GET() {
  const cookieStore = await cookies();
  const isDemo = cookieStore.get("gtech_demo_mode")?.value === "true";

  if (isDemo) {
    const journalEntries = getSeedJournalEntries();
    const trialBalance = computeTrialBalance(journalEntries);
    const arAging = computeArAgingBuckets(SEED_INVOICES_2027);
    const executiveMetrics = computeExecutiveRevenueMetrics({
      customers: SEED_CUSTOMERS.map((c) => ({
        id: c.id,
        status: c.status,
        balanceDue: c.balanceDue,
        planPrice: 2500,
      })),
      payments: SEED_PAYMENTS,
      trialBalance,
      arAging,
    });

    return NextResponse.json({
      success: true,
      data: {
        journalEntries,
        trialBalance,
        arAging,
        executiveMetrics,
        reconciliationQueue: getSeedReconciliationQueue(),
        approvalRequests: SEED_APPROVAL_REQUESTS,
        invoices: SEED_INVOICES_2027,
      },
    });
  }

  const env = await loadLiveOrDemoCopilotEnvironment({ explicitDemoMode: false });
  const journalEntries = env.dataset.journalEntries;
  const trialBalance = computeTrialBalance(journalEntries);
  const liveInvoicesForAging = env.dataset.invoices.map((inv) => ({
    ...inv,
    periodStart: inv.createdAt,
    periodEnd: inv.dueDate,
    lineItems: [],
  }));
  const arAging = computeArAgingBuckets(liveInvoicesForAging);
  const executiveMetrics = computeExecutiveRevenueMetrics({
    customers: env.dataset.customers.map((c) => {
      const sub = env.dataset.subscriptions.find((s) => s.customerId === c.id);
      const plan = env.dataset.plans.find((p) => p.id === sub?.planId);
      return {
        id: c.id,
        status: c.status,
        balanceDue: c.balanceDue,
        planPrice: plan?.price ?? 0,
      };
    }),
    payments: env.dataset.payments,
    trialBalance,
    arAging,
  });

  return NextResponse.json({
    success: true,
    data: {
      journalEntries,
      trialBalance,
      arAging,
      executiveMetrics,
      reconciliationQueue: [],
      approvalRequests: [],
      invoices: env.dataset.invoices,
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "POST_CREDIT_NOTE") {
      const { customerId, customerName, amount, reason, actorRole = "isp_owner" } = body;
      const numAmount = Number(amount);
      if (!customerName || !Number.isFinite(numAmount) || numAmount <= 0 || !reason) {
        return NextResponse.json(
          { success: false, error: "Customer, positive amount, and reason are required." },
          { status: 400 }
        );
      }

      const approvalCheck = requiresDualApproval({
        actionType: "CREDIT_NOTE",
        amount: numAmount,
        actorRole,
      });

      if (approvalCheck.required && actorRole !== "isp_owner" && actorRole !== "super_admin") {
        return NextResponse.json({
          success: true,
          queuedForApproval: true,
          message: approvalCheck.reason,
        });
      }

      const entry = postCreditNoteToLedger({
        organizationId: SEED_ORGANIZATION.id,
        entryNumber: `JE-CN-${Math.floor(1000 + Math.random() * 9000)}`,
        creditNoteId: `CN-${Date.now()}`,
        customerId: customerId || "cust-01",
        customerName,
        amount: numAmount,
        reason,
      });

      return NextResponse.json({
        success: true,
        queuedForApproval: false,
        data: entry,
      });
    }

    if (action === "DECIDE_APPROVAL") {
      const {
        requestId,
        decision,
        decidedById = "user-owner-01",
        decidedByName = "Baraka Gackstone",
        decidedByRole = "isp_owner",
        decisionNote,
      } = body;

      const target = SEED_APPROVAL_REQUESTS.find((r) => r.id === requestId);
      if (!target) {
        return NextResponse.json(
          { success: false, error: "Approval request not found." },
          { status: 404 }
        );
      }

      const updated = decideApprovalRequest({
        request: target,
        decision: decision === "REJECTED" ? "REJECTED" : "APPROVED",
        decidedById,
        decidedByName,
        decidedByRole,
        decisionNote,
      });

      return NextResponse.json({
        success: true,
        data: updated,
      });
    }

    return NextResponse.json(
      { success: false, error: "Unsupported ledger action." },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Operation failed.",
      },
      { status: 400 }
    );
  }
}
