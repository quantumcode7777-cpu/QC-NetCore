"use client";

import React, { useEffect, useState } from "react";
import {
  Radio,
  MapPin,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { btnClass } from "@/components/ui/PageHeader";
import { SEED_OLTS, SEED_ONTS, SEED_GIS_NODES } from "@/lib/db/os-2027-seed";
import {
  classifyOpticalPower,
  buildSubscriberControlCommand,
  OntDevice,
} from "@/lib/network/olt-cpe";
import { checkGisServiceability } from "@/lib/network/topology-gis-automation";
import { useAuth } from "@/lib/auth/auth-context";

export type RoutersViewMode = "MIKROTIK_BNG" | "GPON_OLT_ONT" | "GIS_NAP_COVERAGE";

export function RoutersModeTabs({
  mode,
  onChange,
}: {
  mode: RoutersViewMode;
  onChange: (m: RoutersViewMode) => void;
}) {
  const tabs: Array<{ id: RoutersViewMode; label: string }> = [
    { id: "MIKROTIK_BNG", label: "MikroTik BNG Routers" },
    { id: "GPON_OLT_ONT", label: "GPON / XGS-PON OLTs & ONTs" },
    { id: "GIS_NAP_COVERAGE", label: "GIS Fiber & NAP Coverage" },
  ];

  return (
    <div
      role="tablist"
      aria-label="Network infrastructure views"
      className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-surface p-1.5 shadow-xs"
    >
      {tabs.map((t) => {
        const active = mode === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function OltAndGisPanels({ mode }: { mode: RoutersViewMode }) {
  const { isDemoMode } = useAuth();
  const [onts, setOnts] = useState<OntDevice[]>(() =>
    isDemoMode ? SEED_ONTS : []
  );
  const [omciOutput, setOmciOutput] = useState<string | null>(null);

  // GIS Feasibility Form
  const [prospectLat, setProspectLat] = useState(isDemoMode ? "-1.2956" : "");
  const [prospectLng, setProspectLng] = useState(isDemoMode ? "36.7869" : "");

  useEffect(() => {
    setOnts(isDemoMode ? SEED_ONTS : []);
    setProspectLat(isDemoMode ? "-1.2956" : "");
    setProspectLng(isDemoMode ? "36.7869" : "");
  }, [isDemoMode]);

  if (mode === "MIKROTIK_BNG") return null;

  const olts = isDemoMode ? SEED_OLTS : [];
  const gisNodes = isDemoMode ? SEED_GIS_NODES : [];

  const gisResult = checkGisServiceability({
    latitude: Number(prospectLat) || 0,
    longitude: Number(prospectLng) || 0,
    gisNodes,
  });

  const handleRebootOnt = (ont: OntDevice) => {
    const cmd = buildSubscriberControlCommand({
      action: "REBOOT_ONT",
      username: ont.accountNumber || ont.serialNumber,
      nasIpAddress: "10.200.1.10",
      ontSerial: ont.serialNumber,
      ponPortLabel: ont.ponPortLabel,
    });
    setOmciOutput(`${cmd.summary}\n${cmd.commandPayload}`);
    setOnts((prev) =>
      prev.map((o) =>
        o.id === ont.id ? { ...o, lastSeenAt: new Date().toISOString() } : o
      )
    );
  };

  return (
    <div className="space-y-4">
      {mode === "GPON_OLT_ONT" && (
        <>
          {/* OLT Chassis Summary */}
          {olts.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-8 text-center text-xs text-muted-foreground shadow-xs">
              No GPON / XGS-PON OLT chassis configured yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {olts.map((olt) => (
                <div
                  key={olt.id}
                  className="rounded-lg border border-border bg-surface p-4 shadow-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Radio className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold">{olt.name}</h3>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {olt.vendor} {olt.model} · {olt.siteName}
                      </p>
                    </div>
                    <StatusBadge status={olt.status} />
                  </div>

                  <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Mgmt IP</dt>
                      <dd className="font-mono font-medium">{olt.managementIp}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">PON Ports</dt>
                      <dd className="tabular font-semibold">
                        {olt.totalPonPorts} ({olt.ponType})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Active ONTs</dt>
                      <dd className="tabular font-semibold text-primary">
                        {olt.activeOntCount}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Chassis Temp</dt>
                      <dd className="tabular font-mono">{olt.temperatureC}°C</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          )}

          {/* Subscriber ONT Optical Power & TR-369 Table */}
          <section className="rounded-lg border border-border bg-surface shadow-xs">
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold">
                  Registered Subscriber ONTs / ONUs &amp; Optical Power Budget
                </h3>
                <p className="text-xs text-muted-foreground">
                  ITU-T G.984 Class B+ threshold: -15.0 to -24.5 dBm optimal; &lt;
                  -27.0 dBm triggers LOS splice alarm.
                </p>
              </div>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[54rem] text-left text-sm">
                <thead className="border-b border-border bg-surface-subtle text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">ONT Serial / Model</th>
                    <th className="px-3 py-2 font-medium">Subscriber</th>
                    <th className="px-3 py-2 font-medium">PON Port / VLAN</th>
                    <th className="px-3 py-2 text-right font-medium">
                      ONU RX (dBm)
                    </th>
                    <th className="px-3 py-2 font-medium">Optical Health</th>
                    <th className="px-3 py-2 font-medium">TR-369 Wi-Fi</th>
                    <th className="px-3 py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {onts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-8 text-center text-xs text-muted-foreground"
                      >
                        No subscriber ONTs / ONUs registered yet.
                      </td>
                    </tr>
                  ) : (
                    onts.map((ont) => {
                      const opt = classifyOpticalPower(ont.rxPowerDbm);
                      return (
                        <tr key={ont.id} className="hover:bg-surface-subtle">
                          <td className="px-3 py-2">
                            <div className="font-mono text-xs font-semibold">
                              {ont.serialNumber}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {ont.vendorModel}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium">
                              {ont.customerName || "Unassigned"}
                            </div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {ont.accountNumber}
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            <div>{ont.ponPortLabel}</div>
                            <div className="text-muted-foreground">
                              VLAN {ont.serviceVlan} · {ont.distanceMeters}m
                            </div>
                          </td>
                          <td
                            className={cn(
                              "tabular px-3 py-2 text-right font-mono font-semibold",
                              opt.badgeTone === "danger"
                                ? "text-danger"
                                : opt.badgeTone === "warning"
                                ? "text-warning"
                                : "text-success"
                            )}
                          >
                            {ont.rxPowerDbm.toFixed(1)} dBm
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "rounded px-2 py-0.5 text-xs font-semibold",
                                opt.badgeTone === "success"
                                  ? "bg-success-soft text-success"
                                  : opt.badgeTone === "warning"
                                  ? "bg-warning-soft text-warning"
                                  : "bg-danger-soft text-danger"
                              )}
                            >
                              {opt.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            <Wifi className="mr-1 inline h-3.5 w-3.5 text-primary" />
                            {ont.wifiSsid} ({ont.connectedClients} hosts)
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleRebootOnt(ont)}
                              className={btnClass("secondary", "h-7 px-2.5 text-xs")}
                            >
                              <RefreshCw className="h-3 w-3" />
                              OMCI Reboot
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {omciOutput && (
              <div className="border-t border-border bg-surface-subtle p-3 font-mono text-xs">
                <pre className="whitespace-pre-wrap">{omciOutput}</pre>
              </div>
            )}
          </section>
        </>
      )}

      {mode === "GIS_NAP_COVERAGE" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* GIS NAP/FAT Port Registry */}
          <section className="rounded-lg border border-border bg-surface shadow-xs lg:col-span-2">
            <header className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">
                GIS Fiber Distribution &amp; NAP / FAT Splitter Box Registry
              </h3>
              <p className="text-xs text-muted-foreground">
                Real-time splitter port occupancy, feeder cable mapping, and GPS
                service coordinates.
              </p>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-surface-subtle text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">NAP Code</th>
                    <th className="px-3 py-2 font-medium">Location Name</th>
                    <th className="px-3 py-2 font-medium">Feeder Cable</th>
                    <th className="px-3 py-2 font-medium">GPS (Lat, Lng)</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Port Occupancy
                    </th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {gisNodes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-8 text-center text-xs text-muted-foreground"
                      >
                        No outside-plant GIS fiber nodes or NAP splitters recorded yet.
                      </td>
                    </tr>
                  ) : (
                    gisNodes.map((node) => {
                      const free = node.totalPorts - node.occupiedPorts;
                      return (
                        <tr key={node.id} className="hover:bg-surface-subtle">
                          <td className="px-3 py-2 font-mono text-xs font-semibold text-primary">
                            {node.code}
                          </td>
                          <td className="px-3 py-2 font-medium">{node.name}</td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                            {node.feederCableCode}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                            {node.latitude.toFixed(4)}, {node.longitude.toFixed(4)}
                          </td>
                          <td className="tabular px-3 py-2 text-right font-mono text-xs">
                            {node.occupiedPorts}/{node.totalPorts} ({free} free)
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "rounded px-2 py-0.5 text-xs font-semibold",
                                node.status === "ACTIVE"
                                  ? "bg-success-soft text-success"
                                  : "bg-danger-soft text-danger"
                              )}
                            >
                              {node.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Prospect Serviceability Calculator */}
          <section className="rounded-lg border border-border bg-surface p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">
                FTTH Drop Serviceability Check
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter a prospect&apos;s GPS coordinates to find the nearest NAP
              splitter with free ports and estimate aerial drop cable length.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="mb-1 block font-medium">Latitude</label>
                <input
                  type="text"
                  placeholder="-1.2956"
                  value={prospectLat}
                  onChange={(e) => setProspectLat(e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium">Longitude</label>
                <input
                  type="text"
                  placeholder="36.7869"
                  value={prospectLng}
                  onChange={(e) => setProspectLng(e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs"
                />
              </div>
            </div>

            {gisNodes.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface-subtle p-3 text-xs text-muted-foreground">
                Add NAP splitter nodes to calculate FTTH drop serviceability.
              </div>
            ) : (
              <div
                className={cn(
                  "rounded-lg border p-3 text-xs",
                  gisResult.serviceable
                    ? "border-success/30 bg-success-soft"
                    : "border-warning/30 bg-warning-soft"
                )}
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  {gisResult.serviceable ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span className="text-success">FTTH Drop Serviceable</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      <span className="text-warning">
                        Splitter / Span Constraint
                      </span>
                    </>
                  )}
                </div>
                <p className="mt-1 text-foreground">{gisResult.feasibilityNote}</p>
                {gisResult.nearestNode && (
                  <div className="mt-2 font-mono text-[11px] text-muted-foreground">
                    Nearest Box: {gisResult.nearestNode.code} · Est. Drop:{" "}
                    {gisResult.estimatedDropCableMeters}m · Free Ports:{" "}
                    {gisResult.availablePorts}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
