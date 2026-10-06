"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Play,
  RotateCcw,
  Timer,
  Waves,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { SpeedometerGauge } from "./SpeedometerGauge";

type TestPhase =
  | "IDLE"
  | "PING"
  | "DOWNLOAD"
  | "UPLOAD"
  | "COMPLETE"
  | "ERROR";

interface SpeedTestMetrics {
  pingMs: number | null;
  jitterMs: number | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
  uploadNote?: string | null;
}

export function SpeedTestTool() {
  const [phase, setPhase] = useState<TestPhase>("IDLE");
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>(
    "Ready to measure real-time connection performance"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<SpeedTestMetrics>({
    pingMs: null,
    jitterMs: null,
    downloadMbps: null,
    uploadMbps: null,
    uploadNote: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const runSpeedTest = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setErrorMsg(null);
    setMetrics({
      pingMs: null,
      jitterMs: null,
      downloadMbps: null,
      uploadMbps: null,
      uploadNote: null,
    });

    try {
      // ====================================================================
      // PHASE 1: PING & JITTER (6 real round-trip HTTP probes)
      // ====================================================================
      setPhase("PING");
      setStatusText("Measuring round-trip latency (ping) and packet jitter...");
      setProgress(5);

      const rtts: number[] = [];
      const pingSamples = 6;

      // Warm-up connection first so TLS/connection setup doesn't skew ping
      await fetch(`/api/v1/tools/speedtest?mode=ping&warmup=1&t=${Date.now()}`, {
        cache: "no-store",
        signal: controller.signal,
      });

      for (let i = 0; i < pingSamples; i++) {
        const t0 = performance.now();
        const res = await fetch(
          `/api/v1/tools/speedtest?mode=ping&seq=${i}&t=${Date.now()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );
        if (!res.ok) {
          throw new Error("Latency probe request failed.");
        }
        await res.json();
        const rtt = performance.now() - t0;
        rtts.push(rtt);

        const currentPing = Math.round(Math.min(...rtts));
        let currentJitter = 0;
        if (rtts.length >= 2) {
          let diffs = 0;
          for (let j = 1; j < rtts.length; j++) {
            diffs += Math.abs(rtts[j] - rtts[j - 1]);
          }
          currentJitter = Number((diffs / (rtts.length - 1)).toFixed(1));
        }

        setMetrics((prev) => ({
          ...prev,
          pingMs: currentPing,
          jitterMs: currentJitter,
        }));
        setProgress(5 + Math.round(((i + 1) / pingSamples) * 20));
      }

      // ====================================================================
      // PHASE 2: DOWNLOAD PERFORMANCE (Real binary payload transfers)
      // ====================================================================
      setPhase("DOWNLOAD");
      setStatusText("Measuring download throughput...");

      const downloadSizes = [262_144, 524_288, 1_048_576, 1_572_864]; // 256KB, 512KB, 1MB, 1.5MB
      let totalDownloadBytes = 0;
      let totalDownloadSeconds = 0;

      for (let i = 0; i < downloadSizes.length; i++) {
        const size = downloadSizes[i];
        const t0 = performance.now();
        const res = await fetch(
          `/api/v1/tools/speedtest?mode=download&bytes=${size}&seq=${i}&t=${Date.now()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );
        if (!res.ok) {
          throw new Error("Download test stream interrupted.");
        }
        const buf = await res.arrayBuffer();
        const elapsedSec = Math.max(0.001, (performance.now() - t0) / 1000);

        totalDownloadBytes += buf.byteLength;
        totalDownloadSeconds += elapsedSec;

        const liveMbps = Number(
          ((totalDownloadBytes * 8) / (totalDownloadSeconds * 1_000_000)).toFixed(2)
        );

        setMetrics((prev) => ({
          ...prev,
          downloadMbps: liveMbps,
        }));
        setProgress(25 + Math.round(((i + 1) / downloadSizes.length) * 40));
      }

      // ====================================================================
      // PHASE 3: UPLOAD PERFORMANCE (Real binary payload POSTs)
      // ====================================================================
      setPhase("UPLOAD");
      setStatusText("Measuring upload throughput...");

      const uploadSizes = [131_072, 262_144, 524_288]; // 128KB, 256KB, 512KB
      let totalUploadBytes = 0;
      let totalUploadSeconds = 0;
      let uploadRestricted = false;

      for (let i = 0; i < uploadSizes.length; i++) {
        const size = uploadSizes[i];
        const payload = new Uint8Array(size);
        for (let k = 0; k < size; k += 64) {
          payload[k] = (k + i) & 0xff;
        }

        const t0 = performance.now();
        try {
          const res = await fetch(
            `/api/v1/tools/speedtest?mode=upload&seq=${i}&t=${Date.now()}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/octet-stream" },
              body: payload,
              cache: "no-store",
              signal: controller.signal,
            }
          );

          if (!res.ok) {
            uploadRestricted = true;
            break;
          }
          await res.json();
          const elapsedSec = Math.max(0.001, (performance.now() - t0) / 1000);

          totalUploadBytes += size;
          totalUploadSeconds += elapsedSec;

          const liveUpMbps = Number(
            ((totalUploadBytes * 8) / (totalUploadSeconds * 1_000_000)).toFixed(2)
          );

          setMetrics((prev) => ({
            ...prev,
            uploadMbps: liveUpMbps,
          }));
        } catch (err) {
          if ((err as Error)?.name === "AbortError") throw err;
          uploadRestricted = true;
          break;
        }

        setProgress(65 + Math.round(((i + 1) / uploadSizes.length) * 35));
      }

      if (uploadRestricted && totalUploadBytes === 0) {
        setMetrics((prev) => ({
          ...prev,
          uploadNote:
            "Upload probe restricted by browser or proxy policy on this network.",
        }));
      }

      setProgress(100);
      setPhase("COMPLETE");
      setStatusText("Speed test completed — real-time HTTP transport measurements");
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        setPhase("IDLE");
        setProgress(0);
        setStatusText("Speed test cancelled");
        return;
      }
      setPhase("ERROR");
      setErrorMsg(
        "Network measurement could not be completed. Please check your connection and try again."
      );
      setStatusText("Speed test interrupted");
    }
  };

  const isRunning =
    phase === "PING" || phase === "DOWNLOAD" || phase === "UPLOAD";

  // Map active phase & real measurement to the 0..240 speedometer dial
  let gaugeDialValue = 0;
  let gaugePrimaryLabel = "0.0 Mbps";
  let gaugeSecondaryLabel = "Click Start Speed Test to measure connection";
  let gaugeBadge = "READY";

  if (phase === "PING") {
    gaugeDialValue = 16;
    gaugePrimaryLabel =
      metrics.pingMs !== null ? `${metrics.pingMs} ms` : "Probing...";
    gaugeSecondaryLabel = "Measuring round-trip latency & jitter";
    gaugeBadge = "PING & JITTER";
  } else if (phase === "DOWNLOAD") {
    const dl = metrics.downloadMbps ?? 12;
    gaugeDialValue = Math.min(240, dl);
    gaugePrimaryLabel =
      metrics.downloadMbps !== null ? `${metrics.downloadMbps} Mbps` : "Sampling...";
    gaugeSecondaryLabel = "Live downstream throughput";
    gaugeBadge = "DOWNLOAD TEST";
  } else if (phase === "UPLOAD") {
    const ul = metrics.uploadMbps ?? 10;
    gaugeDialValue = Math.min(240, ul);
    gaugePrimaryLabel =
      metrics.uploadMbps !== null ? `${metrics.uploadMbps} Mbps` : "Sampling...";
    gaugeSecondaryLabel = "Live upstream throughput";
    gaugeBadge = "UPLOAD TEST";
  } else if (phase === "COMPLETE") {
    const finalDl = metrics.downloadMbps ?? 0;
    gaugeDialValue = Math.min(240, finalDl);
    gaugePrimaryLabel = `${finalDl} Mbps`;
    gaugeSecondaryLabel =
      metrics.uploadMbps !== null
        ? `Download ${finalDl} Mbps • Upload ${metrics.uploadMbps} Mbps`
        : "Measured downstream throughput";
    gaugeBadge = "COMPLETED";
  } else if (phase === "ERROR") {
    gaugeDialValue = 0;
    gaugePrimaryLabel = "Test Interrupted";
    gaugeSecondaryLabel = "Retry when connection is ready";
    gaugeBadge = "ERROR";
  }

  return (
    <div className="space-y-6">
      {/* Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="text-base font-extrabold text-foreground">
              Network Speed &amp; Latency Test
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Measures actual HTTP payload throughput, round-trip latency, and packet delay variation (jitter) from your browser.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={runSpeedTest}
            disabled={isRunning}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-primary-foreground bg-primary hover:bg-primary-hover disabled:opacity-60 transition-all shadow-xs cursor-pointer"
          >
            {phase === "COMPLETE" || phase === "ERROR" ? (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Run Test Again</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>{isRunning ? "Running Test..." : "Start Speed Test"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Central Speedometer Visualization + Telemetry Readout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left/Center: Live Speedometer Instrument */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 rounded-2xl bg-surface-subtle border border-border">
          <SpeedometerGauge
            dialValue={gaugeDialValue}
            activePulse={isRunning}
            primaryLabel={gaugePrimaryLabel}
            secondaryLabel={gaugeSecondaryLabel}
            modeBadge={gaugeBadge}
          />
        </div>

        {/* Right: Progress & 4 Telemetry Cards */}
        <div className="lg:col-span-7 space-y-4">
          {/* Progress & Live Phase Status */}
          <div className="space-y-2" aria-live="polite">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-foreground flex items-center gap-2">
                {isRunning && (
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                )}
                {phase === "COMPLETE" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                )}
                {phase === "ERROR" && (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
                <span>{statusText}</span>
              </span>
              <span className="text-muted-foreground font-mono">{progress}%</span>
            </div>

            <div
              className="w-full h-2 rounded-full bg-surface-subtle border border-border overflow-hidden"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Speed test progress"
            >
              <div
                className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-500 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 4 Telemetry Readout Cards */}
          <div className="grid grid-cols-2 gap-3.5">
            {/* Download */}
            <div
              className={`p-4 rounded-2xl bg-surface-subtle border transition-all ${
                phase === "DOWNLOAD"
                  ? "border-primary ring-1 ring-primary/30"
                  : "border-border"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase">
                <span>Download</span>
                <ArrowDown className="w-4 h-4 text-primary" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono">
                  {metrics.downloadMbps !== null ? metrics.downloadMbps : "—"}
                </span>
                <span className="text-xs font-bold text-muted-foreground">
                  Mbps
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {phase === "DOWNLOAD"
                  ? "Sampling downstream..."
                  : "Downstream capacity"}
              </div>
            </div>

            {/* Upload */}
            <div
              className={`p-4 rounded-2xl bg-surface-subtle border transition-all ${
                phase === "UPLOAD"
                  ? "border-primary ring-1 ring-primary/30"
                  : "border-border"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase">
                <span>Upload</span>
                <ArrowUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono">
                  {metrics.uploadMbps !== null ? metrics.uploadMbps : "—"}
                </span>
                <span className="text-xs font-bold text-muted-foreground">
                  Mbps
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {metrics.uploadNote
                  ? metrics.uploadNote
                  : phase === "UPLOAD"
                  ? "Sampling upstream..."
                  : "Upstream capacity"}
              </div>
            </div>

            {/* Ping */}
            <div
              className={`p-4 rounded-2xl bg-surface-subtle border transition-all ${
                phase === "PING"
                  ? "border-primary ring-1 ring-primary/30"
                  : "border-border"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase">
                <span>Ping</span>
                <Timer className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono">
                  {metrics.pingMs !== null ? metrics.pingMs : "—"}
                </span>
                <span className="text-xs font-bold text-muted-foreground">
                  ms
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Minimum HTTP RTT
              </div>
            </div>

            {/* Jitter */}
            <div
              className={`p-4 rounded-2xl bg-surface-subtle border transition-all ${
                phase === "PING"
                  ? "border-primary ring-1 ring-primary/30"
                  : "border-border"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase">
                <span>Jitter</span>
                <Waves className="w-4 h-4 text-primary" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono">
                  {metrics.jitterMs !== null ? metrics.jitterMs : "—"}
                </span>
                <span className="text-xs font-bold text-muted-foreground">
                  ms
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Latency variance
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transparency Note */}
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Measurements reflect browser-to-edge HTTP transport performance over your current network interface. Local Wi-Fi signal quality, active VPNs, or browser background tabs may influence peak throughput.
      </p>
    </div>
  );
}
