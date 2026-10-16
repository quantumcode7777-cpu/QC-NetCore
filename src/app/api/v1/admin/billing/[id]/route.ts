import { NextRequest, NextResponse } from "next/server";
import {
  authorizeSuperAdmin,
  jsonError,
  type AnyClient,
} from "@/lib/captive/server";
import {
  buildInvoiceSms,
  normalizePhoneKE,
  statusAfterPayment,
} from "@/lib/admin/isp-billing";
import { sendSms } from "@/lib/sms/sender";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const FULL_COLUMNS =
  "id, organization_id, invoice_number, period_year, period_month, share_pct, base_amount, total_amount, amount_paid, balance_due, status, due_date, notes, payment_reference, sent_at, sent_to, paid_at, created_at";

interface InvoiceRow {
  id: string;
  organization_id: string;
  invoice_number: string;
  period_year: number;
  period_month: number;
  share_pct: number;
  base_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: string;
  due_date: string;
  notes: string | null;
}

async function loadInvoice(db: AnyClient, id: string): Promise<InvoiceRow | null> {
  const { data } = await db.from("isp_invoices").select(FULL_COLUMNS).eq("id", id).maybeSingle();
  return (data ?? null) as InvoiceRow | null;
}

/**
 * POST /api/v1/admin/billing/[id]/send — SMS the invoice to the ISP's
 * contact phone via Africa's Talking. Allowed from DRAFT (first send) or
 * SENT (resend). Super-admin only.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
    const db = createSupabaseServiceClient() as unknown as AnyClient;

    const inv = await loadInvoice(db, id);
    if (!inv) return jsonError(404, "INVOICE_NOT_FOUND", "That invoice does not exist.");
    if (inv.status !== "DRAFT" && inv.status !== "SENT") {
      return jsonError(409, "BAD_STATE", `A ${inv.status} invoice cannot be sent.`);
    }

    const { data: org } = await db
      .from("organizations")
      .select("name, phone, currency")
      .eq("id", inv.organization_id)
      .maybeSingle();
    const o = (org ?? null) as { name: string; phone: string; currency: string } | null;
    if (!o) return jsonError(404, "ISP_NOT_FOUND", "The ISP for this invoice no longer exists.");

    const to = normalizePhoneKE(o.phone);
    if (!to) {
      return jsonError(400, "BAD_ISP_PHONE", `The ISP's contact phone (${o.phone || "missing"}) is not a valid Kenyan number. Fix it in ISP Management first.`);
    }

    const sms = buildInvoiceSms({
      ispName: o.name,
      invoiceNumber: inv.invoice_number,
      year: Number(inv.period_year),
      month: Number(inv.period_month),
      baseAmount: Number(inv.base_amount),
      sharePct: Number(inv.share_pct),
      totalAmount: Number(inv.total_amount),
      dueDate: String(inv.due_date),
      currency: o.currency ?? "KES",
    });

    const result = await sendSms(to, sms);
    if (!result.ok) {
      return jsonError(result.code === "UNCONFIGURED" ? 503 : 502, result.code, result.message);
    }

    const { data: updated, error } = await db
      .from("isp_invoices")
      .update({ status: "SENT", sent_at: new Date().toISOString(), sent_to: to })
      .eq("id", id)
      .select("status, sent_at, sent_to")
      .single();
    if (error) {
      // SMS left the building; the status flip can be retried via resend.
      console.error("[Admin] invoice sent-flag failed:", error);
      return NextResponse.json({
        success: true,
        sent: true,
        statusSync: false,
        message: `${result.message} (Could not stamp the invoice — resend to sync.)`,
      });
    }
    const u = updated as { status: string; sent_at: string; sent_to: string };
    return NextResponse.json({
      success: true,
      sent: true,
      status: u.status,
      sentAt: u.sent_at,
      sentTo: u.sent_to,
      providerNote: result.message,
    });
  } catch (err) {
    console.error("[Admin] invoice send failed:", err);
    return jsonError(500, "SERVER_ERROR", "Something went wrong. Please try again.");
  }
}

/**
 * PATCH /api/v1/admin/billing/[id] — record a payment
 * ({ action: "pay", amount, reference }) or void ({ action: "void" }).
 * Super-admin only.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  let body: { action?: unknown; amount?: unknown; reference?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_REQUEST", "Request body must be JSON.");
  }

  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
    const db = createSupabaseServiceClient() as unknown as AnyClient;

    const inv = await loadInvoice(db, id);
    if (!inv) return jsonError(404, "INVOICE_NOT_FOUND", "That invoice does not exist.");

    if (body.action === "void") {
      if (inv.status === "PAID") return jsonError(409, "BAD_STATE", "A paid invoice cannot be voided.");
      if (inv.status === "VOID") return jsonError(409, "BAD_STATE", "This invoice is already void.");
      const { error } = await db.from("isp_invoices").update({ status: "VOID" }).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ success: true, data: { id, status: "VOID" } });
    }

    if (body.action === "pay") {
      if (inv.status === "PAID" || inv.status === "VOID") {
        return jsonError(409, "BAD_STATE", `A ${inv.status} invoice cannot take payments.`);
      }
      const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return jsonError(400, "BAD_AMOUNT", "Payment amount must be greater than zero.");
      }
      const reference = typeof body.reference === "string" ? body.reference.trim().slice(0, 100) : "";
      const total = Number(inv.total_amount);
      const paidTotal = Math.round((Number(inv.amount_paid) + amount) * 100) / 100;
      const status = statusAfterPayment(total, paidTotal);
      const patch: Record<string, unknown> = {
        amount_paid: Math.min(paidTotal, total),
        balance_due: Math.max(Math.round((total - Math.min(paidTotal, total)) * 100) / 100, 0),
        status,
      };
      if (reference) patch.payment_reference = reference;
      if (status === "PAID") patch.paid_at = new Date().toISOString();
      const { error } = await db.from("isp_invoices").update(patch).eq("id", id);
      if (error) throw error;
      return NextResponse.json({
        success: true,
        data: { id, status, amountPaid: patch.amount_paid, balanceDue: patch.balance_due },
      });
    }

    return jsonError(400, "BAD_ACTION", "Action must be \"pay\" or \"void\".");
  } catch (err) {
    console.error("[Admin] invoice update failed:", err);
    return jsonError(500, "SERVER_ERROR", "Something went wrong. Please try again.");
  }
}
