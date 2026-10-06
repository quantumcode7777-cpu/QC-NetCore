// ====================================================================
// G-TECH ISP OPERATING SYSTEM
// NOC Statistics Service — Data Access Layer
// Supports Real Multi-Tenant Database Metrics & Demo Dataset Isolation
// ====================================================================

import type { NOCStats, NetworkAlert } from "@/types";
import { getSeedNOCStats, SEED_ALERTS } from "@/lib/db/mock-db";
import { handleSupabaseError } from "@/lib/supabase/errors";
import type { ServiceResult } from "./customers.service";

const SUPABASE_READY = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://[PROJECT_REF].supabase.co"
);

export class NOCService {
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

  static async getStats(isDemoParam?: boolean): Promise<ServiceResult<NOCStats>> {
    const isDemo = await this.checkIsDemo(isDemoParam);

    if (isDemo) {
      return { data: getSeedNOCStats(), error: null };
    }

    const emptyStats: NOCStats = {
      totalSubscribers: 0,
      activeSubscribers: 0,
      onlinePppoe: 0,
      onlineHotspot: 0,
      sessionsAvailable: false,
      expiringIn24h: 0,
      suspendedCount: 0,
      totalRouters: 0,
      onlineRouters: 0,
      currentBandwidthMbps: { download: 0, upload: 0 },
      revenueToday: 0,
      revenueThisMonth: 0,
      recentAlerts: [],
    };

    if (!SUPABASE_READY) {
      return { data: emptyStats, error: null };
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

      let subsQuery = supabase
        .from("subscriptions")
        .select("status, end_time", { count: "exact" })
        .in("status", ["ACTIVE", "GRACE", "SUSPENDED", "EXPIRED"]);
      let routersQuery = supabase
        .from("routers")
        .select("status", { count: "exact" });
      let alertsQuery = supabase
        .from("network_alerts")
        .select("*")
        .eq("is_resolved", false)
        .order("created_at", { ascending: false })
        .limit(10);
      let revenueQuery = supabase
        .from("payments")
        .select("amount, created_at")
        .eq("status", "COMPLETED")
        .gte("created_at", new Date(new Date(new Date().setDate(1)).setHours(0, 0, 0, 0)).toISOString());

      if (orgId) {
        subsQuery = subsQuery.eq("organization_id", orgId);
        routersQuery = routersQuery.eq("organization_id", orgId);
        alertsQuery = alertsQuery.eq("organization_id", orgId);
        revenueQuery = revenueQuery.eq("organization_id", orgId);
      }

      const [subscribersResult, routersResult, alertsResult, revenueResult] =
        await Promise.allSettled([
          subsQuery,
          routersQuery,
          alertsQuery,
          revenueQuery,
        ]);

      let totalSubscribers = 0;
      let activeSubscribers = 0;
      let suspendedCount = 0;
      let expiringIn24h = 0;

      if (subscribersResult.status === "fulfilled" && !subscribersResult.value.error) {
        const subs = subscribersResult.value.data ?? [];
        totalSubscribers = subscribersResult.value.count ?? subs.length;
        activeSubscribers = subs.filter((s) => s.status === "ACTIVE").length;
        suspendedCount = subs.filter((s) => s.status === "SUSPENDED").length;
        const now = Date.now();
        const in24h = now + 24 * 60 * 60 * 1000;
        expiringIn24h = subs.filter((s) => {
          if (s.status !== "ACTIVE") return false;
          const end = new Date(s.end_time as string).getTime();
          return end >= now && end <= in24h;
        }).length;
      }

      let totalRouters = 0;
      let onlineRouters = 0;
      if (routersResult.status === "fulfilled" && !routersResult.value.error) {
        const routers = routersResult.value.data ?? [];
        totalRouters = routersResult.value.count ?? routers.length;
        onlineRouters = routers.filter((r) => r.status === "ONLINE").length;
      }

      const recentAlerts: NetworkAlert[] = [];
      if (alertsResult.status === "fulfilled" && !alertsResult.value.error) {
        const alerts = alertsResult.value.data ?? [];
        recentAlerts.push(
          ...alerts.map((a: Record<string, unknown>) => ({
            id: a.id as string,
            organizationId: a.organization_id as string,
            routerId: a.router_id as string | undefined,
            severity: a.severity as NetworkAlert["severity"],
            title: a.title as string,
            message: a.message as string,
            isResolved: Boolean(a.is_resolved),
            createdAt: a.created_at as string,
          }))
        );
      }

      let revenueToday = 0;
      let revenueThisMonth = 0;
      if (revenueResult.status === "fulfilled" && !revenueResult.value.error) {
        const startOfToday = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
        for (const p of (revenueResult.value.data ?? []) as Record<string, unknown>[]) {
          const amt = Number(p.amount ?? 0);
          revenueThisMonth += amt;
          if (new Date(p.created_at as string).getTime() >= startOfToday) revenueToday += amt;
        }
      }

      const stats: NOCStats = {
        totalSubscribers,
        activeSubscribers,
        // No live-session source (RADIUS accounting / router API) is connected here yet.
        // Report 0 and flag it so the UI shows "not available" rather than an invented split.
        onlinePppoe: 0,
        onlineHotspot: 0,
        sessionsAvailable: false,
        expiringIn24h,
        suspendedCount,
        totalRouters,
        onlineRouters,
        currentBandwidthMbps: { download: 0, upload: 0 },
        revenueToday,
        revenueThisMonth,
        recentAlerts: recentAlerts.length > 0 ? recentAlerts : [],
      };

      return { data: stats, error: null };
    } catch (err) {
      const appError = handleSupabaseError(err, "noc.stats");
      return { data: emptyStats, error: appError.userMessage };
    }
  }
}
