// ============================================================================
// QC NETCORE — MULTI-CHANNEL PAYMENT RECONCILIATION & MAKER-CHECKER ENGINE
// Deterministic payment matching, over/under/partial allocation, idempotency,
// and dual-authorization Maker-Checker workflow enforcement.
// ============================================================================

export type ReconciliationMatchStatus =
  | "MATCHED"
  | "PARTIAL"
  | "OVERPAYMENT"
  | "UNMATCHED"
  | "DUPLICATE"
  | "MANUALLY_RESOLVED";

export interface IncomingPaymentEvent {
  transactionReference: string;
  channel: string;
  amount: number;
  msisdnPhone?: string;
  accountReference?: string;
  senderName?: string;
  receivedAt?: string;
}

export interface ReconcilableSubscriber {
  id: string;
  accountNumber: string;
  fullName: string;
  phoneNumber: string;
  altPhoneNumber?: string;
  balanceDue: number;
  planPrice?: number;
}

export interface ReconcilableInvoice {
  id: string;
  customerId: string;
  invoiceNumber: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID";
}

export interface PaymentReconciliationResult {
  transactionReference: string;
  channel: string;
  amount: number;
  matchStatus: ReconciliationMatchStatus;
  matchConfidence: number;
  matchedBy?: "ACCOUNT_NUMBER" | "PHONE_NUMBER" | "SENDER_NAME" | "NONE";
  matchedCustomerId?: string;
  matchedCustomerName?: string;
  matchedAccountNumber?: string;
  matchedInvoiceId?: string;
  allocatedToInvoice: number;
  creditedToWallet: number;
  remainingInvoiceBalance: number;
  shouldAutoReconnect: boolean;
  discrepancyReason?: string;
}

export function normalizeKenyanMsisdn(raw?: string | null): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) {
    return "254" + digits.slice(1);
  }
  if (digits.startsWith("7") && digits.length === 9) {
    return "254" + digits;
  }
  if (digits.startsWith("1") && digits.length === 9) {
    return "254" + digits;
  }
  return digits;
}

export function normalizeAccountRef(raw?: string | null): string {
  if (!raw) return "";
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, "");
  // Normalize "GT8921" -> "GT-8921"
  const m = cleaned.match(/^([A-Z]{2,4})-?(\d{3,6})$/);
  if (m) return `${m[1]}-${m[2]}`;
  return cleaned;
}

/**
 * Reconciles an incoming payment against subscribers, open invoices, and
 * previously processed transaction references (for idempotency).
 */
