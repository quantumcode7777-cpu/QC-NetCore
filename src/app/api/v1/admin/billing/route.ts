import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  authorizeSuperAdmin,
  jsonError,
  type AnyClient,
} from "@/lib/captive/server";
import {
  attributeHotspotPayments,
  buildInvoiceNumber,
  computeInvoiceTotals,
  countPppoeUsers,
  DEFAULT_FX_KES_PER_USD,
  DEFAULT_PPPOE_RATE_USD,
  periodWindowUtc,
  validateCreateIspInvoice,
  voucherFaceValue,
} from "@/lib/admin/isp-billing";
import { smsProviderStatus } from "@/lib/sms/sender";

export const dynamic = "force-dynamic";

const SUFFIX = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const randSuffix = () =>
  Array.from({ length: 4 }, () => SUFFIX[randomInt(SUFFIX.length)]).join("");

const FULL_COLUMNS =
  "id, organization_id, invoice_number, period_year, period_month, share_pct, base_amount, total_amount, amount_paid, balance_due, status, due_date, notes, payment_reference, sent_at, sent_to, paid_at, created_at, hotspot_payments, voucher_face_value, pppoe_users, pppoe_rate_usd, fx_rate, custom_amount, custom_label";

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
    hotspotPayments: Number(r.hotspot_payments ?? 0),
    voucherFaceValue: Number(r.voucher_face_value ?? 0),
    pppoeUsers: Number(r.pppoe_users ?? 0),
    pppoeRateUsd: Number(r.pppoe_rate_usd ?? DEFAULT_PPPOE_RATE_USD),
    fxRate: Number(r.fx_rate ?? DEFAULT_FX_KES_PER_USD),
    customAmount: Number(r.custom_amount ?? 0),
    customLabel: r.custom_label ? String(r.custom_label) : null,
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
      db.from("isp_invoices").select(FULL_COLUMNS).order("created_at", { ascending: false }).limit(500),
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
 * POST /api/v1/admin/billing — draft a line-item invoice for one ISP + month:
 *   HOTSPOT = hotspot % x (attributed COMPLETED payments + redeemed voucher
 *             face value in the month)
 *   PPPOE   = active PPPoE users x rate USD x FX
 *   CUSTOM  = manual line (Enterprise / adjustments)
 * Idempotent while DRAFT; 409 once finalized. Super-admin only.
 */
export async function POST(req: NextRequest) {
  let body: {
    organizationId?: unknown;
    period?: unknown;
    sharePct?: unknown;
    pppoeRateUsd?: unknown;
    fxRate?: unknown;
    customAmount?: unknown;
    customLabel?: unknown;
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

    const hotspotPct = checked.value.sharePct ?? Number(o.revenue_share_pct ?? 3);
    const pppoeRateUsd = checked.value.pppoeRateUsd;
    const fxRate = checked.value.fxRate;
    const customAmount = checked.value.customAmount;
    const customLabel = checked.value.customLabel;

    const { data: existing } = await db
      .from("isp_invoices")
      .select(FULL_COLUMNS)
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
    const [{ data: payments }, { data: subscriptions }, { data: plans }, { data: vouchers }] =
      await Promise.all([
        db
          .from("payments")
          .select("amount, customer_id")
          .eq("organization_id", organizationId)
          .eq("status", "COMPLETED")
          .gte("created_at", start)
          .lt("created_at", end),
        db
          .from("subscriptions")
          .select("customer_id, plan_id, status, start_time, end_time")
          .eq("organization_id", organizationId)
          .lt("start_time", end)
          .gt("end_time", start),
        db
          .from("plans")
          .select("id, service_type, price")
          .eq("organization_id", organizationId),
        db
          .from("hotspot_vouchers")
          .select("plan_id, first_activated_at")
          .eq("organization_id", organizationId)
          .gte("first_activated_at", start)
          .lt("first_activated_at", end),
      ]);

    const planRows = ((plans ?? []) as Array<{ id: string; service_type: string; price: number }>) ?? [];
    const hotspotPlanIds = new Set(planRows.filter((p) => p.service_type === "HOTSPOT").map((p) => String(p.id)));
    const pppoePlanIds = new Set(planRows.filter((p) => p.service_type === "PPPOE").map((p) => String(p.id)));
    const planPrices = new Map(planRows.map((p) => [String(p.id), Number(p.price) || 0]));
    const subRows = ((subscriptions ?? []) as Array<{
      customer_id: string;
      plan_id: string;
      status: string;
      start_time: string;
      end_time: string;
    }>) ?? [];

    const hotspotPayments = attributeHotspotPayments(
      (((payments ?? []) as Array<{ customer_id: string | null; amount: number }>) ?? []).map((p) => ({
        customer_id: p.customer_id,
        amount: Number(p.amount) || 0,
      })),
      subRows,
      hotspotPlanIds,
      start,
      end
    );
    const face = voucherFaceValue(
      (((vouchers ?? []) as Array<{ plan_id: string; first_activated_at: string }>) ?? []).map((v) => ({
        plan_id: String(v.plan_id),
        first_activated_at: String(v.first_activated_at),
      })),
      planPrices,
      start,
      end
    );
    const hotspotBase = Math.round((hotspotPayments + face) * 100) / 100;
    const pppoeUsers = countPppoeUsers(subRows, pppoePlanIds, start, end);
    const totals = computeInvoiceTotals({
      hotspotBase,
      hotspotPct,
      pppoeUsers,
      pppoeRateUsd,
      fxRate,
      customAmount,
    });

    for (let attempt = 1; attempt <= 3; attempt++) {
      const invoiceNumber = buildInvoiceNumber(year, month, o.slug, randSuffix());
      const { data: created, error } = await db
        .from("isp_invoices")
        .insert({
          organization_id: organizationId,
          invoice_number: invoiceNumber,
          period_year: year,
          period_month: month,
          share_pct: hotspotPct,
          base_amount: hotspotBase,
          hotspot_payments: hotspotPayments,
          voucher_face_value: face,
          pppoe_users: pppoeUsers,
          pppoe_rate_usd: pppoeRateUsd,
          fx_rate: fxRate,
          custom_amount: totals.customAmount,
          custom_label: customLabel || null,
          total_amount: totals.total,
          amount_paid: 0,
          balance_due: totals.total,
          status: "DRAFT",
          due_date: checked.value.dueDate,
          notes: checked.value.notes || null,
        })
        .select(FULL_COLUMNS)
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
