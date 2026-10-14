import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_READY, jsonError, type AnyClient } from "@/lib/captive/server";
import {
  buildActivationUpdate,
  decideRedeem,
  normalizeVoucherCode,
  type RedeemPlanRow,
  type RedeemVoucherRow,
} from "@/lib/captive/redeem";

export const dynamic = "force-dynamic";

/**
 * PUBLIC voucher redemption (no login — hotspot clients are anonymous).
 *
 * First activation flips AVAILABLE → USED and stamps the paid window
 * (`first_activated_at` / `expires_at`); the migration-022 triggers write the
 * FreeRADIUS rows from that write. Re-redeem inside the paid window just
 * re-issues the same credentials (no clock extension).
 *
 * POST { org: slug, code, mac?, phone? } →
 *   { success: true, data: { username, password, expiresAt, planName,
 *     validityDurationSeconds, firstActivation } }
 */
export async function POST(req: NextRequest) {
  let body: { org?: unknown; code?: unknown; mac?: unknown; phone?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_REQUEST", "Request body must be JSON.");
  }

  const orgSlug =
    typeof body.org === "string" ? body.org.trim().toLowerCase() : "";
  const code = normalizeVoucherCode(body.code);
  if (!orgSlug) {
    return jsonError(400, "ORG_REQUIRED", "Organization is required.");
  }
  if (!code) {
    return jsonError(400, "CODE_REQUIRED", "Voucher code is required.");
  }
  if (!SUPABASE_READY) {
    return jsonError(
      503,
      "PORTAL_UNAVAILABLE",
      "The WiFi portal is temporarily unavailable. Please try again."
    );
  }

  try {
    const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
    const db = createSupabaseServiceClient() as unknown as AnyClient;

    const { data: org } = await db
      .from("organizations")
      .select("id, name, slug")
      .eq("slug", orgSlug)
      .eq("is_active", true)
      .maybeSingle();
    if (!org) {
      return jsonError(
        404,
        "PORTAL_NOT_FOUND",
        "This WiFi portal could not be found. Please scan the QR code or reconnect to the network."
      );
    }
    const orgId = (org as { id: string }).id;

    const { data: voucher } = await db
      .from("hotspot_vouchers")
      .select(
        "id, organization_id, plan_id, code, status, first_activated_at, expires_at"
      )
      .eq("organization_id", orgId)
      .eq("code", code)
      .maybeSingle();
    const v = (voucher ?? null) as RedeemVoucherRow | null;

    let plan: RedeemPlanRow | null = null;
    if (v && v.status === "AVAILABLE") {
      const { data: planRow } = await db
        .from("plans")
        .select("id, name, service_type, validity_duration_seconds, is_active")
        .eq("id", v.plan_id)
        .maybeSingle();
      plan = (planRow ?? null) as RedeemPlanRow | null;
    }

    const decision = decideRedeem(v, plan, Date.now());
    if (!decision.ok) {
      if (decision.markExpired && v) {
        await db
          .from("hotspot_vouchers")
          .update({ status: "EXPIRED" })
          .eq("id", v.id)
          .eq("organization_id", orgId);
      }
      return jsonError(decision.status, decision.code, decision.message);
    }

    let expiresAt: string | null = v ? v.expires_at : null;
    const planName: string | null = plan ? plan.name : null;
    const validity: number | null = decision.validityDurationSeconds;

    if (decision.firstActivation) {
      if (decision.validityDurationSeconds == null || !v) {
        return jsonError(
          500,
          "VOUCHER_PLAN_MISSING",
          "This voucher's package is missing. Contact support."
        );
      }
      const update = buildActivationUpdate(decision.validityDurationSeconds, Date.now(), {
        mac: typeof body.mac === "string" ? body.mac : undefined,
        phone: typeof body.phone === "string" ? body.phone : undefined,
      });
      const { data: updated, error: uErr } = await db
        .from("hotspot_vouchers")
        .update(update)
        .eq("id", v.id)
        .eq("organization_id", orgId)
        .select("expires_at")
        .maybeSingle();
      if (uErr || !updated) {
        return jsonError(
          500,
          "VOUCHER_ACTIVATION_FAILED",
          "Voucher could not be activated. Please try again."
        );
      }
      expiresAt = (updated as { expires_at: string }).expires_at;
    }

    return NextResponse.json({
      success: true,
      data: {
        username: v ? v.code : code,
        password: v ? v.code : code,
        expiresAt,
        planName,
        validityDurationSeconds: validity,
        firstActivation: decision.firstActivation,
      },
    });
  } catch (err) {
    console.error("[CaptivePortal] redeem failed:", err);
    return jsonError(500, "SERVER_ERROR", "Something went wrong. Please try again.");
  }
}
