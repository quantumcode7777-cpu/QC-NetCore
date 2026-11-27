// ====================================================================
// QC NETCORE OPERATING SYSTEM
// Sites + network map — pure, tenant-agnostic helpers.
//
// No Supabase or Next imports here: the same code runs in route handlers,
// demo-mode pages, and `node --test`.
// ====================================================================

export type PowerBackupType = "UPS" | "SOLAR" | "GENERATOR" | "GRID";

const POWER_TYPES: PowerBackupType[] = ["UPS", "SOLAR", "GENERATOR", "GRID"];

export interface SiteRow {
  id: string;
  name: string;
  locationDescription?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  powerBackupType?: PowerBackupType | null;
  isActive?: boolean;
  createdAt?: string;
}

export interface RouterLite {
  id: string;
  siteId?: string | null;
  name?: string | null;
  status?: string | null;
}

export interface CustomerLite {
  id: string;
  siteId?: string | null;
  status?: string | null;
}

export interface AccessPointLite {
  id: string;
  siteId?: string | null;
  routerId?: string | null;
  name?: string | null;
  status?: string | null;
}

export interface SiteSummary extends SiteRow {
  routerCount: number;
  onlineRouters: number;
  customerCount: number;
  activeCustomers: number;
  accessPointCount: number;
}

/** Site cards: counts are derived from already org-filtered rows. */
export function summarizeSites(
  sites: SiteRow[],
  routers: RouterLite[],
  customers: CustomerLite[],
  accessPoints: AccessPointLite[]
): SiteSummary[] {
  const countBy = <T extends { siteId?: string | null }>(rows: T[], siteId: string) =>
    rows.filter((r) => r.siteId && String(r.siteId) === siteId).length;

  return sites.map((s) => {
    const siteId = String(s.id);
    const siteRouters = routers.filter((r) => r.siteId && String(r.siteId) === siteId);
    const siteCustomers = customers.filter((c) => c.siteId && String(c.siteId) === siteId);
    const siteAps = accessPoints.filter((a) => a.siteId && String(a.siteId) === siteId);
    return {
      ...s,
      isActive: s.isActive !== false,
      routerCount: countBy(routers, siteId),
      onlineRouters: siteRouters.filter((r) => r.status === "ONLINE").length,
      customerCount: countBy(customers, siteId),
      activeCustomers: siteCustomers.filter(
        (c) => c.status === "ACTIVE" || c.status === "GRACE"
      ).length,
      accessPointCount: siteAps.length,
    };
  });
}

export interface SiteInput {
  name: string;
  locationDescription: string | null;
  latitude: number | null;
  longitude: number | null;
  powerBackupType: PowerBackupType | null;
  isActive: boolean;
}

export type SiteValidation =
  | { ok: true; value: SiteInput }
  | { ok: false; status: number; code: string; message: string };

function optionalNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/** Shared validation for create/update so API and forms cannot drift. */
export function validateSiteInput(body: Record<string, unknown>, partial = false): SiteValidation {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
  const name = has("name") ? String(body.name ?? "").trim() : "";
  if (!partial && (!name || name.length > 255)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_NAME",
      message: "Site name is required and must be 255 characters or fewer.",
    };
  }
  if (partial && has("name") && (!name || name.length > 255)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_NAME",
      message: "Site name must be 255 characters or fewer and cannot be empty.",
    };
  }

  const lat = has("latitude") ? optionalNumber(body.latitude) : null;
  const lng = has("longitude") ? optionalNumber(body.longitude) : null;
  if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
    return { ok: false, status: 400, code: "INVALID_LATITUDE", message: "Latitude must be between -90 and 90." };
  }
  if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
    return { ok: false, status: 400, code: "INVALID_LONGITUDE", message: "Longitude must be between -180 and 180." };
  }

  const rawPower = has("powerBackupType") ? body.powerBackupType : null;
  const powerBackupType =
    rawPower === null || rawPower === undefined || rawPower === ""
      ? null
      : POWER_TYPES.includes(String(rawPower) as PowerBackupType)
        ? (String(rawPower) as PowerBackupType)
        : null;
  if (rawPower && powerBackupType === null) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_POWER_BACKUP",
      message: "Power backup must be UPS, SOLAR, GENERATOR, GRID, or empty.",
    };
  }

  const locationRaw = has("locationDescription") ? body.locationDescription : null;
  const locationDescription =
    locationRaw === null || locationRaw === undefined || String(locationRaw).trim() === ""
      ? null
      : String(locationRaw).trim().slice(0, 500);

  return {
    ok: true,
    value: {
      name,
      locationDescription,
      latitude: lat,
      longitude: lng,
      powerBackupType,
      isActive: has("isActive") ? Boolean(body.isActive) : true,
    },
  };
}

