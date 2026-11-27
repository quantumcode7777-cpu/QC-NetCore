import { NextRequest, NextResponse } from "next/server";
import { isDemoRequest, jsonError, type AnyClient } from "@/lib/captive/server";
import {
  accountRefFromRawPayload,
  buildUnmatchedViews,
  type UnmatchedPayment,
} from "@/lib/payments/gateway";
import { gatewayAdminError } from "@/lib/payments/gateway-server";
import { getOrgClient } from "@/lib/sites/server";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

async function dbClient(): Promise<AnyClient> {
  const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
  return createSupabaseServiceClient() as unknown as AnyClient;
}

function mapPayment(r: Row): UnmatchedPayment {
  return {
    id: String(r.id),
    transactionReference: String(r.transaction_reference),
    providerReceipt: str(r.provider_receipt),
    amount: num(r.amount),
    paymentMethod: String(r.payment_method),
    msisdnPhone: String(r.msisdn_phone ?? ""),
    senderName: str(r.sender_name),
    accountReference: accountRefFromRawPayload(r.raw_payload),
    customerId: str(r.customer_id),
    customerName: str(r.customer_name),
    invoiceId: str(r.invoice_id),
    createdAt: String(r.created_at),
  };
}

/** GET /api/v1/payment-gateway/unmatched — confirmed payments with no invoice. */
export async function GET() {
  if (await isDemoRequest()) {
    return NextResponse.json({ success: true, demo: true, data: [], customers: [], invoices: [] });
  }

  try {
    const ctx = await getOrgClient();
    if (!ctx.ok) return ctx.response;
    const db = await dbClient();

    const [paymentsRes, customersRes, invoicesRes] = await Promise.all([
      db
        .from("payments")
        .select(
          "id, transaction_reference, provider_receipt, amount, payment_method, msisdn_phone, sender_name, customer_id, invoice_id, raw_payload, created_at"
        )
        .eq("organization_id", ctx.orgId)
        .eq("status", "COMPLETED")
        .order("created_at", { ascending: false })
        .limit(500),
      db
        .from("customers")
        .select("id, account_number, full_name, phone_number, alt_phone_number")
        .eq("organization_id", ctx.orgId)
        .limit(2000),
      db
        .from("invoices")
        .select("id, customer_id, total_amount, amount_paid, balance_due, status, due_date")
        .eq("organization_id", ctx.orgId)
        .in("status", ["UNPAID", "PARTIALLY_PAID", "OVERDUE"])
        .order("created_at", { ascending: true })
        .limit(1000),
    ]);

    if (paymentsRes.error) throw paymentsRes.error;
    const warnings: string[] = [];
    if (customersRes.error) warnings.push(`customers: ${customersRes.error.message ?? "query failed"}`);
    if (invoicesRes.error) warnings.push(`invoices: ${invoicesRes.error.message ?? "query failed"}`);

    const payments = ((paymentsRes.data ?? []) as Row[])
      .map(mapPayment)
      .filter((p) => !p.invoiceId);
    const customers = ((customersRes.data ?? []) as Row[]).map((c) => ({
      id: String(c.id),
      accountNumber: String(c.account_number ?? ""),
      fullName: String(c.full_name ?? ""),
      phoneNumber: String(c.phone_number ?? ""),
      altPhoneNumber: str(c.alt_phone_number),
    }));
    const invoices = ((invoicesRes.data ?? []) as Row[]).map((i) => ({
      id: String(i.id),
      customerId: String(i.customer_id),
      invoiceNumber: String(i.id).slice(0, 8),
      totalAmount: num(i.total_amount),
      amountPaid: num(i.amount_paid),
      balanceDue: num(i.balance_due),
      status: String(i.status) as "UNPAID" | "PARTIALLY_PAID" | "OVERDUE",
    }));

    return NextResponse.json({
      success: true,
      data: buildUnmatchedViews(payments, customers, invoices),
      customers: customers.map((c) => ({ id: c.id, label: `${c.accountNumber} — ${c.fullName}` })),
      invoices: invoices.map((i) => ({
        id: i.id,
        customerId: i.customerId,
        label: `${i.invoiceNumber} · balance ${i.balanceDue.toFixed(2)}`,
      })),
      ...(warnings.length ? { warnings } : {}),
    });
  } catch (err) {
    console.error("[Payment gateway] unmatched inbox failed:", err);
    return jsonError(503, "UNMATCHED_UNAVAILABLE", "Could not load the unmatched payments inbox.");
  }
}

