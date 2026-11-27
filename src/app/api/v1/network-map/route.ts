import { NextResponse } from "next/server";
import { isDemoRequest, jsonError } from "@/lib/captive/server";
import { getSeedNetworkMapData } from "@/lib/db/mock-db";
import { getOrgClient } from "@/lib/sites/server";
import {
  buildNetworkMap,
  type AccessPointLite,
  type GisFiberNodeRow,
  type RouterLite,
  type SiteRow,
  type TopologyNodeRow,
} from "@/lib/sites";

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

function rowsOf(res: { data: unknown; error?: { message?: string } | null }): Row[] {
  return (res.data ?? []) as Row[];
}

/** GET /api/v1/network-map — topology, GIS, routers, sites, and APs as one map. */
export async function GET() {
  if (await isDemoRequest()) {
    const seed = getSeedNetworkMapData();
    return NextResponse.json({
      success: true,
      data: { ...seed, ...buildNetworkMap(seed) },
      demo: true,
    });
  }

  try {
    const ctx = await getOrgClient();
    if (!ctx.ok) return ctx.response;
    const { supabase, orgId } = ctx;

    const [sitesRes, routersRes, accessPointsRes, topologyRes, gisRes] = await Promise.all([
      supabase
        .from("sites")
        .select("id, name, latitude, longitude, is_active")
        .eq("organization_id", orgId)
        .order("name", { ascending: true })
        .limit(500),
      supabase.from("routers").select("id, site_id, name, status").eq("organization_id", orgId).limit(1000),
      supabase
        .from("access_points")
        .select("id, site_id, router_id, name, status")
        .eq("organization_id", orgId)
        .limit(1000),
      supabase
        .from("topology_nodes")
        .select("id, node_code, name, node_type, parent_node_id, site_id, status, subscriber_count")
        .eq("organization_id", orgId)
        .limit(1000),
      supabase
        .from("gis_fiber_nodes")
        .select("id, site_id, code, name, node_kind, latitude, longitude, total_ports, occupied_ports, status")
        .eq("organization_id", orgId)
        .limit(1000),
    ]);

    const warnings: string[] = [];
    const take = (label: string, res: { data: unknown; error?: { message?: string } | null }) => {
      if (res.error) {
        warnings.push(`${label}: ${res.error.message ?? "query failed"}`);
        return [] as Row[];
      }
      return rowsOf(res);
    };

    const sites: SiteRow[] = take("sites", sitesRes).map((s) => ({
      id: String(s.id),
      name: String(s.name ?? "Site"),
      latitude: num(s.latitude),
      longitude: num(s.longitude),
      isActive: s.is_active === undefined ? true : Boolean(s.is_active),
    }));
    const routers: RouterLite[] = take("routers", routersRes).map((r) => ({
      id: String(r.id),
      siteId: str(r.site_id),
      name: str(r.name) ?? undefined,
      status: str(r.status) ?? undefined,
    }));
    const accessPoints: AccessPointLite[] = take("access points", accessPointsRes).map((a) => ({
      id: String(a.id),
      siteId: str(a.site_id),
      routerId: str(a.router_id),
      name: str(a.name) ?? undefined,
      status: str(a.status) ?? undefined,
    }));
    const topologyNodes: TopologyNodeRow[] = take("topology", topologyRes).map((n) => ({
      id: String(n.id),
      nodeCode: String(n.node_code ?? ""),
      name: String(n.name ?? "Node"),
      nodeType: String(n.node_type ?? ""),
      parentNodeId: str(n.parent_node_id),
      siteId: str(n.site_id),
      status: str(n.status) ?? undefined,
      subscriberCount: n.subscriber_count === null ? null : Number(n.subscriber_count) || 0,
    }));
    const gisNodes: GisFiberNodeRow[] = take("GIS nodes", gisRes).map((g) => ({
      id: String(g.id),
      code: String(g.code ?? ""),
      name: String(g.name ?? "GIS node"),
      nodeKind: String(g.node_kind ?? ""),
      siteId: str(g.site_id),
      latitude: Number(g.latitude) || 0,
      longitude: Number(g.longitude) || 0,
      totalPorts: g.total_ports === null ? null : Number(g.total_ports) || 0,
      occupiedPorts: g.occupied_ports === null ? null : Number(g.occupied_ports) || 0,
      status: str(g.status) ?? undefined,
    }));

    const input = { sites, routers, accessPoints, topologyNodes, gisNodes };
    return NextResponse.json({
      success: true,
      data: { ...input, ...buildNetworkMap(input), ...(warnings.length ? { warnings } : {}) },
    });
  } catch (err) {
    console.error("[Network map] load failed:", err);
    return jsonError(503, "NETWORK_MAP_UNAVAILABLE", "Could not load the network map. Please try again.");
  }
}