export interface TopologyNodeRow {
  id: string;
  nodeCode: string;
  name: string;
  nodeType: string;
  parentNodeId?: string | null;
  siteId?: string | null;
  status?: string | null;
  subscriberCount?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface GisFiberNodeRow {
  id: string;
  code: string;
  name: string;
  nodeKind: string;
  siteId?: string | null;
  latitude: number;
  longitude: number;
  totalPorts?: number | null;
  occupiedPorts?: number | null;
  status?: string | null;
}

export type MapNodeKind = "site" | "router" | "access-point" | "topology" | "gis";

export interface MapNode {
  id: string;
  kind: MapNodeKind;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  latitude?: number;
  longitude?: number;
  status?: string;
  siteId?: string;
}

export interface MapLink {
  from: string;
  to: string;
  kind: "site-router" | "router-ap" | "site-topology" | "topology" | "site-gis";
}

export interface NetworkMap {
  nodes: MapNode[];
  links: MapLink[];
  /** True when no node had usable coordinates and the view fell back to layout. */
  schematic: boolean;
}

const nodeId = (kind: MapNodeKind, id: string) => `${kind}:${id}`;

function topologyDepth(node: TopologyNodeRow, byId: Map<string, TopologyNodeRow>): number {
  let depth = 0;
  let cursor: TopologyNodeRow | undefined = node;
  const seen = new Set<string>([String(node.id)]);
  while (cursor?.parentNodeId && depth < 8) {
    const parent = byId.get(String(cursor.parentNodeId));
    if (!parent || seen.has(String(parent.id))) break;
    seen.add(String(parent.id));
    cursor = parent;
    depth += 1;
  }
  return depth;
}

/**
 * Build a deterministic SVG-ready network map. Nodes with coordinates share
 * one geographic projection; topology-only nodes are laid out by hierarchy
 * depth, and the UI labels the result as schematic when no geo data exists.
 */
export function buildNetworkMap(input: {
  sites: SiteRow[];
  routers: RouterLite[];
  accessPoints: AccessPointLite[];
  topologyNodes: TopologyNodeRow[];
  gisNodes: GisFiberNodeRow[];
}): NetworkMap {
  const nodes: MapNode[] = [];
  const links: MapLink[] = [];
  const geo: Array<{ id: string; lat: number; lng: number }> = [];
  const siteIds = new Set(input.sites.map((s) => String(s.id)));

  for (const s of input.sites) {
    const id = nodeId("site", String(s.id));
    nodes.push({
      id,
      kind: "site",
      label: s.name,
      sublabel: "POP / site",
      x: 0,
      y: 0,
      latitude: s.latitude ?? undefined,
      longitude: s.longitude ?? undefined,
      status: s.isActive === false ? "INACTIVE" : "ACTIVE",
      siteId: String(s.id),
    });
    if (Number.isFinite(s.latitude) && Number.isFinite(s.longitude)) {
      geo.push({ id, lat: Number(s.latitude), lng: Number(s.longitude) });
    }
  }

  for (const r of input.routers) {
    const id = nodeId("router", String(r.id));
    nodes.push({
      id,
      kind: "router",
      label: r.name || "Router",
      sublabel: "MikroTik router",
      x: 0,
      y: 0,
      status: r.status ?? undefined,
      siteId: r.siteId ? String(r.siteId) : undefined,
    });
    if (r.siteId && siteIds.has(String(r.siteId))) {
      links.push({ from: nodeId("site", String(r.siteId)), to: id, kind: "site-router" });
    }
  }

  for (const a of input.accessPoints) {
    const id = nodeId("access-point", String(a.id));
    nodes.push({
      id,
      kind: "access-point",
      label: a.name || "Access point",
      sublabel: "Wireless AP",
      x: 0,
      y: 0,
      status: a.status ?? undefined,
      siteId: a.siteId ? String(a.siteId) : undefined,
    });
    if (a.routerId) {
      links.push({ from: nodeId("router", String(a.routerId)), to: id, kind: "router-ap" });
    } else if (a.siteId && siteIds.has(String(a.siteId))) {
      links.push({ from: nodeId("site", String(a.siteId)), to: id, kind: "site-gis" });
    }
  }

  const topologyById = new Map(input.topologyNodes.map((n) => [String(n.id), n]));
  const depthCounts = new Map<number, number>();
  const depths = input.topologyNodes.map((n) => {
    const depth = topologyDepth(n, topologyById);
    depthCounts.set(depth, (depthCounts.get(depth) ?? 0) + 1);
    return depth;
  });
  const depthSeen = new Map<number, number>();
  input.topologyNodes.forEach((n, i) => {
    const depth = depths[i];
    const index = depthSeen.get(depth) ?? 0;
    depthSeen.set(depth, index + 1);
    const total = Math.max(1, depthCounts.get(depth) ?? 1);
    nodes.push({
      id: nodeId("topology", String(n.id)),
      kind: "topology",
      label: n.name || n.nodeCode,
      sublabel: n.nodeType.replaceAll("_", " ").toLowerCase(),
      x: 10 + ((index + 1) / (total + 1)) * 80,
      y: 8 + depth * 18,
      status: n.status ?? undefined,
      siteId: n.siteId ? String(n.siteId) : undefined,
    });
    if (n.parentNodeId && topologyById.has(String(n.parentNodeId))) {
      links.push({
        from: nodeId("topology", String(n.parentNodeId)),
        to: nodeId("topology", String(n.id)),
        kind: "topology",
      });
    } else if (n.siteId && siteIds.has(String(n.siteId))) {
      links.push({
        from: nodeId("site", String(n.siteId)),
        to: nodeId("topology", String(n.id)),
        kind: "site-topology",
      });
    }
  });

  for (const g of input.gisNodes) {
    const id = nodeId("gis", String(g.id));
    nodes.push({
      id,
      kind: "gis",
      label: g.code || g.name,
      sublabel: g.nodeKind.replaceAll("_", " ").toLowerCase(),
      x: 0,
      y: 0,
      latitude: Number(g.latitude),
      longitude: Number(g.longitude),
      status: g.status ?? undefined,
      siteId: g.siteId ? String(g.siteId) : undefined,
    });
    if (Number.isFinite(g.latitude) && Number.isFinite(g.longitude)) {
      geo.push({ id, lat: Number(g.latitude), lng: Number(g.longitude) });
    }
    if (g.siteId && siteIds.has(String(g.siteId))) {
      links.push({ from: nodeId("site", String(g.siteId)), to: id, kind: "site-gis" });
    }
  }

  const schematic = geo.length === 0;
  if (!schematic) {
    const lats = geo.map((g) => g.lat);
    const lngs = geo.map((g) => g.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latSpan = Math.max(0.0001, maxLat - minLat);
    const lngSpan = Math.max(0.0001, maxLng - minLng);
    const geoById = new Map(geo.map((g) => [g.id, g]));
    for (const node of nodes) {
      const point = geoById.get(node.id);
      if (!point) continue;
      node.x = 8 + ((point.lng - minLng) / lngSpan) * 84;
      // Screen Y grows downward, so invert latitude.
      node.y = 8 + ((maxLat - point.lat) / latSpan) * 84;
    }
  } else {
    // No coordinates anywhere: spread non-topology nodes in a simple grid.
    const others = nodes.filter((n) => n.kind !== "topology");
    others.forEach((node, i) => {
      node.x = 12 + (i % 5) * 19;
      node.y = 14 + Math.floor(i / 5) * 22;
    });
  }

  return { nodes, links, schematic };
}

export function formatCoordinates(latitude?: number | null, longitude?: number | null): string {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "Coordinates not set";
  return `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
}
