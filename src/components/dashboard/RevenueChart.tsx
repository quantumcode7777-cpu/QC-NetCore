"use client";

import React, { useId, useMemo, useRef, useState } from "react";
import {
  computeNiceTicks,
  type DailyRevenueBucket,
  type RevenuePeriod,
} from "@/lib/revenue";
import { cn, formatKES } from "@/lib/utils";

interface RevenueChartProps {
  buckets: DailyRevenueBucket[];
  period: RevenuePeriod;
  className?: string;
}

const VIEW_W = 680;
const VIEW_H = 220;
const PAD_LEFT = 54;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 30;
const PLOT_W = VIEW_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = VIEW_H - PAD_TOP - PAD_BOTTOM;

function formatAxisNumber(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  return n.toLocaleString("en-KE");
}

/**
 * Build a smooth monotone-like cubic path through (x, y) points so the curve
 * never overshoots below 0 or above the data extrema.
 */
function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;

  const n = pts.length;
  const dx: number[] = [];
  const dy: number[] = [];
  const m: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    dy[i] = pts[i + 1].y - pts[i].y;
    m[i] = dx[i] !== 0 ? dy[i] / dx[i] : 0;
  }

  const tangents: number[] = new Array(n).fill(0);
  tangents[0] = m[0];
  tangents[n - 1] = m[n - 2];

  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      tangents[i] = 0;
    } else {
      tangents[i] = (m[i - 1] + m[i]) / 2;
    }
  }

  // Fritsch-Carlson monotonicity clamp
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const a = tangents[i] / m[i];
      const b = tangents[i + 1] / m[i];
      const h = Math.hypot(a, b);
      if (h > 3) {
        const t = 3 / h;
        tangents[i] = t * a * m[i];
        tangents[i + 1] = t * b * m[i];
      }
    }
  }

  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const seg = dx[i] / 3;
    const cp1x = p0.x + seg;
    const cp1y = p0.y + tangents[i] * seg;
    const cp2x = p1.x - seg;
    const cp2y = p1.y - tangents[i + 1] * seg;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  }
  return d;
}

