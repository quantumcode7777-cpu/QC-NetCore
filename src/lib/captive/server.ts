// ====================================================================
// QC NetCore — Captive Portal Customizer: server-side helpers
// Reuses the existing auth/profile/RLS architecture (no new tenant system).
// NEVER import this into client components.
// ====================================================================

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildAssetPrefix,
  isOrgAssetUrl,
  type PlanLike,
  type PortalConfigVersion,
  type PortalConfigStatus,
} from "./config";

export const SUPABASE_READY = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://[PROJECT_REF].supabase.co"
);

export const PORTAL_ADMIN_ROLES = new Set(["super_admin", "isp_owner", "isp_admin"]);

/** The new tables/functions are not in the generated Database types yet. */
export type AnyClient = SupabaseClient<any, "public", any>;

export function jsonError(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, code, message, error: message, ...extra }, { status });
}

export async function isDemoRequest(): Promise<boolean> {
  try {
    const store = await cookies();
    return store.get("gtech_demo_mode")?.value === "true";
  } catch {
    return false;
  }
}

export interface AdminContext {
  supabase: AnyClient;
  userId: string;
  userEmail: string | null;
  /** Derived from the authenticated profile — NEVER from client input. */
  orgId: string;
  role: string;
}

export type AdminAuth =
  | { ok: true; ctx: AdminContext }
  | { ok: false; response: NextResponse };

/**
 * Resolves the caller's tenant strictly from their session + profile row.
 * Any organization id supplied by the client is ignored by design.
 */
export async function authorizePortalAdmin(): Promise<AdminAuth> {
  if (!SUPABASE_READY) {
    return { ok: false, response: jsonError(503, "BACKEND_UNAVAILABLE", "Portal settings cannot be saved right now. Please try again later.") };
  }
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = (await createSupabaseServerClient()) as unknown as AnyClient;
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return { ok: false, response: jsonError(401, "AUTH_EXPIRED", "Your session has expired. Please sign in again.") };
    }
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id, organization_id, role, is_active")
      .eq("id", user.id)
      .single();
    if (pErr || !profile || !profile.is_active || !profile.organization_id) {
      return { ok: false, response: jsonError(403, "PERMISSION_DENIED", "You don't have permission to perform this action.") };
    }
    if (!PORTAL_ADMIN_ROLES.has(profile.role)) {
      return { ok: false, response: jsonError(403, "PERMISSION_DENIED", "Only administrators can customize the captive portal.") };
    }
    return {
      ok: true,
      ctx: { supabase, userId: user.id, userEmail: user.email ?? null, orgId: profile.organization_id, role: profile.role },
    };
  } catch (err) {
    console.error("[CaptivePortal] authorize failed:", err);
    return { ok: false, response: jsonError(500, "SERVER_ERROR", "Something went wrong. Please try again.") };
  }
}

export function orgAssetPrefix(orgId: string): string {
  return buildAssetPrefix(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", orgId);
}

export function assetValidatorFor(orgId: string): (url: string) => boolean {
  const prefix = orgAssetPrefix(orgId);
  return (url) => isOrgAssetUrl(url, prefix);
}

export function isOrgAssetUrlSafe(url: string, orgId: string): boolean {
  return isOrgAssetUrl(url, orgAssetPrefix(orgId));
}

export interface PortalConfigRow {
  id: string;
  organization_id: string;
  version: number;
  status: PortalConfigStatus;
  config: unknown;
  created_at: string;
  published_at: string | null;
}

export function rowToVersion(row: PortalConfigRow): PortalConfigVersion {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    createdAt: row.created_at,
    publishedAt: row.published_at,
  };
}

/** Maps plan rows to the shape the portal needs (reuses the `plans` table). */
export function mapPlanRows(rows: Array<Record<string, unknown>> | null): PlanLike[] {
  return (rows ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    price: Number(r.price),
    currency: String(r.currency ?? "KES"),
    downloadSpeedKbps: Number(r.download_speed_kbps),
    validityDurationSeconds: Number(r.validity_duration_seconds),
    dataLimitMb: Number(r.data_limit_mb),
  }));
}

export const PLAN_COLUMNS =
  "id, name, price, currency, download_speed_kbps, validity_duration_seconds, data_limit_mb";

export async function logPortalAudit(
  ctx: AdminContext,
  action: string,
  resourceId: string | null,
  userAgent: string | null,
  meta: Record<string, unknown> = {}
) {
  try {
    await ctx.supabase.from("audit_log").insert({
      organization_id: ctx.orgId,
      actor_id: ctx.userId,
      actor_email: ctx.userEmail,
      action,
      resource_type: "captive_portal_config",
      resource_id: resourceId,
      new_data: meta,
      user_agent: userAgent,
    } as never);
  } catch (err) {
    console.error("[CaptivePortal] audit insert failed:", err);
  }
}
