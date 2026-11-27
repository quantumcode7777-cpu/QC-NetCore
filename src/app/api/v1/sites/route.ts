import { NextRequest, NextResponse } from "next/server";
import { isDemoRequest, jsonError } from "@/lib/captive/server";
import { getSeedSitesData } from "@/lib/db/mock-db";
import { getOrgClient } from "@/lib/sites/server";
import { summarizeSites, validateSiteInput, type SiteRow } from "@/lib/sites";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

function str(v: unknown): string | null {
  return v === null || v === undefined ? null : String(v);
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapSite(r: Row): SiteRow {
  return {
    id: String(r.id),
    name: String(r.name ?? "Site"),
    locationDescription: str(r.location_description),
    latitude: num(r.latitude),
    longitude: num(r.longitude),
    powerBackupType:
      r.power_backup_type === "UPS" ||
      r.power_backup_type === "SOLAR" ||
      r.power_backup_type === "GENERATOR" ||
      r.power_backup_type === "GRID"
        ? r.power_backup_type
        : null,
    isActive: r.is_active === undefined ? true : Boolean(r.is_active),
    createdAt: str(r.created_at) ?? undefined,
  };
}

const rowsOf = (res: { data: unknown; error?: { message?: string } | null }): Row[] =>
  ((res.data ?? []) as Row[]);

/** GET /api/v1/sites — site cards with router/customer/AP counts. */
export async function GET() {
  if (await isDemoRequest()) {
    const seed = getSeedSitesData();
    const data = summarizeSites(seed.sites, seed.routers, seed.customers, seed.accessPoints);
    return NextResponse.json({ success: true, count: data.length, data, demo: true });
  }

  try {
    const ctx = await getOrgClient();
    if (!ctx.ok) return ctx.response;
    const { supabase, orgId } = ctx;

    const [sitesRes, routersRes, customersRes, accessPointsRes] = await Promise.all([
      supabase
        .from("sites")
        .select(
          "id, name, location_description, latitude, longitude, power_backup_type, is_active, created_at"
        )
        .eq("organization_id", orgId)
        .order("name", { ascending: true })
        .limit(500),
      supabase.from("routers").select("id, site_id, name, status").eq("organization_id", orgId).limit(1000),
      supabase
        .from("customers")
        .select("id, site_id, status")
        .eq("organization_id", orgId)
        .limit(2000),
      supabase
        .from("access_points")
        .select("id, site_id, router_id, name, status")
        .eq("organization_id", orgId)
        .limit(1000),
    ]);

    if (sitesRes.error) throw sitesRes.error;
    const warnings: string[] = [];
    if (routersRes.error) warnings.push(`routers: ${routersRes.error.message ?? "query failed"}`);
    if (customersRes.error) warnings.push(`customers: ${customersRes.error.message ?? "query failed"}`);
    if (accessPointsRes.error) {
      warnings.push(
        `access points: ${accessPointsRes.error.message ?? "query failed"}. Run migration 025 to enable AP inventory.`
      );
    }

    const data = summarizeSites(
      rowsOf(sitesRes).map(mapSite),
      rowsOf(routersRes).map((r) => ({
        id: String(r.id),
        siteId: str(r.site_id),
        name: str(r.name) ?? undefined,
        status: str(r.status) ?? undefined,
      })),
      rowsOf(customersRes).map((c) => ({
        id: String(c.id),
        siteId: str(c.site_id),
        status: str(c.status) ?? undefined,
      })),
      rowsOf(accessPointsRes).map((a) => ({
        id: String(a.id),
        siteId: str(a.site_id),
        routerId: str(a.router_id),
        name: str(a.name) ?? undefined,
        status: str(a.status) ?? undefined,
      }))
    );

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
      ...(warnings.length ? { warnings } : {}),
    });
  } catch (err) {
    console.error("[Sites] list failed:", err);
    return jsonError(503, "SITES_UNAVAILABLE", "Could not load network sites. Please try again.");
  }
}

/** POST /api/v1/sites — create a POP/site for this organization. */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_REQUEST", "Request body must be JSON.");
  }

  const checked = validateSiteInput(body);
  if (!checked.ok) return jsonError(checked.status, checked.code, checked.message);

  if (await isDemoRequest()) {
    return NextResponse.json(
      {
        success: true,
        demo: true,
        data: {
          id: `site-demo-${Date.now()}`,
          ...checked.value,
          routerCount: 0,
          onlineRouters: 0,
          customerCount: 0,
          activeCustomers: 0,
          accessPointCount: 0,
          createdAt: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  }

  try {
    const ctx = await getOrgClient();
    if (!ctx.ok) return ctx.response;
    const { supabase, orgId } = ctx;

    const { data, error } = await supabase
      .from("sites")
      .insert({
        organization_id: orgId,
        name: checked.value.name,
        location_description: checked.value.locationDescription,
        latitude: checked.value.latitude,
        longitude: checked.value.longitude,
        power_backup_type: checked.value.powerBackupType,
        is_active: checked.value.isActive,
      })
      .select(
        "id, name, location_description, latitude, longitude, power_backup_type, is_active, created_at"
      )
      .single();

    if (error || !data) {
      console.error("[Sites] create failed:", error);
      return jsonError(500, "CREATE_FAILED", "Could not create the site. Please try again.");
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...mapSite(data as Row),
          routerCount: 0,
          onlineRouters: 0,
          customerCount: 0,
          activeCustomers: 0,
          accessPointCount: 0,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[Sites] create failed:", err);
    return jsonError(503, "SITES_UNAVAILABLE", "Could not create the site. Please try again.");
  }
}
