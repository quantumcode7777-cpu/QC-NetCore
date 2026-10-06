// ====================================================================
// G-TECH ISP OPERATING SYSTEM
// Plans Service — Data Access Layer
// Supports Real Multi-Tenant Database & Isolated Demo Plans
// ====================================================================

import type { ServicePlan, ServiceType } from "@/types";
import { SEED_PLANS } from "@/lib/db/mock-db";
import { handleSupabaseError } from "@/lib/supabase/errors";
import type { ServiceResult } from "./customers.service";

const SUPABASE_READY = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://[PROJECT_REF].supabase.co"
);

export class PlansService {
  private static async checkIsDemo(explicitDemo?: boolean): Promise<boolean> {
    if (explicitDemo !== undefined) return explicitDemo;
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      return cookieStore.get("gtech_demo_mode")?.value === "true";
    } catch {
      return false;
    }
  }

  static async list(serviceType?: ServiceType, isDemoParam?: boolean): Promise<ServiceResult<ServicePlan[]>> {
    const isDemo = await this.checkIsDemo(isDemoParam);

    if (isDemo) {
      let data = [...SEED_PLANS];
      if (serviceType) {
        data = data.filter((p) => p.serviceType === serviceType);
      }
      return { data, error: null, count: data.length };
    }

    if (!SUPABASE_READY) {
      return { data: [], error: null, count: 0 };
    }

    try {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServerClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      let orgId: string | undefined;
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", user.id)
          .maybeSingle();
        orgId = profile?.organization_id ?? undefined;
      }

      let query = supabase
        .from("plans")
        .select("*", { count: "exact" })
        .eq("is_active", true)
        .order("price", { ascending: true });

      if (orgId) {
        query = query.eq("organization_id", orgId);
      }
      if (serviceType) {
        query = query.eq("service_type", serviceType);
      }

      const { data, error, count } = await query;

      if (error) {
        const appError = handleSupabaseError(error, "plans.list");
        return { data: null, error: appError.userMessage };
      }

      const plans: ServicePlan[] = (data ?? []).map(mapPlanRow);
      return { data: plans, error: null, count: count ?? plans.length };
    } catch (err) {
      const appError = handleSupabaseError(err, "plans.list");
      return { data: null, error: appError.userMessage };
    }
  }
}

function mapPlanRow(row: Record<string, unknown>): ServicePlan {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    name: row.name as string,
    serviceType: row.service_type as ServiceType,
    downloadSpeedKbps: Number(row.download_speed_kbps),
    uploadSpeedKbps: Number(row.upload_speed_kbps),
    burstDownloadKbps: Number(row.burst_download_kbps ?? 0) || undefined,
    burstUploadKbps: Number(row.burst_upload_kbps ?? 0) || undefined,
    burstThresholdKbps: Number(row.burst_threshold_kbps ?? 0) || undefined,
    burstTimeSeconds: Number(row.burst_time_seconds ?? 0) || undefined,
    priority: Number(row.priority),
    validityDurationSeconds: Number(row.validity_duration_seconds),
    dataLimitMb: Number(row.data_limit_mb),
    price: Number(row.price),
    currency: row.currency as string,
    simultaneousSessions: Number(row.simultaneous_sessions),
    mikrotikRateLimit: row.mikrotik_rate_limit as string,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at as string,
  };
}