export function reconcileIncomingPayment(params: {
  payment: IncomingPaymentEvent;
  subscribers: ReconcilableSubscriber[];
  openInvoices: ReconcilableInvoice[];
  processedReferences?: Set<string> | string[];
}): PaymentReconciliationResult {
  const { payment, subscribers, openInvoices } = params;
  const refUpper = payment.transactionReference.trim().toUpperCase();
  const amount = Math.round((Number(payment.amount) || 0) * 100) / 100;

  const seenSet =
    params.processedReferences instanceof Set
      ? params.processedReferences
      : new Set((params.processedReferences || []).map((r) => r.trim().toUpperCase()));

  if (seenSet.has(refUpper)) {
    return {
      transactionReference: refUpper,
      channel: payment.channel,
      amount,
      matchStatus: "DUPLICATE",
      matchConfidence: 100,
      matchedBy: "NONE",
      allocatedToInvoice: 0,
      creditedToWallet: 0,
      remainingInvoiceBalance: 0,
      shouldAutoReconnect: false,
      discrepancyReason: `Duplicate callback reference ${refUpper} ignored (idempotency guard).`,
    };
  }

  const normRef = normalizeAccountRef(payment.accountReference);
  const normPhone = normalizeKenyanMsisdn(payment.msisdnPhone);
  const normSender = (payment.senderName || "").trim().toLowerCase();

  let matchedSub: ReconcilableSubscriber | undefined;
  let matchedBy: "ACCOUNT_NUMBER" | "PHONE_NUMBER" | "SENDER_NAME" | "NONE" = "NONE";
  let confidence = 0;

  // 1. Exact Account Number Match
  if (normRef) {
    matchedSub = subscribers.find(
      (s) => normalizeAccountRef(s.accountNumber) === normRef
    );
    if (matchedSub) {
      matchedBy = "ACCOUNT_NUMBER";
      confidence = 100;
    }
  }

  // 2. Fallback: MSISDN Phone Number Match
  if (!matchedSub && normPhone) {
    matchedSub = subscribers.find(
      (s) =>
        normalizeKenyanMsisdn(s.phoneNumber) === normPhone ||
        normalizeKenyanMsisdn(s.altPhoneNumber) === normPhone
    );
    if (matchedSub) {
      matchedBy = "PHONE_NUMBER";
      confidence = 92;
    }
  }

  // 3. Fallback: Sender Name Token Match (requires >= 2 matching name tokens)
  if (!matchedSub && normSender.length >= 5) {
    const senderTokens = normSender.split(/\s+/).filter((t) => t.length >= 3);
    if (senderTokens.length >= 2) {
      matchedSub = subscribers.find((s) => {
        const subLower = s.fullName.toLowerCase();
        const hits = senderTokens.filter((tok) => subLower.includes(tok));
        return hits.length >= 2;
      });
      if (matchedSub) {
        matchedBy = "SENDER_NAME";
        confidence = 78;
      }
    }
  }

  if (!matchedSub) {
    return {
      transactionReference: refUpper,
      channel: payment.channel,
      amount,
      matchStatus: "UNMATCHED",
      matchConfidence: 0,
      matchedBy: "NONE",
      allocatedToInvoice: 0,
      creditedToWallet: 0,
      remainingInvoiceBalance: 0,
      shouldAutoReconnect: false,
      discrepancyReason: `No subscriber matched account "${
        payment.accountReference || "—"
      }" or phone "${payment.msisdnPhone || "—"}". Queued for manual reconciliation.`,
    };
  }

  // Find oldest open invoice for this subscriber, or use subscriber balanceDue / planPrice
  const subInvoices = openInvoices.filter(
    (inv) =>
      inv.customerId === matchedSub!.id &&
      inv.status !== "PAID" &&
      inv.status !== "VOID" &&
      inv.balanceDue > 0
  );
  const targetInvoice = subInvoices[0];
  const targetDue =
    targetInvoice?.balanceDue ??
    (matchedSub.balanceDue > 0
      ? matchedSub.balanceDue
      : matchedSub.planPrice || amount);

  if (Math.abs(amount - targetDue) < 0.01) {
    return {
      transactionReference: refUpper,
      channel: payment.channel,
      amount,
      matchStatus: "MATCHED",
      matchConfidence: confidence,
      matchedBy,
      matchedCustomerId: matchedSub.id,
      matchedCustomerName: matchedSub.fullName,
      matchedAccountNumber: matchedSub.accountNumber,
      matchedInvoiceId: targetInvoice?.id,
      allocatedToInvoice: amount,
      creditedToWallet: 0,
      remainingInvoiceBalance: 0,
      shouldAutoReconnect: true,
    };
  }

  if (amount > targetDue) {
    const walletCredit = Math.round((amount - targetDue) * 100) / 100;
    return {
      transactionReference: refUpper,
      channel: payment.channel,
      amount,
      matchStatus: "OVERPAYMENT",
      matchConfidence: confidence,
      matchedBy,
      matchedCustomerId: matchedSub.id,
      matchedCustomerName: matchedSub.fullName,
      matchedAccountNumber: matchedSub.accountNumber,
      matchedInvoiceId: targetInvoice?.id,
      allocatedToInvoice: targetDue,
      creditedToWallet: walletCredit,
      remainingInvoiceBalance: 0,
      shouldAutoReconnect: true,
      discrepancyReason: `Overpayment of KES ${walletCredit.toLocaleString()} credited to subscriber wallet.`,
    };
  }

  // Partial payment (amount < targetDue)
  const remaining = Math.round((targetDue - amount) * 100) / 100;
  return {
    transactionReference: refUpper,
    channel: payment.channel,
    amount,
    matchStatus: "PARTIAL",
    matchConfidence: confidence,
    matchedBy,
    matchedCustomerId: matchedSub.id,
    matchedCustomerName: matchedSub.fullName,
    matchedAccountNumber: matchedSub.accountNumber,
    matchedInvoiceId: targetInvoice?.id,
    allocatedToInvoice: amount,
    creditedToWallet: 0,
    remainingInvoiceBalance: remaining,
    shouldAutoReconnect: false,
    discrepancyReason: `Partial payment received. Remaining balance KES ${remaining.toLocaleString()} required for auto-reconnection.`,
  };
}

