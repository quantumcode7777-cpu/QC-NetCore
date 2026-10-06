"use client";

import React, { useState, useMemo } from "react";
import {
  Network,
  RotateCcw,
  AlertCircle,
  Layers,
  CheckCircle2,
} from "lucide-react";
import {
  calculateIpv4Subnet,
  cidrToMaskUint32,
  uint32ToIpv4,
} from "@/lib/network/free-tools";

const CIDR_OPTIONS = Array.from({ length: 32 }, (_, idx) => {
  const prefix = idx + 1;
  const mask = uint32ToIpv4(cidrToMaskUint32(prefix));
  return { prefix, mask, label: `/${prefix} (${mask})` };
});

export function SubnetCalculatorTool() {
  const [ipInput, setIpInput] = useState("192.168.10.0");
  const [cidrPrefix, setCidrPrefix] = useState<number>(24);
  const [customMaskInput, setCustomMaskInput] = useState("255.255.255.0");
  const [useMaskMode, setUseMaskMode] = useState(false);
  const [splitPrefix, setSplitPrefix] = useState<number>(26);

  const handleCidrChange = (newPrefix: number) => {
    setCidrPrefix(newPrefix);
    setCustomMaskInput(uint32ToIpv4(cidrToMaskUint32(newPrefix)));
    if (splitPrefix < newPrefix) {
      setSplitPrefix(Math.min(32, newPrefix + 2));
    }
  };

  const result = useMemo(() => {
    const cidrOrMask = useMaskMode ? customMaskInput : cidrPrefix;
    return calculateIpv4Subnet(ipInput, cidrOrMask, splitPrefix);
  }, [ipInput, cidrPrefix, customMaskInput, useMaskMode, splitPrefix]);

  const handleReset = () => {
    setIpInput("192.168.10.0");
    setCidrPrefix(24);
    setCustomMaskInput("255.255.255.0");
    setUseMaskMode(false);
    setSplitPrefix(26);
  };

  const applyExample = (ip: string, prefix: number, split: number) => {
    setIpInput(ip);
    setCidrPrefix(prefix);
    setCustomMaskInput(uint32ToIpv4(cidrToMaskUint32(prefix)));
    setUseMaskMode(false);
    setSplitPrefix(split);
  };

  const effectiveCidr = result.valid ? result.cidr : cidrPrefix;

  return (
    <div className="space-y-6">
      {/* Header & Quick Presets */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-primary" />
            <h3 className="text-base font-extrabold text-foreground">
              IPv4 Subnet &amp; Block Split Calculator
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Calculate network boundaries, usable host ranges, netmasks, and split an IPv4 block into smaller subscriber or POP pools.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyExample("192.168.10.0", 24, 26)}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-surface-subtle border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-mono"
          >
            192.168.10.0/24
          </button>
          <button
            type="button"
            onClick={() => applyExample("100.64.0.0", 20, 22)}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-surface-subtle border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-mono"
          >
            CGNAT /20
          </button>
          <button
            type="button"
            onClick={() => applyExample("10.10.0.0", 16, 24)}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-surface-subtle border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-mono"
          >
            PPPoE /16
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-surface border border-border hover:border-primary/40 text-foreground transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Inputs Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="space-y-1.5">
          <label
            htmlFor="subnet-ip-input"
            className="block text-[11px] font-bold text-muted-foreground uppercase"
          >
            IPv4 Address (or IP/CIDR)
          </label>
          <input
            id="subnet-ip-input"
            type="text"
            value={ipInput}
            onChange={(e) => setIpInput(e.target.value)}
            placeholder="e.g. 192.168.10.0 or 10.0.0.1/22"
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-border text-sm font-bold text-foreground focus:outline-none focus:border-primary transition-colors font-mono"
          />
          <span className="block text-[10px] text-muted-foreground">
            Supports dotted quad or inline /CIDR
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="subnet-cidr-select"
              className="block text-[11px] font-bold text-muted-foreground uppercase"
            >
              {useMaskMode ? "Subnet Mask" : "CIDR Prefix / Subnet Mask"}
            </label>
            <button
              type="button"
              onClick={() => setUseMaskMode(!useMaskMode)}
              className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
            >
              {useMaskMode ? "Use /CIDR selector" : "Type custom mask"}
            </button>
          </div>

          {useMaskMode ? (
            <input
              id="subnet-cidr-select"
              type="text"
              value={customMaskInput}
              onChange={(e) => setCustomMaskInput(e.target.value)}
              placeholder="e.g. 255.255.255.0"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-border text-sm font-bold text-foreground focus:outline-none focus:border-primary transition-colors font-mono"
            />
          ) : (
            <select
              id="subnet-cidr-select"
              value={cidrPrefix}
              onChange={(e) => handleCidrChange(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-border text-sm font-bold text-foreground focus:outline-none focus:border-primary transition-colors font-mono"
            >
              {CIDR_OPTIONS.map((opt) => (
                <option key={opt.prefix} value={opt.prefix}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
          <span className="block text-[10px] text-muted-foreground">
            Prefix length (/1 to /32)
          </span>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="subnet-split-select"
            className="block text-[11px] font-bold text-muted-foreground uppercase"
          >
            Split Block Into Subnets
          </label>
          <select
            id="subnet-split-select"
            value={Math.max(effectiveCidr, splitPrefix)}
            onChange={(e) => setSplitPrefix(Number(e.target.value))}
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-border text-sm font-bold text-foreground focus:outline-none focus:border-primary transition-colors font-mono"
          >
            {CIDR_OPTIONS.filter((opt) => opt.prefix >= effectiveCidr).map(
              (opt) => {
                const count = Math.pow(2, opt.prefix - effectiveCidr);
                return (
                  <option key={opt.prefix} value={opt.prefix}>
                    /{opt.prefix} — {count.toLocaleString()}{" "}
                    {count === 1 ? "subnet (no split)" : "subnets"}
                  </option>
                );
              }
            )}
          </select>
          <span className="block text-[10px] text-muted-foreground">
            Subdivide block into smaller pools
          </span>
        </div>
      </div>

      {/* Validation Error or Subnet Readout */}
      {!result.valid ? (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-500 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{result.error}</span>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Primary Subnet Summary Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-surface-subtle border border-border">
              <div className="text-[11px] font-bold text-muted-foreground uppercase">
                Network Address
              </div>
              <div className="text-base sm:text-lg font-extrabold text-foreground font-mono mt-1">
                {result.networkAddress}
              </div>
              <div className="text-[11px] text-primary font-bold font-mono mt-0.5">
                {result.cidrNotation}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-subtle border border-border">
              <div className="text-[11px] font-bold text-muted-foreground uppercase">
                Broadcast Address
              </div>
              <div className="text-base sm:text-lg font-extrabold text-foreground font-mono mt-1">
                {result.broadcastAddress}
              </div>
              <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                Wildcard: {result.wildcardMask}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-subtle border border-border">
              <div className="text-[11px] font-bold text-muted-foreground uppercase">
                Subnet Mask
              </div>
              <div className="text-base sm:text-lg font-extrabold text-foreground font-mono mt-1">
                {result.subnetMask}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Prefix: /{result.cidr}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/30">
              <div className="text-[11px] font-bold text-primary uppercase">
                Usable Hosts
              </div>
              <div className="text-base sm:text-lg font-extrabold text-foreground font-mono mt-1">
                {result.usableHosts.toLocaleString()}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Total IPs: {result.totalAddresses.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Host Range & Scope Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-2xl bg-surface-subtle border border-border">
              <div className="text-[11px] font-bold text-muted-foreground uppercase">
                First Usable Host
              </div>
              <div className="text-sm font-extrabold text-foreground font-mono mt-1">
                {result.firstUsableHost}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-subtle border border-border">
              <div className="text-[11px] font-bold text-muted-foreground uppercase">
                Last Usable Host
              </div>
              <div className="text-sm font-extrabold text-foreground font-mono mt-1">
                {result.lastUsableHost}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-subtle border border-border">
              <div className="text-[11px] font-bold text-muted-foreground uppercase">
                Address Scope &amp; Subnets
              </div>
              <div className="text-xs font-extrabold text-foreground mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{result.addressScope}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {result.subnetCount.toLocaleString()}× /{result.splitPrefix} subnet(s) in block
              </div>
            </div>
          </div>

          {/* Child Subnet Block Split Table */}
          <div className="rounded-2xl bg-surface-subtle border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-foreground">
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span>
                  IPv4 Block Split Breakdown ({result.cidrNotation} →{" "}
                  {result.subnetCount.toLocaleString()} × /{result.splitPrefix})
                </span>
              </div>
              {result.subnetCount > result.childSubnets.length && (
                <span className="text-[11px] text-muted-foreground">
                  Showing first {result.childSubnets.length} of{" "}
                  {result.subnetCount.toLocaleString()} subnets
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border text-[11px] font-bold text-muted-foreground uppercase bg-surface/50">
                    <th className="py-2.5 px-4">Subnet Block</th>
                    <th className="py-2.5 px-4">First Usable Host</th>
                    <th className="py-2.5 px-4">Last Usable Host</th>
                    <th className="py-2.5 px-4">Broadcast</th>
                    <th className="py-2.5 px-4 text-right">Usable Hosts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {result.childSubnets.map((sub, i) => (
                    <tr
                      key={i}
                      className="hover:bg-surface/60 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-bold text-primary">
                        {sub.network}/{sub.cidr}
                      </td>
                      <td className="py-2.5 px-4 text-foreground">
                        {sub.firstHost}
                      </td>
                      <td className="py-2.5 px-4 text-foreground">
                        {sub.lastHost}
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground">
                        {sub.broadcast}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-foreground">
                        {sub.usableHosts.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
