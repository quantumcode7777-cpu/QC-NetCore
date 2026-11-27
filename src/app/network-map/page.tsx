"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Network, RefreshCw, Router as RouterIcon, Wifi } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, btnClass } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { useAuth } from "@/lib/auth/auth-context";
import { getSeedNetworkMapData } from "@/lib/db/mock-db";
import {
  buildNetworkMap,
  type AccessPointLite,
  type GisFiberNodeRow,
  type MapNode,
  type MapNodeKind,
  type NetworkMap,
  type RouterLite,
  type SiteRow,
  type TopologyNodeRow,
} from "@/lib/sites";
import { cn } from "@/lib/utils";

interface NetworkMapData extends NetworkMap {
  sites: SiteRow[];
  routers: RouterLite[];
  accessPoints: AccessPointLite[];
  topologyNodes: TopologyNodeRow[];
  gisNodes: GisFiberNodeRow[];
  warnings?: string[];
}

const KIND_COLOR: Record<MapNodeKind, string> = {
  site: "var(--primary)",
  router: "var(--success)",
  "access-point": "var(--warning)",
  topology: "var(--chart-3, var(--primary))",
  gis: "var(--muted-foreground)",
};

const KIND_LABEL: Record<MapNodeKind, string> = {
  site: "Site",
  router: "Router",
  "access-point": "Access point",
  topology: "Topology node",
  gis: "GIS node",
};

const NODE_RADIUS: Record<MapNodeKind, number> = {
  site: 2.4,
  router: 1.9,
  "access-point": 1.5,
  topology: 1.8,
  gis: 1.3,
};