// ============================================================================
// MAKER-CHECKER DUAL AUTHORIZATION WORKFLOW ENGINE
// ============================================================================

export type ApprovalActionType =
  | "REFUND"
  | "CREDIT_NOTE"
  | "WAIVER"
  | "BALANCE_OVERRIDE"
  | "BULK_DISCONNECT"
  | "ROUTER_SCRIPT_PUSH";

export interface ApprovalRequestRecord {
  id: string;
  organizationId: string;
  requestNumber: string;
  actionType: ApprovalActionType;
  targetEntityType: string;
  targetEntityId: string;
  targetLabel: string;
  amount?: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  requestedById: string;
  requestedByName: string;
  requestedByRole: string;
  decidedById?: string;
  decidedByName?: string;
  decisionNote?: string;
  decidedAt?: string;
  createdAt: string;
}

export const APPROVAL_THRESHOLD_KES = 1000;

/**
 * Determines whether a sensitive financial or network action requires Maker-Checker approval.
 */
export function requiresDualApproval(params: {
  actionType: ApprovalActionType;
  amount?: number;
  actorRole: string;
}): { required: boolean; reason: string } {
  const { actionType, amount = 0 } = params;

  if (actionType === "REFUND" || actionType === "BALANCE_OVERRIDE") {
    return {
      required: true,
      reason: `${actionType.replace("_", " ")} always requires dual authorization (Maker-Checker policy).`,
    };
  }

  if (
    (actionType === "CREDIT_NOTE" || actionType === "WAIVER") &&
    amount >= APPROVAL_THRESHOLD_KES
  ) {
    return {
      required: true,
      reason: `${actionType.replace("_", " ")} >= KES ${APPROVAL_THRESHOLD_KES.toLocaleString()} requires dual approval.`,
    };
  }

  if (actionType === "BULK_DISCONNECT") {
    return {
      required: true,
      reason: "Bulk subscriber disconnection requires supervisor approval.",
    };
  }

  return {
    required: false,
    reason: "Below dual-authorization threshold.",
  };
}

/**
 * Validates and transitions an ApprovalRequestRecord.
 * Enforces strict Maker-Checker separation: the approver cannot be the requester.
 */
export function decideApprovalRequest(params: {
  request: ApprovalRequestRecord;
  decision: "APPROVED" | "REJECTED";
  decidedById: string;
  decidedByName: string;
  decidedByRole: string;
  decisionNote?: string;
  decidedAt?: string;
}): ApprovalRequestRecord {
  const { request, decision, decidedById, decidedByName, decidedByRole } = params;

  if (request.status !== "PENDING") {
    throw new Error(`Approval request ${request.requestNumber} is already ${request.status}.`);
  }

  const allowedApproverRoles = new Set(["super_admin", "isp_owner", "isp_admin", "finance"]);
  if (!allowedApproverRoles.has(decidedByRole)) {
    throw new Error(`Role "${decidedByRole}" is not authorized to decide approval requests.`);
  }

  if (decidedById === request.requestedById) {
    throw new Error(
      "Maker-Checker violation: The operator who requested an action cannot approve or reject their own request."
    );
  }

  return {
    ...request,
    status: decision,
    decidedById,
    decidedByName,
    decisionNote: params.decisionNote || (decision === "APPROVED" ? "Approved per policy" : "Rejected"),
    decidedAt: params.decidedAt || new Date().toISOString(),
  };
}