export function RevenueChart({ buckets, period, className }: RevenueChartProps) {
  const gradientId = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const maxVal = useMemo(
    () => buckets.reduce((max, b) => (b.total > max ? b.total : max), 0),
    [buckets]
  );

  const yTicks = useMemo(() => computeNiceTicks(maxVal, 4), [maxVal]);
  const yCeiling = yTicks[yTicks.length - 1] || 2500;

  const points = useMemo(() => {
    const count = buckets.length;
    return buckets.map((b, i) => {
      const ratioX = count > 1 ? i / (count - 1) : 0.5;
      const x = PAD_LEFT + ratioX * PLOT_W;
      const clamped = Math.max(0, Math.min(b.total, yCeiling));
      const y = PAD_TOP + PLOT_H - (clamped / yCeiling) * PLOT_H;
      return { x, y, bucket: b, index: i };
    });
  }, [buckets, yCeiling]);

  const linePath = useMemo(() => buildSmoothPath(points), [points]);
  const baselineY = PAD_TOP + PLOT_H;
  const areaPath = useMemo(() => {
    if (points.length === 0) return "";
    const first = points[0];
    const last = points[points.length - 1];
    return `${linePath} L ${last.x.toFixed(2)} ${baselineY.toFixed(2)} L ${first.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
  }, [linePath, points, baselineY]);

  const xLabelIndices = useMemo(() => {
    const n = buckets.length;
    if (n <= 7) return buckets.map((_, i) => i);
    const step = Math.ceil(n / 6);
    const indices: number[] = [];
    for (let i = 0; i < n; i += step) indices.push(i);
    if (indices[indices.length - 1] !== n - 1) {
      if (n - 1 - indices[indices.length - 1] < 2) {
        indices[indices.length - 1] = n - 1;
      } else {
        indices.push(n - 1);
      }
    }
    return indices;
  }, [buckets]);

  const activeIdx = hoverIdx ?? selectedIdx;
  const activePoint = activeIdx !== null ? points[activeIdx] ?? null : null;

  const resolveIndexFromClientX = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg || points.length === 0) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const svgX = ((clientX - rect.left) / rect.width) * VIEW_W;
    let closest = 0;
    let minDist = Math.abs(points[0].x - svgX);
    for (let i = 1; i < points.length; i++) {
      const dist = Math.abs(points[i].x - svgX);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }
    return closest;
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const idx = resolveIndexFromClientX(e.clientX);
    if (idx !== null) setHoverIdx(idx);
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const idx = resolveIndexFromClientX(e.clientX);
    if (idx !== null) {
      setSelectedIdx((prev) => (prev === idx ? null : idx));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (points.length === 0) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setSelectedIdx((prev) =>
        prev === null ? points.length - 1 : Math.min(points.length - 1, prev + 1)
      );
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSelectedIdx((prev) =>
        prev === null ? points.length - 1 : Math.max(0, prev - 1)
      );
    } else if (e.key === "Home") {
      e.preventDefault();
      setSelectedIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setSelectedIdx(points.length - 1);
    } else if (e.key === "Escape") {
      setSelectedIdx(null);
      setHoverIdx(null);
    }
  };

  const totalSum = useMemo(
    () => buckets.reduce((acc, b) => acc + b.total, 0),
    [buckets]
  );

  // Position tooltip horizontally without clipping edges
  const tooltipLeftPct = activePoint
    ? ((activePoint.x - PAD_LEFT) / PLOT_W) * 100
    : 50;

  return (
    <div
      className={cn("relative select-none", className)}
      tabIndex={0}
      role="region"
      aria-label={`Interactive collected revenue chart for the last ${period} days. Use Left and Right arrow keys to inspect daily revenue.`}
      onKeyDown={handleKeyDown}
      onBlur={() => setHoverIdx(null)}
    >
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-52 w-full overflow-visible touch-pan-y focus:outline-none"
          role="img"
          aria-label={`Collected revenue over the last ${period} days, total ${formatKES(totalSum)}`}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIdx(null)}
          onPointerDown={handlePointerDown}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal grid lines + Y-axis labels */}
          {yTicks.map((tick) => {
            const y = PAD_TOP + PLOT_H - (tick / yCeiling) * PLOT_H;
            return (
              <g key={tick}>
                <line
                  x1={PAD_LEFT}
                  y1={y}
                  x2={VIEW_W - PAD_RIGHT}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth="1"
                  strokeDasharray={tick === 0 ? undefined : "3 3"}
                />
                <text
                  x={PAD_LEFT - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-muted-foreground text-[11px] tabular"
                >
                  {formatAxisNumber(tick)}
                </text>
              </g>
            );
          })}

          {/* X-axis labels */}
          {xLabelIndices.map((idx) => {
            const pt = points[idx];
            if (!pt) return null;
            return (
              <text
                key={pt.bucket.dateKey}
                x={pt.x}
                y={VIEW_H - 8}
                textAnchor={
                  idx === 0
                    ? "start"
                    : idx === points.length - 1
                    ? "end"
                    : "middle"
                }
                className="fill-muted-foreground text-[11px]"
              >
                {pt.bucket.label}
              </text>
            );
          })}

          {/* Area fill */}
          {areaPath && (
            <path
              d={areaPath}
              fill={`url(#${gradientId})`}
              className="motion-reduce:transition-none"
            />
          )}

          {/* Smooth revenue line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="motion-reduce:transition-none"
            />
          )}

          {/* Data points (subtle markers for 7d or non-zero points) */}
          {points.map((pt) => {
            const isActive = activeIdx === pt.index;
            const isSelected = selectedIdx === pt.index;
            const showDot = period === 7 || pt.bucket.total > 0 || isActive;
            if (!showDot) return null;
            return (
              <circle
                key={pt.bucket.dateKey}
                cx={pt.x}
                cy={pt.y}
                r={isActive || isSelected ? 4.5 : 2.5}
                fill={isActive || isSelected ? "var(--primary)" : "var(--surface)"}
                stroke="var(--primary)"
                strokeWidth={isActive || isSelected ? 2 : 1.75}
              />
            );
          })}

          {/* Active vertical crosshair + focus ring */}
          {activePoint && (
            <g className="pointer-events-none">
              <line
                x1={activePoint.x}
                y1={PAD_TOP}
                x2={activePoint.x}
                y2={baselineY}
                stroke="var(--border-strong)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="7"
                fill="none"
                stroke="var(--primary)"
                strokeOpacity="0.25"
                strokeWidth="3"
              />
            </g>
          )}
        </svg>

        {/* Floating inspection tooltip */}
        {activePoint && (
          <div
            role="status"
            aria-live="polite"
            style={{
              left: `clamp(8px, calc(${tooltipLeftPct.toFixed(1)}% + 24px), calc(100% - 180px))`,
            }}
            className="pointer-events-none absolute top-2 z-10 w-44 rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-[var(--shadow-pop)]"
          >
            <div className="font-semibold text-foreground">
              {activePoint.bucket.fullDate}
            </div>
            <div className="mt-1 flex items-center justify-between text-muted-foreground">
              <span>Collected:</span>
              <span className="tabular font-semibold text-foreground">
                {formatKES(activePoint.bucket.total)}
              </span>
            </div>
            <div className="mt-0.5 flex items-center justify-between text-muted-foreground">
              <span>Payments:</span>
              <span className="tabular font-medium text-foreground">
                {activePoint.bucket.count}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Selected point bar for click/keyboard users */}
      {selectedIdx !== null && points[selectedIdx] && (
        <div className="mt-2 flex items-center justify-between rounded-md border border-border bg-surface-subtle px-3 py-1.5 text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="font-medium text-foreground">
              {points[selectedIdx].bucket.fullDate}
            </span>
            <span className="tabular text-muted-foreground">
              Collected:{" "}
              <strong className="font-semibold text-foreground">
                {formatKES(points[selectedIdx].bucket.total)}
              </strong>
            </span>
            <span className="tabular text-muted-foreground">
              Payments:{" "}
              <strong className="font-semibold text-foreground">
                {points[selectedIdx].bucket.count}
              </strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedIdx(null)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Accessible data table for screen readers */}
      <table className="sr-only">
        <caption>Daily collected revenue over the last {period} days</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Collected revenue</th>
            <th scope="col">Completed payments</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.dateKey}>
              <td>{b.fullDate}</td>
              <td>{formatKES(b.total)}</td>
              <td>{b.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
