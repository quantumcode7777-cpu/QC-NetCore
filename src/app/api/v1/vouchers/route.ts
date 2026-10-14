import { NextResponse } from "next/server";
import {
  authorizePortalAdmin,
  type AnyClient,
} from "@/lib/captive/server";
import { formatPlanDuration } from "@/lib/vouchers/batch";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/vouchers — hotspot vouchers for the caller's OWN organization
 * (newest first, capped). Feeds the Hotspot Vouchers dashboard table.
 */
export async function GET() {
  const auth = await authorizePortalAdmin();
  if (!auth.ok) return auth.response;
  const { orgId } = auth.ctx;

  try {
    const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
    const db = createSupabaseServiceClient() as unknown as AnyClient;

    const [{ data: vouchers, error: vErr }, { data: plans }] = await Promise.all([
      db
        .from("hotspot_vouchers")
        .select(
          "id, organization_id, batch_id, plan_id, code, status, first_activated_at, expires_at, used_by_phone, used_mac_address, created_at"
        )
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(500),
      db
        .from("plans")
        .select("id, name, price, validity_duration_seconds")
        .eq("organization_id", orgId)
        .eq("service_type", "HOTSPOT"),
    ]);
    if (vErr) throw vErr;

    const planById = new Map(
      ((plans ?? []) as Array<Record<string, unknown>>).map((p) => [String(p.id), p])
    );
    const data = ((vouchers ?? []) as Array<Record<string, unknown>>).map((v) => {
      const plan = planById.get(String(v.plan_id));
      return {
        id: String(v.id),
        organizationId: String(v.organization_id),
        batchId: v.batch_id ? String(v.batch_id) : "",
        planId: String(v.plan_id),
        planName: plan ? String(plan.name) : undefined,
        planPrice: plan ? Number(plan.price) : undefined,
        planDuration: plan ? formatPlanDuration(Number(plan.validity_duration_seconds)) : undefined,
        code: String(v.code),
        status: String(v.status),
        firstActivatedAt: v.first_activated_at ? String(v.first_activated_at) : undefined,
        expiresAt: v.expires_at ? String(v.expires_at) : undefined,
        usedByPhone: v.used_by_phone ? String(v.used_by_phone) : undefined,
        usedMacAddress: v.used_mac_address ? String(v.used_mac_address) : undefined,
        createdAt: String(v.created_at),
      };
    });

    return NextResponse.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error("[Vouchers] list failed:", err);
    return NextResponse.json(
      { success: false, error: "Could not load vouchers. Please try again." },
      { status: 500 }
    );
  }
}
