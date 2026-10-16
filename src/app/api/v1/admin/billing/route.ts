import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  authorizeSuperAdmin,
  jsonError,
  type AnyClient,
} from "@/lib/captive/server";
import {
  buildInvoiceNumber,
  computeShareAmount,
  periodWindowUtc,
  validateCreateIspInvoice,
} from "@/lib/admin/isp-billing";
import { smsProviderStatus } from "@/lib/sms/sender";

export const dynamic = "force-dynamic";

const SUFFIX = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const randSuffix = () =>
  Array.from({ length: 4 }, () => SUFFIX[randomInt(SUFFIX.length)]).join("");

function mapInvoice(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    invoiceNumber: String(r.invoice_number),
    year: Number(r.period_year),
    month: Number(r.period_month),
    sharePct: Number(r.share_pct),
    baseAmount: Number(r.base_amount),
    totalAmount: Number(r.total_amount),
    amountPaid: Number(r.amount_paid),
    balanceDue: Number(r.balance_due),
    status: String(r.status),
    dueDate: String(r.due_date),
    notes: r.notes ? String(r.notes) : null,
    paymentReference: r.payment_reference ? String(r.payment_reference) : null,
    sentAt: r.sent_at ? String(r.sent_at) : null,
    sentTo: r.sent_to ? String(r.sent_to) : null,
    paidAt: r.paid_at ? String(r.paid_at) : null,
    createdAt: String(r.created_at),
  };
}

/**
 * GET /api/v1/admin/billing — all platform invoices + ISP directory
 * (share %, phone, currency) + SMS provider status. Super-admin only.
 */
