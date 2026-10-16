import { NextRequest, NextResponse } from "next/server";
import {
  authorizeSuperAdmin,
  jsonError,
  type AnyClient,
} from "@/lib/captive/server";
import { aggregateIspStats, validateCreateOrg } from "@/lib/admin/isps";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/isps — every ISP with platform-wide stat blocks.
 * Super-admin only (no org scoping).
 */
export async function GET() {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
    const db = createSupabaseServiceClient() as unknown as AnyClient;

    const [
      { data: orgs, error: oErr },
      { data: routers },
      { data: customers },
      { data: plans },
      { data: vouchers },
      { data: profiles },
      { data: payments },
      { data: portalConfigs },
    ] = await Promise.all([
      db
        .from("organizations")
        .select(
          "id, name, slug, business_number, email, phone, currency, timezone, revenue_share_pct, is_active, created_at, updated_at"
        )
        .order("created_at", { ascending: true }),
      db.from("routers").select("organization_id"),
      db.from("customers").select("organization_id"),
      db.from("plans").select("organization_id, service_type"),
      db.from("hotspot_vouchers").select("organization_id, status"),
      db.from("profiles").select("organization_id"),
      db.from("payments").select("organization_id, amount, status"),
      db.from("captive_portal_configs").select("organization_id, status"),
    ]);
    if (oErr) throw oErr;

    const stats = aggregateIspStats({
      routers: ((routers ?? []) as Array<{ organization_id: string }>) ?? [],
      customers: ((customers ?? []) as Array<{ organization_id: string }>) ?? [],
      plans: ((plans ?? []) as Array<{ organization_id: string; service_type: string }>) ?? [],
      vouchers: ((vouchers ?? []) as Array<{ organization_id: string; status: string }>) ?? [],
      profiles: ((profiles ?? []) as Array<{ organization_id: string }>) ?? [],
      payments:
        ((payments ?? []) as Array<{ organization_id: string; amount: number; status: string }>) ?? [],
      portalConfigs: ((portalConfigs ?? []) as Array<{ organization_id: string; status: string }>) ?? [],
    });

    const data = ((orgs ?? []) as Array<Record<string, unknown>>).map((o) => ({
      id: String(o.id),
      name: String(o.name),
      slug: String(o.slug),
      businessNumber: o.business_number ? String(o.business_number) : null,
      email: String(o.email),
      phone: String(o.phone),
      currency: String(o.currency ?? "KES"),
      timezone: String(o.timezone ?? "Africa/Nairobi"),
      sharePct: Number(o.revenue_share_pct ?? 10),
      isActive: Boolean(o.is_active),
      createdAt: String(o.created_at),
      updatedAt: o.updated_at ? String(o.updated_at) : null,
      stats: stats[String(o.id)] ?? {
        routers: 0,
        customers: 0,
        users: 0,
        hotspotPlans: 0,
        pppoePlans: 0,
        vouchersAvailable: 0,
        vouchersUsed: 0,
        revenueCompleted: 0,
        portalPublished: false,
      },
    }));

    return NextResponse.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error("[Admin] ISP list failed:", err);
    return NextResponse.json(
      { success: false, error: "Could not load ISPs. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/admin/isps — onboard a new ISP tenant.
 * Body: { name, slug?, email, phone, currency? }.
 */
export async function POST(req: NextRequest) {
  let body: { name?: unknown; slug?: unknown; email?: unknown; phone?: unknown; currency?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_REQUEST", "Request body must be JSON.");
  }

  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;

  const checked = validateCreateOrg(body);
  if (!checked.ok) return jsonError(checked.status, checked.code, checked.message);

  try {
    const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
    const db = createSupabaseServiceClient() as unknown as AnyClient;

    const { data: existing } = await db
      .from("organizations")
      .select("id")
      .eq("slug", checked.value.slug)
      .maybeSingle();
    if (existing) {
      return jsonError(409, "SLUG_TAKEN", "An ISP with that URL slug already exists.");
    }

    const { data: created, error } = await db
      .from("organizations")
      .insert({
        name: checked.value.name,
        slug: checked.value.slug,
        email: checked.value.email,
        phone: checked.value.phone,
        currency: checked.value.currency,
        is_active: true,
      })
      .select("id, name, slug, email, phone, currency, is_active, created_at")
      .single();
    if (error || !created) {
      console.error("[Admin] ISP create failed:", error);
      return jsonError(500, "CREATE_FAILED", "Could not create the ISP. Please try again.");
    }
    const c = created as Record<string, unknown>;
    return NextResponse.json(
      {
        success: true,
        data: {
          id: String(c.id),
          name: String(c.name),
          slug: String(c.slug),
          email: String(c.email),
          phone: String(c.phone),
          currency: String(c.currency ?? "KES"),
          isActive: Boolean(c.is_active),
          createdAt: String(c.created_at),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[Admin] ISP create failed:", err);
    return jsonError(500, "SERVER_ERROR", "Something went wrong. Please try again.");
  }
}
