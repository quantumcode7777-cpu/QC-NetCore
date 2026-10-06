"use client";

import React, { useState, useMemo } from "react";
import {
  Gauge,
  RotateCcw,
  Users,
  Zap,
  TrendingUp,
  Server,
  AlertCircle,
  Info,
} from "lucide-react";
import { calculateIspBandwidth } from "@/lib/network/free-tools";
import { SpeedometerGauge } from "./SpeedometerGauge";

const DEFAULT_VALUES = {
  totalSubscribers: "500",
  concurrencyPercent: "35",
  planSpeedMbps: "10",
  contentionRatio: "8",
  headroomPercent: "25",
};

export function BandwidthCalculatorTool() {
  const [totalSubscribers, setTotalSubscribers] = useState(
    DEFAULT_VALUES.totalSubscribers
  );
  const [concurrencyPercent, setConcurrencyPercent] = useState(
    DEFAULT_VALUES.concurrencyPercent
  );
  const [planSpeedMbps, setPlanSpeedMbps] = useState(
    DEFAULT_VALUES.planSpeedMbps
  );
  const [contentionRatio, setContentionRatio] = useState(
    DEFAULT_VALUES.contentionRatio
  );
  const [headroomPercent, setHeadroomPercent] = useState(
    DEFAULT_VALUES.headroomPercent
  );

  const result = useMemo(() => {
    return calculateIspBandwidth({
      totalSubscribers: Number(totalSubscribers),
      concurrencyPercent: Number(concurrencyPercent),
      planSpeedMbps: Number(planSpeedMbps),
      contentionRatio: Number(contentionRatio),
      headroomPercent: Number(headroomPercent),
    });
  }, [
    totalSubscribers,
    concurrencyPercent,
    planSpeedMbps,
    contentionRatio,
    headroomPercent,
  ]);

  const handleReset = () => {
    setTotalSubscribers(DEFAULT_VALUES.totalSubscribers);
    setConcurrencyPercent(DEFAULT_VALUES.concurrencyPercent);
    setPlanSpeedMbps(DEFAULT_VALUES.planSpeedMbps);
    setContentionRatio(DEFAULT_VALUES.contentionRatio);
    setHeadroomPercent(DEFAULT_VALUES.headroomPercent);
  };

  const applyPreset = (
    subs: string,
    conc: string,
    speed: string,
    contention: string,
    headroom: string
  ) => {
    setTotalSubscribers(subs);
    setConcurrencyPercent(conc);
    setPlanSpeedMbps(speed);
    setContentionRatio(contention);
    setHeadroomPercent(headroom);
  };

  // Map calculated recommended upstream onto the 0..240 speedometer dial
  let gaugeDialValue = 0;
  let gaugePrimaryLabel = "Invalid Input";
  let gaugeSecondaryLabel = "Adjust capacity parameters above";
  let gaugeBadge = "CAPACITY ESTIMATE";

  if (result.valid) {
    const rec = result.recommendedUpstreamMbps;
    // Map 0..240 Mbps directly; above 240 Mbps use a smooth logarithmic/scaled curve up to 240 so needle responds across all ISP tiers without exceeding maximum
    gaugeDialValue =
      rec <= 180
        ? rec
        : Math.min(240, 180 + Math.log10(Math.max(1, rec / 180)) * 42);
    gaugePrimaryLabel = `${rec.toLocaleString()} Mbps`;
    gaugeSecondaryLabel = `${result.recommendedUpstreamGbps} Gbps • ${result.suggestedPortTier}`;
    gaugeBadge = "RECOMMENDED UPSTREAM";
  }

  return (
    <div className="space-y-6">
      {/* Header & Presets */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-primary" />
            <h3 className="text-base font-extrabold text-foreground">
              Upstream Bandwidth &amp; Capacity Calculator
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Estimate required upstream transit capacity based on subscriber count, concurrency, package tiers, and contention ratio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyPreset("250", "40", "6", "10", "25")}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-surface-subtle border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Hotspot (250)
          </button>
          <button
            type="button"
            onClick={() => applyPreset("500", "35", "10", "8", "25")}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-surface-subtle border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            FTTH (500)
          </button>
          <button
            type="button"
            onClick={() => applyPreset("2500", "40", "20", "10", "30")}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-surface-subtle border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Metro ISP (2,500)
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

      {/* Editable Inputs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="space-y-1.5">
          <label
            htmlFor="bw-total-subs"
            className="block text-[11px] font-bold text-muted-foreground uppercase"
          >
            Total Subscribers
          </label>
          <input
            id="bw-total-subs"
            type="number"
            min={1}
            max={1000000}
            value={totalSubscribers}
            onChange={(e) => setTotalSubscribers(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-border text-sm font-bold text-foreground focus:outline-none focus:border-primary transition-colors font-mono"
          />
          <span className="block text-[10px] text-muted-foreground">
            Provisioned accounts
          </span>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="bw-concurrency"
            className="block text-[11px] font-bold text-muted-foreground uppercase"
          >
            Peak Concurrency (%)
          </label>
          <input
            id="bw-concurrency"
            type="number"
            min={1}
            max={100}
            value={concurrencyPercent}
            onChange={(e) => setConcurrencyPercent(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-border text-sm font-bold text-foreground focus:outline-none focus:border-primary transition-colors font-mono"
          />
          <span className="block text-[10px] text-muted-foreground">
            Simultaneously active (%)
          </span>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="bw-plan-speed"
            className="block text-[11px] font-bold text-muted-foreground uppercase"
          >
            Package Speed (Mbps)
          </label>
          <input
            id="bw-plan-speed"
            type="number"
            min={0.5}
            max={10000}
            step="0.5"
            value={planSpeedMbps}
            onChange={(e) => setPlanSpeedMbps(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-border text-sm font-bold text-foreground focus:outline-none focus:border-primary transition-colors font-mono"
          />
          <span className="block text-[10px] text-muted-foreground">
            Sold tariff per user
          </span>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="bw-contention"
            className="block text-[11px] font-bold text-muted-foreground uppercase"
          >
            Contention Ratio (1:N)
          </label>
          <input
            id="bw-contention"
            type="number"
            min={1}
            max={100}
            value={contentionRatio}
            onChange={(e) => setContentionRatio(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-border text-sm font-bold text-foreground focus:outline-none focus:border-primary transition-colors font-mono"
          />
          <span className="block text-[10px] text-muted-foreground">
            Oversubscription factor
          </span>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="bw-headroom"
            className="block text-[11px] font-bold text-muted-foreground uppercase"
          >
            Safety Headroom (%)
          </label>
          <input
            id="bw-headroom"
            type="number"
            min={0}
            max={200}
            value={headroomPercent}
            onChange={(e) => setHeadroomPercent(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-border text-sm font-bold text-foreground focus:outline-none focus:border-primary transition-colors font-mono"
          />
          <span className="block text-[10px] text-muted-foreground">
            Growth &amp; burst buffer
          </span>
        </div>
      </div>

      {/* Central Speedometer Visualization + Capacity Readout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 rounded-2xl bg-surface-subtle border border-border">
          <SpeedometerGauge
            dialValue={gaugeDialValue}
            activePulse={false}
            primaryLabel={gaugePrimaryLabel}
            secondaryLabel={gaugeSecondaryLabel}
            modeBadge={gaugeBadge}
          />
        </div>

        <div className="lg:col-span-7 space-y-4">
          {!result.valid ? (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-500 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{result.error}</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl bg-surface-subtle border border-border">
                  <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase">
                    <span>Concurrent Users</span>
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono">
                      {result.activeConcurrentUsers.toLocaleString()}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground">
                      active
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    ~{result.averagePerActiveUserMbps} Mbps avg / active user
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-surface-subtle border border-border">
                  <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase">
                    <span>Estimated Bandwidth</span>
                    <Zap className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono">
                      {result.sustainedDemandMbps.toLocaleString()}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground">
                      Mbps
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Sustained baseline demand
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-surface-subtle border border-border">
                  <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase">
                    <span>Peak Requirement</span>
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono">
                      {result.peakBurstDemandMbps.toLocaleString()}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground">
                      Mbps
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    +{result.headroomMbps.toLocaleString()} Mbps safety headroom
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-primary/10 border border-primary/30">
                  <div className="flex items-center justify-between text-xs font-bold text-primary uppercase">
                    <span>Recommended Upstream</span>
                    <Server className="w-4 h-4 text-primary" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono">
                      {result.recommendedUpstreamMbps.toLocaleString()}
                    </span>
                    <span className="text-xs font-bold text-primary">Mbps</span>
                  </div>
                  <div className="text-[11px] font-semibold text-muted-foreground mt-1">
                    {result.recommendedUpstreamGbps} Gbps •{" "}
                    {result.suggestedPortTier}
                  </div>
                </div>
              </div>

              {/* Engineering Estimate Disclaimer */}
              <div className="p-3.5 rounded-xl bg-surface-subtle border border-border flex items-start gap-2.5 text-[11px] text-muted-foreground">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-foreground">
                    Planning Estimate Notice:
                  </span>{" "}
                  Calculated as{" "}
                  <code className="px-1.5 py-0.5 rounded bg-surface border border-border font-mono text-[10px]">
                    Active Users = Total × Concurrency%
                  </code>
                  ,{" "}
                  <code className="px-1.5 py-0.5 rounded bg-surface border border-border font-mono text-[10px]">
                    Sustained = (Active × Plan Speed) / Contention
                  </code>
                  , plus peak microburst allowance and {headroomPercent}% headroom. Actual ISP transit demand varies with streaming hours, CDN caching, and MikroTik queue burst thresholds.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
