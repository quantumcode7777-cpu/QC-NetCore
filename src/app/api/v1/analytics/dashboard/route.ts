import { NextResponse } from "next/server";
import { isDemoRequest } from "@/lib/captive/server";
import { emptyAnalyticsData } from "@/lib/analytics";
import { getSeedAnalyticsData } from "@/lib/db/mock-db";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return v === null || v === undefined ? undefined : String(v);
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * GET /api/v1/analytics/dashboard
 *
 * Read-only raw rows for the dashboard analytics panels. Uses the
 * session-bound Supabase client, so tenant isolation and staff SELECT
 * policies (RLS) apply unchanged. Attribution happens in `src/lib/analytics`.
 */
export async function GET() {
  if (await isDemoRequest()) {
    return NextResponse.json({ success: true, data: getSeedAnalyticsData(), demo: true });
  }

  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Sign in to view analytics." },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();
    const orgId = str(profile?.organization_id);
    if (!orgId) {
      return NextResponse.json(
        { success: false, error: "No organization is linked to this account." },
        { status: 403 }
      );
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffIso = cutoff.toISOString();

    const [
      paymentsRes,
      subscriptionsRes,
      plansRes,
      vouchersRes,
      pppoeRes,
      routersRes,
      customersRes,
    ] = await Promise.all([
      supabase
        .from("payments")
        .select("id, customer_id, amount, status, created_at, processed_at")
        .eq("organization_id", orgId)
        .eq("status", "COMPLETED")
        .gte("created_at", cutoffIso)
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("subscriptions")
        .select("customer_id, plan_id, status, start_time, end_time")
        .eq("organization_id", orgId)
        .gte("end_time", cutoffIso)
        .limit(1000),
      supabase
        .from("plans")
        .select("id, name, service_type, price")
        .eq("organization_id", orgId)
        .limit(500),
      supabase
        .from("hotspot_vouchers")
        .select("plan_id, first_activated_at")
        .eq("organization_id", orgId)
        .gte("first_activated_at", cutoffIso)
        .limit(1000),
      supabase
        .from("pppoe_accounts")
        .select("customer_id, router_id, username, is_active")
        .eq("organization_id", orgId)
        .limit(1000),
      supabase
        .from("routers")
        .select("id, name, status")
        .eq("organization_id", orgId)
        .order("name", { ascending: true })
        .limit(500),
      supabase
        .from("customers")
        .select("id, full_name, account_number, phone_number")
        .eq("organization_id", orgId)
        .limit(500),
    ]);

    const warnings: string[] = [];
    const rowsOf = (label: string, res: { data: unknown; error: { message?: string } | null }) => {
      if (res.error) {
        warnings.push(`${label}: ${res.error.message ?? "query failed"}`);
        return [] as Row[];
      }
      return (res.data ?? []) as Row[];
    };

    const data = emptyAnalyticsData();
    data.payments = rowsOf("payments", paymentsRes).map((r) => ({
      id: str(r.id),
      customerId: str(r.customer_id) ?? null,
      amount: num(r.amount),
      status: str(r.status),
      createdAt: str(r.created_at) ?? "",
      processedAt: str(r.processed_at) ?? null,
    }));
    data.subscriptions = rowsOf("subscriptions", subscriptionsRes).map((r) => ({
      customerId: str(r.customer_id) ?? "",
      planId: str(r.plan_id) ?? "",
      status: str(r.status),
      startTime: str(r.start_time) ?? "",
      endTime: str(r.end_time) ?? "",
    }));
    data.plans = rowsOf("plans", plansRes).map((r) => ({
      id: str(r.id) ?? "",
      name: str(r.name),
      serviceType: str(r.service_type) ?? "",
      price: num(r.price),
    }));
    data.vouchers = rowsOf("vouchers", vouchersRes).map((r) => ({
      planId: str(r.plan_id) ?? "",
      firstActivatedAt: str(r.first_activated_at) ?? null,
    }));
    data.pppoeAccounts = rowsOf("pppoe accounts", pppoeRes).map((r) => ({
      customerId: str(r.customer_id) ?? "",
      routerId: str(r.router_id) ?? null,
      username: str(r.username),
      // Live DB stores no bytes/session state yet; zeros are honest, not inferred.
      isOnline: false,
      bytesIn: 0,
      bytesOut: 0,
    }));
    data.routers = rowsOf("routers", routersRes).map((r) => ({
      id: str(r.id) ?? "",
      name: str(r.name) ?? "Router",
      status: str(r.status),
    }));
    data.customers = rowsOf("customers", customersRes).map((r) => ({
      id: str(r.id) ?? "",
      fullName: str(r.full_name),
      accountNumber: str(r.account_number),
      phoneNumber: str(r.phone_number),
    }));
    // No accounting/session snapshot table exists yet; never invent history.
    data.usageSnapshots = [];
    data.activitySnapshots = [];
    data.warnings = warnings;

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[Analytics] dashboard data failed:", err);
    return NextResponse.json(
      { success: false, error: "Could not load analytics. Please try again." },
      { status: 503 }
    );
  }
}
