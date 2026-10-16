import { NextRequest, NextResponse } from "next/server";
import {
  authorizeSuperAdmin,
  jsonError,
  type AnyClient,
} from "@/lib/captive/server";
import { aggregateIspStats, validateUpdateOrg } from "@/lib/admin/isps";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function loadOrg(db: AnyClient, id: string) {
  const { data: org } = await db
    .from("organizations")
    .select(
      "id, name, slug, business_number, email, phone, currency, timezone, is_active, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();
  return (org ?? null) as Record<string, unknown> | null;
}

/**
 * GET /api/v1/admin/isps/[id] — one ISP with routers, plans, users,
 * portal status and recent payments. Super-admin only.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
    const db = createSupabaseServiceClient() as unknown as AnyClient;

    const org = await loadOrg(db, id);
    if (!org) return jsonError(404, "ISP_NOT_FOUND", "That ISP does not exist.");

    const [
      { data: routers },
      { data: plans },
      { data: profiles },
      { data: vouchers },
      { data: portalConfigs },
      { data: payments },
    ] = await Promise.all([
      db
        .from("routers")
        .select("id, name, management_ip, status, last_seen_at")
        .eq("organization_id", id)
        .order("name", { ascending: true }),
      db
        .from("plans")
        .select("id, name, service_type, price, is_active")
        .eq("organization_id", id)
        .order("price", { ascending: true }),
      db
        .from("profiles")
        .select("id, full_name, role, is_active, created_at")
        .eq("organization_id", id)
        .order("created_at", { ascending: true }),
      db
        .from("hotspot_vouchers")
        .select("status")
        .eq("organization_id", id),
      db
        .from("captive_portal_configs")
        .select("id, status, version, updated_at")
        .eq("organization_id", id)
        .order("updated_at", { ascending: false }),
      db
        .from("payments")
        .select("id, amount, status, created_at")
        .eq("organization_id", id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const stats = aggregateIspStats({
      routers: ((routers ?? []) as Array<{ organization_id: string }>).map(() => ({ organization_id: id })),
      customers: [],
      plans: ((plans ?? []) as Array<{ organization_id: string; service_type: string }>).map((p) => ({
        organization_id: id,
        service_type: String(p.service_type),
      })),
      vouchers: ((vouchers ?? []) as Array<{ status: string }>).map((v) => ({
        organization_id: id,
        status: String(v.status),
      })),
      profiles: ((profiles ?? []) as Array<unknown>).map(() => ({ organization_id: id })),
      payments: ((payments ?? []) as Array<{ amount: number; status: string }>).map((p) => ({
        organization_id: id,
        amount: Number(p.amount),
        status: String(p.status),
      })),
      portalConfigs: ((portalConfigs ?? []) as Array<{ status: string }>).map((c) => ({
        organization_id: id,
        status: String(c.status),
      })),
    })[id];

    return NextResponse.json({
      success: true,
      data: {
        id: String(org.id),
        name: String(org.name),
        slug: String(org.slug),
        businessNumber: org.business_number ? String(org.business_number) : null,
        email: String(org.email),
        phone: String(org.phone),
        currency: String(org.currency ?? "KES"),
        timezone: String(org.timezone ?? "Africa/Nairobi"),
        isActive: Boolean(org.is_active),
        createdAt: String(org.created_at),
        stats,
        routers: ((routers ?? []) as Array<Record<string, unknown>>).map((r) => ({
          id: String(r.id),
          name: String(r.name),
          managementIp: r.management_ip ? String(r.management_ip) : null,
          status: String(r.status ?? "UNKNOWN"),
          lastSeenAt: r.last_seen_at ? String(r.last_seen_at) : null,
        })),
        plans: ((plans ?? []) as Array<Record<string, unknown>>).map((p) => ({
          id: String(p.id),
          name: String(p.name),
          serviceType: String(p.service_type),
          price: Number(p.price),
          isActive: Boolean(p.is_active),
        })),
        users: ((profiles ?? []) as Array<Record<string, unknown>>).map((u) => ({
          id: String(u.id),
          fullName: u.full_name ? String(u.full_name) : null,
          role: String(u.role),
          isActive: Boolean(u.is_active),
          createdAt: String(u.created_at),
        })),
        portalConfigs: ((portalConfigs ?? []) as Array<Record<string, unknown>>).map((c) => ({
          id: String(c.id),
          status: String(c.status),
          version: Number(c.version),
          updatedAt: String(c.updated_at),
        })),
        recentPayments: ((payments ?? []) as Array<Record<string, unknown>>).map((p) => ({
          id: String(p.id),
          amount: Number(p.amount),
          status: String(p.status),
          createdAt: String(p.created_at),
        })),
      },
    });
  } catch (err) {
    console.error("[Admin] ISP detail failed:", err);
    return NextResponse.json(
      { success: false, error: "Could not load the ISP. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/admin/isps/[id] — edit contact fields or suspend/activate.
 * Suspending (`is_active: false`) also blocks the ISP's portal + redeem
 * endpoints, which require an active organization. Super-admin only.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_REQUEST", "Request body must be JSON.");
  }

  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;

  const checked = validateUpdateOrg(body);
  if (!checked.ok) return jsonError(checked.status, checked.code, checked.message);
  if (checked.empty) return jsonError(400, "NOTHING_TO_UPDATE", "No editable fields were provided.");

  try {
    const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
    const db = createSupabaseServiceClient() as unknown as AnyClient;

    const org = await loadOrg(db, id);
    if (!org) return jsonError(404, "ISP_NOT_FOUND", "That ISP does not exist.");

    const { data: updated, error } = await db
      .from("organizations")
      .update({ ...checked.value, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, name, slug, email, phone, currency, is_active, updated_at")
      .single();
    if (error || !updated) {
      console.error("[Admin] ISP update failed:", error);
      return jsonError(500, "UPDATE_FAILED", "Could not update the ISP. Please try again.");
    }
    const u = updated as Record<string, unknown>;
    return NextResponse.json({
      success: true,
      data: {
        id: String(u.id),
        name: String(u.name),
        slug: String(u.slug),
        email: String(u.email),
        phone: String(u.phone),
        currency: String(u.currency ?? "KES"),
        isActive: Boolean(u.is_active),
        updatedAt: String(u.updated_at),
      },
    });
  } catch (err) {
    console.error("[Admin] ISP update failed:", err);
    return jsonError(500, "SERVER_ERROR", "Something went wrong. Please try again.");
  }
}
