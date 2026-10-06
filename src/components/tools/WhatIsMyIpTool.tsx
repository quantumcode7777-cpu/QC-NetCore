"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Globe,
  RefreshCw,
  Copy,
  Check,
  Building2,
  Network,
  MapPin,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

interface IpInfo {
  ip: string;
  version: string;
  isp: string;
  org: string;
  asn: string;
  country: string;
  region?: string | null;
  city?: string | null;
  timezone?: string | null;
}

export function WhatIsMyIpTool() {
  const [info, setInfo] = useState<IpInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const lookupIp = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Primary lookup via QC NetCore server-side endpoint
      const res = await fetch(`/api/v1/tools/ip-lookup?t=${Date.now()}`, {
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.success && data?.ip) {
          setInfo({
            ip: data.ip,
            version: data.version || (data.ip.includes(":") ? "IPv6" : "IPv4"),
            isp: data.isp || "Public Network Provider",
            org: data.org || data.isp || "Autonomous System Network",
            asn: data.asn || "N/A",
            country: data.country || "Unknown",
            region: data.region || null,
            city: data.city || null,
            timezone: data.timezone || "UTC",
          });
          setLoading(false);
          return;
        }
      }

      // 2. Client-side fallback if server enrichment is unavailable
      const clientRes = await fetch("https://ipwho.is/", { cache: "no-store" });
      if (clientRes.ok) {
        const cData = await clientRes.json();
        if (cData && cData.success !== false && cData.ip) {
          setInfo({
            ip: String(cData.ip),
            version:
              cData.type || (String(cData.ip).includes(":") ? "IPv6" : "IPv4"),
            isp:
              cData.connection?.isp ||
              cData.connection?.org ||
              "Public Network Provider",
            org:
              cData.connection?.org ||
              cData.connection?.isp ||
              "Autonomous System Network",
            asn: cData.connection?.asn
              ? `AS${String(cData.connection.asn).replace(/^AS/i, "")}`
              : "N/A",
            country: cData.country || "Unknown",
            region: cData.region || null,
            city: cData.city || null,
            timezone: cData.timezone?.id || "UTC",
          });
          setLoading(false);
          return;
        }
      }

      throw new Error("Could not resolve public IP information.");
    } catch {
      setError(
        "Unable to retrieve public IP details right now. Please check your connection and try again."
      );
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    lookupIp();
  }, [lookupIp]);

  const handleCopy = async () => {
    if (!info?.ip) return;
    try {
      await navigator.clipboard.writeText(info.ip);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Refresh Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <h3 className="text-base font-extrabold text-foreground">
              Public IP &amp; Autonomous System Lookup
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live inspection of your public egress IP address, upstream ISP, and BGP Autonomous System Number (ASN).
          </p>
        </div>

        <button
          type="button"
          onClick={lookupIp}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-foreground bg-surface-subtle border border-border hover:bg-surface-elevated hover:border-primary/40 disabled:opacity-60 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>{loading ? "Checking..." : "Refresh IP Lookup"}</span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-500 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={lookupIp}
            className="px-3.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold text-xs self-start sm:self-auto"
          >
            Retry Lookup
          </button>
        </div>
      )}

      {loading && !info ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
          <div className="md:col-span-3 h-24 rounded-2xl bg-surface-subtle border border-border" />
          <div className="h-24 rounded-2xl bg-surface-subtle border border-border" />
          <div className="h-24 rounded-2xl bg-surface-subtle border border-border" />
          <div className="h-24 rounded-2xl bg-surface-subtle border border-border" />
        </div>
      ) : info ? (
        <div className="space-y-4">
          {/* Primary Public IP Banner */}
          <div className="p-5 rounded-2xl bg-surface-subtle border border-primary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Your Public Egress IP Address
                </span>
                <span className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[10px] font-extrabold text-primary">
                  {info.version}
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono break-all">
                {info.ip}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface border border-border hover:border-primary/40 text-xs font-bold text-foreground transition-colors self-start sm:self-center cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-500">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Copy IP</span>
                </>
              )}
            </button>
          </div>

          {/* Detailed Network Telemetry Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-2xl bg-surface-subtle border border-border space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase">
                <span>ISP / Provider</span>
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div className="text-sm font-extrabold text-foreground">
                {info.isp}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Upstream transit / access provider
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-subtle border border-border space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase">
                <span>Organization &amp; ASN</span>
                <Network className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-sm font-extrabold text-foreground font-mono">
                {info.asn !== "N/A" ? `${info.asn} • ${info.org}` : info.org}
              </div>
              <div className="text-[11px] text-muted-foreground">
                BGP routing autonomous system
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-subtle border border-border space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase">
                <span>Network Region</span>
                <MapPin className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-sm font-extrabold text-foreground">
                {[info.city, info.region, info.country]
                  .filter(Boolean)
                  .join(", ") || info.country}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Timezone: {info.timezone || "UTC"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>
              Resolved live at runtime. Only public routing and autonomous system metadata is displayed.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
