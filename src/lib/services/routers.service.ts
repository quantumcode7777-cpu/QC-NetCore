// ====================================================================
// G-TECH ISP OPERATING SYSTEM
// Routers Service — Data Access Layer
// Supports Real Multi-Tenant Database & Isolated Demo Fleet
// ====================================================================

import type { Router } from "@/types";
import { SEED_ROUTERS } from "@/lib/db/mock-db";
import { handleSupabaseError } from "@/lib/supabase/errors";
import type { ServiceResult } from "./customers.service";

const SUPABASE_READY = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://[PROJECT_REF].supabase.co"
);

const SAFE_ROUTER_COLUMNS = [
  "id",
  "organization_id",
  "site_id",
  "name",
  "management_ip",
  "api_port",
  "api_ssl_port",
  "username",
  "routeros_version",
  "board_model",
  "cpu_load",
  "free_memory_mb",
  "uptime",
  "connection_type",
  "wireguard_public_key",
  "wireguard_tunnel_ip",
  "status",
  "last_seen_at",
  "created_at",
  "updated_at",
].join(",");

export class RoutersService {
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

  static async list(isDemoParam?: boolean): Promise<ServiceResult<Router[]>> {
    const isDemo = await this.checkIsDemo(isDemoParam);

    if (isDemo) {
      return { data: SEED_ROUTERS, error: null, count: SEED_ROUTERS.length };
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
        .from("routers")
        .select(SAFE_ROUTER_COLUMNS, { count: "exact" })
        .order("name", { ascending: true });

      if (orgId) {
        query = query.eq("organization_id", orgId);
      }

      const { data, error, count } = await query;

      if (error) {
        const appError = handleSupabaseError(error, "routers.list");
        return { data: null, error: appError.userMessage };
      }

      const routers: Router[] = (data as unknown as Record<string, unknown>[] ?? []).map(mapRouterRow);
      return { data: routers, error: null, count: count ?? routers.length };
    } catch (err) {
      const appError = handleSupabaseError(err, "routers.list");
      return { data: null, error: appError.userMessage };
    }
  }

  static async updateTelemetry(
    routerId: string,
    telemetry: {
      cpuLoad: number;
      freeMemoryMb: number;
      uptime: string;
      status: Router["status"];
      lastSeenAt?: string;
    }
  ): Promise<ServiceResult<null>> {
    if (!SUPABASE_READY) {
      return { data: null, error: null };
    }

    try {
      const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
      const supabase = createSupabaseServiceClient();

      const { error } = await supabase
        .from("routers")
        .update({
          cpu_load: telemetry.cpuLoad,
          free_memory_mb: telemetry.freeMemoryMb,
          uptime: telemetry.uptime,
          status: telemetry.status,
          last_seen_at: telemetry.lastSeenAt ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", routerId);

      if (error) {
        const appError = handleSupabaseError(error, "routers.updateTelemetry");
        return { data: null, error: appError.userMessage };
      }

      return { data: null, error: null };
    } catch (err) {
      const appError = handleSupabaseError(err, "routers.updateTelemetry");
      return { data: null, error: appError.userMessage };
    }
  }
}

function mapRouterRow(row: Record<string, unknown>): Router {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    siteId: row.site_id as string | undefined,
    name: row.name as string,
    managementIp: row.management_ip as string,
    apiPort: Number(row.api_port),
    apiSslPort: Number(row.api_ssl_port),
    username: row.username as string,
    routerosVersion: row.routeros_version as string,
    boardModel: row.board_model as string,
    cpuLoad: Number(row.cpu_load),
    freeMemoryMb: Number(row.free_memory_mb),
    uptime: row.uptime as string,
    connectionType: row.connection_type as Router["connectionType"],
    wireguardPublicKey: row.wireguard_public_key as string | undefined,
    wireguardTunnelIp: row.wireguard_tunnel_ip as string | undefined,
    status: row.status as Router["status"],
    lastSeenAt: row.last_seen_at as string,
    createdAt: row.created_at as string,
  };
}