/** PATCH /api/v1/payment-gateway/unmatched — explicit manual allocation. */
export async function PATCH(req: NextRequest) {
  if (await isDemoRequest()) {
    return jsonError(403, "DEMO_READ_ONLY", "Payments cannot be reconciled in demo mode.");
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonError(400, "INVALID_REQUEST", "Request body must be JSON.");
  }
  const paymentId = String(body.paymentId ?? "").trim();
  const customerId = str(body.customerId);
  const invoiceId = str(body.invoiceId);
  if (!paymentId || (!customerId && !invoiceId)) {
    return jsonError(400, "INVALID_ALLOCATION", "Choose a customer or invoice for this payment.");
  }

  try {
    const ctx = await getOrgClient();
    if (!ctx.ok) return ctx.response;
    const denied = gatewayAdminError(ctx.role);
    if (denied) return denied;
    const db = await dbClient();

    const { data: payment, error: pErr } = await db
      .from("payments")
      .select("id, amount, customer_id, invoice_id, status")
      .eq("id", paymentId)
      .eq("organization_id", ctx.orgId)
      .maybeSingle();
    if (pErr || !payment) return jsonError(404, "PAYMENT_NOT_FOUND", "Payment not found.");
    if (payment.invoice_id) {
      return jsonError(409, "ALREADY_RECONCILED", "This payment is already linked to an invoice.");
    }
    if (payment.status !== "COMPLETED") {
      return jsonError(409, "PAYMENT_NOT_COMPLETED", "Only confirmed payments can be reconciled.");
    }

    if (customerId) {
      const { data: customer } = await db
        .from("customers")
        .select("id")
        .eq("id", customerId)
        .eq("organization_id", ctx.orgId)
        .maybeSingle();
      if (!customer) return jsonError(404, "CUSTOMER_NOT_FOUND", "Customer not found in this ISP.");
    }

    let invoiceBefore: Row | null = null;
    if (invoiceId) {
      const { data: invoice, error: iErr } = await db
        .from("invoices")
        .select("id, customer_id, total_amount, amount_paid, balance_due, status")
        .eq("id", invoiceId)
        .eq("organization_id", ctx.orgId)
        .maybeSingle();
      if (iErr || !invoice) return jsonError(404, "INVOICE_NOT_FOUND", "Invoice not found in this ISP.");
      invoiceBefore = invoice as Row;
      if (customerId && String(invoice.customer_id) !== customerId) {
        return jsonError(400, "CUSTOMER_MISMATCH", "The selected invoice belongs to a different customer.");
      }
    }

    const { data: updatedPayment, error: updateError } = await db
      .from("payments")
      .update({
        customer_id: customerId ?? (payment.customer_id as string | null) ?? null,
        invoice_id: invoiceId ?? null,
      })
      .eq("id", paymentId)
      .eq("organization_id", ctx.orgId)
      .select()
      .maybeSingle();
    if (updateError || !updatedPayment) {
      return jsonError(500, "ALLOCATION_FAILED", "Could not link this payment. Please retry.");
    }

    if (invoiceBefore) {
      const total = num(invoiceBefore.total_amount);
      const newPaid = Math.round((num(invoiceBefore.amount_paid) + num(payment.amount)) * 100) / 100;
      const balance = Math.max(0, Math.round((total - newPaid) * 100) / 100);
      const status = balance === 0 ? "PAID" : "PARTIALLY_PAID";
      const { error: invoiceError } = await db
        .from("invoices")
        .update({ amount_paid: newPaid, balance_due: balance, status, updated_at: new Date().toISOString() })
        .eq("id", invoiceId)
        .eq("organization_id", ctx.orgId);
      if (invoiceError) {
        // Best-effort rollback keeps payment and invoice consistent.
        await db
          .from("payments")
          .update({ invoice_id: null })
          .eq("id", paymentId)
          .eq("organization_id", ctx.orgId);
        console.error("[Payment gateway] invoice allocation rollback:", invoiceError);
        return jsonError(500, "INVOICE_UPDATE_FAILED", "Could not post the payment to the invoice.");
      }
    }

    return NextResponse.json({
      success: true,
      data: mapPayment(updatedPayment as Row),
      message: invoiceId ? "Payment linked and invoice updated." : "Payment linked to customer.",
    });
  } catch (err) {
    console.error("[Payment gateway] allocation failed:", err);
    return jsonError(503, "ALLOCATION_UNAVAILABLE", "Could not reconcile this payment right now.");
  }
}