export async function GET() {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
    const db = createSupabaseServiceClient() as unknown as AnyClient;

    const [{ data: invoices, error: iErr }, { data: orgs, error: oErr }] = await Promise.all([
      db
        .from("isp_invoices")
        .select(
          "id, organization_id, invoice_number, period_year, period_month, share_pct, base_amount, total_amount, amount_paid, balance_due, status, due_date, notes, payment_reference, sent_at, sent_to, paid_at, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(500),
      db
        .from("organizations")
        .select("id, name, slug, email, phone, currency, revenue_share_pct, is_active")
        .order("name", { ascending: true }),
    ]);
    if (iErr) throw iErr;
    if (oErr) throw oErr;

    const orgById = new Map(
      ((orgs ?? []) as Array<Record<string, unknown>>).map((o) => [String(o.id), o])
    );
    const data = ((invoices ?? []) as Array<Record<string, unknown>>).map((r) => {
      const o = orgById.get(String(r.organization_id));
      return {
        ...mapInvoice(r),
        ispName: o ? String(o.name) : "Unknown ISP",
        ispSlug: o ? String(o.slug) : "",
        ispPhone: o ? String(o.phone) : "",
      };
    });

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
      isps: ((orgs ?? []) as Array<Record<string, unknown>>).map((o) => ({
        id: String(o.id),
        name: String(o.name),
        slug: String(o.slug),
        email: String(o.email),
        phone: String(o.phone),
        currency: String(o.currency ?? "KES"),
        sharePct: Number(o.revenue_share_pct ?? 10),
        isActive: Boolean(o.is_active),
      })),
      sms: smsProviderStatus(),
    });
  } catch (err) {
    console.error("[Admin] ISP billing list failed:", err);
    return NextResponse.json(
      { success: false, error: "Could not load invoices. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/admin/billing — draft a revenue-share invoice for one
 * ISP + month. Base = ISP's COMPLETED collections in that UTC month.
 * Idempotent while DRAFT; 409 once finalized. Super-admin only.
 */
export async function POST(req: NextRequest) {
  let body: {
    organizationId?: unknown;
    period?: unknown;
    sharePct?: unknown;
    dueDate?: unknown;
    notes?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_REQUEST", "Request body must be JSON.");
  }

  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;

  const checked = validateCreateIspInvoice(body);
  if (!checked.ok) return jsonError(checked.status, checked.code, checked.message);
  const { organizationId, year, month } = checked.value;
  let { sharePct } = checked.value;

  try {
    const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
    const db = createSupabaseServiceClient() as unknown as AnyClient;

    const { data: org } = await db
      .from("organizations")
      .select("id, name, slug, phone, currency, revenue_share_pct, is_active")
      .eq("id", organizationId)
      .maybeSingle();
    const o = (org ?? null) as {
      id: string;
      name: string;
      slug: string;
      phone: string;
      currency: string;
      revenue_share_pct: number;
      is_active: boolean;
    } | null;
    if (!o) return jsonError(404, "ISP_NOT_FOUND", "That ISP does not exist.");
    if (body.sharePct === undefined || body.sharePct === null || body.sharePct === "") {
      sharePct = Number(o.revenue_share_pct ?? 10);
    }

    const { data: existing } = await db
      .from("isp_invoices")
      .select(
        "id, organization_id, invoice_number, period_year, period_month, share_pct, base_amount, total_amount, amount_paid, balance_due, status, due_date, notes, payment_reference, sent_at, sent_to, paid_at, created_at"
      )
      .eq("organization_id", organizationId)
      .eq("period_year", year)
      .eq("period_month", month)
      .maybeSingle();
    if (existing) {
      const ex = existing as Record<string, unknown>;
      if (String(ex.status) === "DRAFT") {
        return NextResponse.json({
          success: true,
          data: { ...mapInvoice(ex), ispName: o.name, ispSlug: o.slug, ispPhone: o.phone },
          deduped: true,
        });
      }
      return jsonError(409, "PERIOD_INVOICED", `${o.name} already has a ${String(ex.status)} invoice for this period.`);
    }

    const { start, end } = periodWindowUtc(year, month);
    const { data: payments } = await db
      .from("payments")
      .select("amount")
      .eq("organization_id", organizationId)
      .eq("status", "COMPLETED")
      .gte("created_at", start)
      .lt("created_at", end);
    const base = ((payments ?? []) as Array<{ amount: number }>).reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0
    );
    const total = computeShareAmount(base, sharePct);

    for (let attempt = 1; attempt <= 3; attempt++) {
      const invoiceNumber = buildInvoiceNumber(year, month, o.slug, randSuffix());
      const { data: created, error } = await db
        .from("isp_invoices")
        .insert({
          organization_id: organizationId,
          invoice_number: invoiceNumber,
          period_year: year,
          period_month: month,
          share_pct: sharePct,
          base_amount: base,
          total_amount: total,
          amount_paid: 0,
          balance_due: total,
          status: "DRAFT",
          due_date: checked.value.dueDate,
          notes: checked.value.notes || null,
        })
        .select(
          "id, organization_id, invoice_number, period_year, period_month, share_pct, base_amount, total_amount, amount_paid, balance_due, status, due_date, notes, payment_reference, sent_at, sent_to, paid_at, created_at"
        )
        .single();
      if (!error && created) {
        const c = created as Record<string, unknown>;
        return NextResponse.json(
          {
            success: true,
            data: { ...mapInvoice(c), ispName: o.name, ispSlug: o.slug, ispPhone: o.phone },
          },
          { status: 201 }
        );
      }
      const pgCode = (error as { code?: string } | null)?.code;
      if (pgCode !== "23505" || attempt === 3) {
        console.error("[Admin] ISP invoice create failed:", error);
        return jsonError(500, "CREATE_FAILED", "Could not create the invoice. Please try again.");
      }
    }
    return jsonError(500, "CREATE_FAILED", "Could not create the invoice. Please try again.");
  } catch (err) {
    console.error("[Admin] ISP invoice create failed:", err);
    return jsonError(500, "SERVER_ERROR", "Something went wrong. Please try again.");
  }
}
