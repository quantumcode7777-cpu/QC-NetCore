import { NextRequest, NextResponse } from "next/server";
import {
  authorizePortalAdmin,
  jsonError,
  type AnyClient,
} from "@/lib/captive/server";
import {
  formatPlanDuration,
  generateBatchCodes,
  validateBatchRequest,
} from "@/lib/vouchers/batch";

export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 3;

/**
 * POST /api/v1/vouchers/batch — generate a real voucher batch for the
 * caller's OWN organization. Codes are written to `hotspot_vouchers`
 * (status AVAILABLE), so they redeem immediately on the captive portal.
 * Body: { planId, quantity (1-500), prefix? }.
 */
export async function POST(req: NextRequest) {
  let body: { planId?: unknown; quantity?: unknown; prefix?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_REQUEST", "Request body must be JSON.");
  }

  const auth = await authorizePortalAdmin();
  if (!auth.ok) return auth.response;
  const { orgId } = auth.ctx;

  const checked = validateBatchRequest(body);
  if (!checked.ok) return jsonError(checked.status, checked.code, checked.message);
  const { planId, quantity, prefix } = checked.value;

  try {
    const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
    const db = createSupabaseServiceClient() as unknown as AnyClient;

    const { data: plan } = await db
      .from("plans")
      .select("id, name, price, service_type, validity_duration_seconds, is_active")
      .eq("id", planId)
      .eq("organization_id", orgId)
      .maybeSingle();
    const p = (plan ?? null) as {
      id: string;
      name: string;
      price: number;
      service_type: string;
      validity_duration_seconds: number;
      is_active: boolean;
    } | null;
    if (!p || p.service_type !== "HOTSPOT" || !p.is_active) {
      return jsonError(400, "BAD_PLAN", "That package is not an active hotspot package in your organization.");
    }

    const batchName = `${p.name} - ${quantity}x Batch`;
    const planDuration = formatPlanDuration(Number(p.validity_duration_seconds));

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const codes = generateBatchCodes(prefix, quantity);

      const { data: batch, error: bErr } = await db
        .from("voucher_batches")
        .insert({
          organization_id: orgId,
          plan_id: planId,
          batch_name: batchName,
          quantity,
          prefix: prefix || null,
        })
        .select("id, created_at")
        .single();
      if (bErr || !batch) {
        console.error("[Vouchers] batch insert failed:", bErr);
        return jsonError(500, "BATCH_FAILED", "Could not create the batch. Please try again.");
      }
      const batchId = (batch as { id: string }).id;

      const { data: inserted, error: vErr } = await db
        .from("hotspot_vouchers")
        .insert(
          codes.map((code) => ({
            organization_id: orgId,
            batch_id: batchId,
            plan_id: planId,
            code,
            status: "AVAILABLE",
          }))
        )
        .select("id, code, status, created_at");

      if (!vErr && inserted) {
        const vouchers = (inserted as Array<Record<string, unknown>>).map((v) => ({
          id: String(v.id),
          organizationId: orgId,
          batchId,
          planId,
          planName: p.name,
          planPrice: Number(p.price),
          planDuration,
          code: String(v.code),
          status: String(v.status),
          createdAt: String(v.created_at),
        }));
        return NextResponse.json(
          {
            success: true,
            data: {
              batch: {
                id: batchId,
                organizationId: orgId,
                planId,
                planName: p.name,
                batchName,
                quantity,
                prefix,
                createdAt: (batch as { created_at: string }).created_at,
              },
              vouchers,
            },
          },
          { status: 201 }
        );
      }

      // Unique-violation (code already exists): roll the batch back and retry
      // with a fresh code stream. Anything else is fatal.
      await db.from("voucher_batches").delete().eq("id", batchId);
      const pgCode = (vErr as { code?: string } | null)?.code;
      if (pgCode !== "23505" || attempt === MAX_ATTEMPTS) {
        console.error("[Vouchers] voucher insert failed:", vErr);
        return jsonError(500, "BATCH_FAILED", "Could not create the vouchers. Please try again.");
      }
    }

    return jsonError(500, "BATCH_FAILED", "Could not create the vouchers. Please try again.");
  } catch (err) {
    console.error("[Vouchers] batch failed:", err);
    return jsonError(500, "SERVER_ERROR", "Something went wrong. Please try again.");
  }
}