export default function NetworkMapPage() {
  const { isDemoMode } = useAuth();
  const [data, setData] = useState<NetworkMapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [siteFilter, setSiteFilter] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    if (isDemoMode) {
      const seed = getSeedNetworkMapData();
      setData({ ...seed, ...buildNetworkMap(seed) });
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/v1/network-map");
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Could not load the network map.");
      setData(json.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the network map.");
    } finally {
      setIsLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    void load();
  }, [load]);

  const nodeById = useMemo(
    () => new Map<string, MapNode>((data?.nodes ?? []).map((n) => [n.id, n])),
    [data?.nodes]
  );

  const highlightedSite = siteFilter || null;
  const isHighlighted = (node: MapNode) =>
    !highlightedSite || !node.siteId || node.siteId === highlightedSite;

  const totals = useMemo(
    () => ({
      sites: data?.sites.length ?? 0,
      routers: data?.routers.length ?? 0,
      accessPoints: data?.accessPoints.length ?? 0,
      gis: data?.gisNodes.length ?? 0,
    }),
    [data]
  );

  return (
    <AppShell title="Network Map">
      <PageHeader
        title="Network Map"
        description="Topology, coverage points, routers, and wireless access points in one view"
        actions={
          <button type="button" onClick={() => void load()} disabled={isLoading} className={btnClass("secondary")}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      {error && <ErrorState title="Network map could not be loaded" detail={error} onRetry={() => void load()} />}
      {data?.warnings && data.warnings.length > 0 && (
        <p role="status" className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {data.warnings.join("; ")}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Sites", value: totals.sites, icon: Network },
          { label: "Routers", value: totals.routers, icon: RouterIcon },
          { label: "Access points", value: totals.accessPoints, icon: Wifi },
          { label: "GIS nodes", value: totals.gis, icon: AlertTriangle },
        ].map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="rounded-lg border border-border bg-surface p-3 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {m.label}
              </div>
              <div className="tabular mt-1 text-xl font-semibold">{m.value}</div>
            </div>
          );
        })}
      </div>

      {isLoading && !data ? (
        <Skeleton className="h-[28rem]" />
      ) : !data || data.nodes.length === 0 ? (
        <EmptyState
          icon={Network}
          title="No topology data yet"
          description="Add sites, routers, or topology nodes to build the network map. GIS coverage points appear here too."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="rounded-lg border border-border bg-surface shadow-xs" aria-label="Network topology diagram">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
              <div>
                <h2 className="text-sm font-semibold">Topology</h2>
                <p className="text-xs text-muted-foreground">
                  {data.schematic
                    ? "Schematic view — no coordinates are recorded yet"
                    : "Geographic view from site and GIS coordinates"}
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Site
                <select
                  value={siteFilter}
                  onChange={(e) => setSiteFilter(e.target.value)}
                  className="rounded-md border border-border bg-surface-subtle px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="">All sites</option>
                  {data.sites.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
            </header>

            <div className="p-3">
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label={`Network map with ${data.nodes.length} nodes and ${data.links.length} links`}
                className="h-[26rem] w-full rounded-md border border-border-subtle bg-surface-subtle/40"
              >
                <title>Network topology</title>
                <desc>
                  Sites, routers, access points, topology nodes, and GIS coverage points connected by their recorded
                  relationships.
                </desc>
                {data.links.map((link, i) => {
                  const from = nodeById.get(link.from);
                  const to = nodeById.get(link.to);
                  if (!from || !to) return null;
                  const dim = highlightedSite && !isHighlighted(from) && !isHighlighted(to);
                  return (
                    <line
                      key={`${link.from}-${link.to}-${i}`}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke="var(--border-strong)"
                      strokeWidth={0.35}
                      opacity={dim ? 0.15 : 0.75}
                    />
                  );
                })}
                {data.nodes.map((node) => (
                  <g key={node.id} opacity={isHighlighted(node) ? 1 : 0.2}>
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={NODE_RADIUS[node.kind]}
                      fill={
                        node.status === "OFFLINE" || node.status === "DEGRADED" || node.status === "INACTIVE"
                          ? "var(--muted-foreground)"
                          : KIND_COLOR[node.kind]
                      }
                      stroke="var(--surface)"
                      strokeWidth={0.5}
                    >
                      <title>{`${KIND_LABEL[node.kind]}: ${node.label} (${node.sublabel})`}</title>
                    </circle>
                    {node.kind === "site" && (
                      <text
                        x={node.x}
                        y={node.y - NODE_RADIUS[node.kind] - 1}
                        textAnchor="middle"
                        fontSize={2.4}
                        fill="var(--foreground)"
                      >
                        {node.label.length > 26 ? `${node.label.slice(0, 24)}…` : node.label}
                      </text>
                    )}
                  </g>
                ))}
              </svg>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                {(Object.keys(KIND_LABEL) as MapNodeKind[]).map((kind) => (
                  <span key={kind} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: KIND_COLOR[kind] }} aria-hidden="true" />
                    {KIND_LABEL[kind]}
                  </span>
                ))}
              </div>

              <table className="sr-only">
                <caption>Network map nodes</caption>
                <thead><tr><th>Type</th><th>Name</th><th>Status</th></tr></thead>
                <tbody>
                  {data.nodes.map((n) => (
                    <tr key={n.id}>
                      <td>{KIND_LABEL[n.kind]}</td>
                      <td>{n.label}</td>
                      <td>{n.status ?? "Unknown"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="space-y-4">
            <section className="rounded-lg border border-border bg-surface shadow-xs">
              <header className="border-b border-border px-4 py-2.5">
                <h2 className="text-sm font-semibold">Access points</h2>
                <p className="text-xs text-muted-foreground">Wireless inventory at each site</p>
              </header>
              {data.accessPoints.length === 0 ? (
                <EmptyState icon={Wifi} title="No access points" description="Add access points to inventory them by site." className="py-6" />
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {data.accessPoints.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{a.name || "Access point"}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {data.sites.find((s) => s.id === a.siteId)?.name || "Unassigned site"}
                        </div>
                      </div>
                      <span className={cn("text-[10px] font-semibold uppercase", a.status === "ONLINE" ? "text-success" : "text-muted-foreground")}>
                        {a.status || "UNKNOWN"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-lg border border-border bg-surface shadow-xs">
              <header className="border-b border-border px-4 py-2.5">
                <h2 className="text-sm font-semibold">GIS coverage</h2>
                <p className="text-xs text-muted-foreground">POPs, cabinets, and NAP boxes</p>
              </header>
              {data.gisNodes.length === 0 ? (
                <EmptyState icon={Network} title="No GIS nodes" description="Coverage points with coordinates will appear here." className="py-6" />
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {data.gisNodes.map((g) => {
                    const totalPorts = Number(g.totalPorts ?? 0);
                    const occupiedPorts = Number(g.occupiedPorts ?? 0);
                    const pct = totalPorts > 0 ? Math.round((occupiedPorts / totalPorts) * 100) : 0;
                    return (
                      <li key={g.id} className="space-y-1.5 px-4 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{g.code || g.name}</span>
                          <span className="tabular text-xs text-muted-foreground">{occupiedPorts}/{totalPorts} ports</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}
