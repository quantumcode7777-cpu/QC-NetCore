"use client";

import React, { useEffect, useRef, useState, useId } from "react";

export interface SpeedometerGaugeProps {
  /**
   * Target dial position on the 0..240 speedometer scale.
   * Automatically clamped to [0, 240] so the needle never exceeds the dial.
   */
  dialValue: number;
  /**
   * Optional subtle oscillation when a tool is actively probing/loading.
   */
  activePulse?: boolean;
  /**
   * Primary formatted readout displayed below the gauge hub (e.g. "85.4 Mbps", "192.168.10.0/24").
   */
  primaryLabel: string;
  /**
   * Secondary caption/status displayed under the primary readout.
   */
  secondaryLabel: string;
  /**
   * Optional badge text (e.g. "DOWNLOAD", "UPLOAD", "RECOMMENDED UPSTREAM", "ONLINE").
   */
  modeBadge?: string;
}

const DIAL_LABELS = [
  0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240,
];

export function SpeedometerGauge({
  dialValue,
  activePulse = false,
  primaryLabel,
  secondaryLabel,
  modeBadge,
}: SpeedometerGaugeProps) {
  const uid = useId().replace(/:/g, "");
  const clampedTarget = Math.max(0, Math.min(240, Number.isFinite(dialValue) ? dialValue : 0));

  const [displayDial, setDisplayDial] = useState<number>(clampedTarget);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  const currentValRef = useRef<number>(clampedTarget);
  const velocityRef = useRef<number>(0);
  const targetValRef = useRef<number>(clampedTarget);
  const pulseRef = useRef<boolean>(activePulse);

  targetValRef.current = clampedTarget;
  pulseRef.current = activePulse;

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      currentValRef.current = clampedTarget;
      velocityRef.current = 0;
      setDisplayDial(clampedTarget);
      return;
    }

    let rafId: number;
    let lastTime = performance.now();

    const animate = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      // Subtle living micro-oscillation only while actively probing
      const microOffset = pulseRef.current
        ? Math.sin(now / 180) * 2.2 + Math.cos(now / 310) * 1.3
        : 0;

      const effectiveTarget = Math.max(
        0,
        Math.min(240, targetValRef.current + microOffset)
      );

      // Critically-damped spring physics for natural acceleration & settling
      const stiffness = 42;
      const damping = 11.5;
      const displacement = effectiveTarget - currentValRef.current;
      const springForce = displacement * stiffness;
      const dampingForce = -velocityRef.current * damping;
      const acceleration = springForce + dampingForce;

      velocityRef.current += acceleration * dt;
      currentValRef.current += velocityRef.current * dt;

      // Clamp physical stops at [0, 240]
      if (currentValRef.current < 0) {
        currentValRef.current = 0;
        velocityRef.current = 0;
      } else if (currentValRef.current > 240) {
        currentValRef.current = 240;
        velocityRef.current = 0;
      }

      setDisplayDial(currentValRef.current);

      const isSettled =
        !pulseRef.current &&
        Math.abs(effectiveTarget - currentValRef.current) < 0.08 &&
        Math.abs(velocityRef.current) < 0.08;

      if (isSettled) {
        currentValRef.current = effectiveTarget;
        velocityRef.current = 0;
        setDisplayDial(effectiveTarget);
      } else {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [clampedTarget, activePulse, reducedMotion]);

  // Convert 0..240 dial value to degrees:
  // 0 -> -120 deg (bottom-left), 120 -> 0 deg (top vertical), 240 -> +120 deg (bottom-right)
  const needleAngleDeg = displayDial - 120;

  const cx = 180;
  const cy = 182;
  const innerCircleR = 112;
  const labelRadius = 95;

  // Build exact tick marks matching the uploaded speedometer reference:
  // Major ticks every 20 units (-120° to +120°): r=112 to r=148, thick
  // Medium ticks at +10 unit midpoints (and +130° tail): r=131 to r=148
  // Minor ticks at +5 / +15 unit quarter-points (and +125° tail): r=140 to r=148
  const ticks: Array<{
    angle: number;
    r1: number;
    r2: number;
    strokeWidth: number;
  }> = [];

  for (let deg = -120; deg <= 130; deg += 5) {
    const offsetFromZero = deg + 120;
    if (offsetFromZero % 20 === 0 && deg <= 120) {
      // Major tick touching the inner dial ring
      ticks.push({ angle: deg, r1: innerCircleR, r2: 148, strokeWidth: 2.6 });
    } else if (offsetFromZero % 10 === 0) {
      // Medium half-step tick
      ticks.push({ angle: deg, r1: 131, r2: 148, strokeWidth: 1.8 });
    } else {
      // Short quarter-step minor tick
      ticks.push({ angle: deg, r1: 140, r2: 148, strokeWidth: 1.25 });
    }
  }

  return (
    <div className="flex flex-col items-center justify-center select-none">
      {/* Gauge Dial Container */}
      <div className="relative w-60 h-60 sm:w-72 sm:h-72 flex items-center justify-center">
        <svg
          viewBox="0 0 360 350"
          className="w-full h-full overflow-visible"
          role="img"
          aria-label={`Speedometer gauge reading ${primaryLabel}`}
        >
          <defs>
            {/* Subtle porcelain/instrument dial face so dark ticks & numbers match reference in both light and dark themes */}
            <radialGradient id={`dial-face-${uid}`} cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="82%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#f1f5f9" />
            </radialGradient>

            {/* 3D Red Needle Left/Right Bevel Gradients (faithful to reference) */}
            <linearGradient
              id={`needle-bright-${uid}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#ff2a36" />
              <stop offset="100%" stopColor="#d90416" />
            </linearGradient>

            <linearGradient
              id={`needle-Lists-${uid}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#c8101e" />
              <stop offset="100%" stopColor="#9b0813" />
            </linearGradient>

            {/* Central Red Hub 3D Spherical Gradient */}
            <radialGradient id={`hub-red-${uid}`} cx="38%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#ff3b47" />
              <stop offset="55%" stopColor="#e10617" />
              <stop offset="100%" stopColor="#9e0510" />
            </radialGradient>

            {/* Soft drop shadow for the needle and hub */}
            <filter
              id={`needle-shadow-${uid}`}
              x="-25%"
              y="-25%"
              width="150%"
              height="150%"
            >
              <feDropShadow
                dx="0"
                dy="2"
                stdDeviation="2.2"
                floodColor="#0f172a"
                floodOpacity="0.22"
              />
            </filter>
          </defs>

          {/* Clean Circular Instrument Backing Disc */}
          <circle
            cx={cx}
            cy={cy}
            r="160"
            fill={`url(#dial-face-${uid})`}
            stroke="#e2e8f0"
            strokeWidth="1.5"
          />

          {/* ==========================================================
              STATIONARY GAUGE DIAL: RINGS, TICKS & NUMERICAL MARKINGS
              ========================================================== */}
          <g>
            {/* Main Inner Circle connecting the bases of the major ticks */}
            <circle
              cx={cx}
              cy={cy}
              r={innerCircleR}
              fill="none"
              stroke="#334155"
              strokeWidth="1.15"
            />

            {/* Dual Concentric Inner Rings around Central Hub (from reference) */}
            <circle
              cx={cx}
              cy={cy}
              r="45"
              fill="none"
              stroke="#334155"
              strokeWidth="1.05"
            />
            <circle
              cx={cx}
              cy={cy}
              r="41.5"
              fill="none"
              stroke="#475569"
              strokeWidth="0.95"
            />

            {/* Radial Tick Marks (Major, Medium, Minor) */}
            {ticks.map((t, idx) => {
              const rad = ((t.angle - 90) * Math.PI) / 180;
              const cos = Math.cos(rad);
              const sin = Math.sin(rad);
              const x1 = cx + t.r1 * cos;
              const y1 = cy + t.r1 * sin;
              const x2 = cx + t.r2 * cos;
              const y2 = cy + t.r2 * sin;

              return (
                <line
                  key={idx}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#262626"
                  strokeWidth={t.strokeWidth}
                  strokeLinecap="butt"
                />
              );
            })}

            {/* Numerical Markings (0, 20, 40, ..., 240) rotated tangentially along the arc */}
            {DIAL_LABELS.map((num) => {
              const deg = num - 120; // -120° for 0, 0° for 120, +120° for 240
              const rad = ((deg - 90) * Math.PI) / 180;
              const tx = cx + labelRadius * Math.cos(rad);
              const ty = cy + labelRadius * Math.sin(rad);

              return (
                <text
                  key={num}
                  x={tx}
                  y={ty}
                  fill="#262626"
                  fontSize="13.5"
                  fontWeight="500"
                  fontFamily="Inter, system-ui, -apple-system, sans-serif"
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${deg}, ${tx}, ${ty})`}
                >
                  {num}
                </text>
              );
            })}
          </g>

          {/* ==========================================================
              ANIMATED RED NEEDLE & CENTRAL HUB (Pivots around cx, cy)
              ========================================================== */}
          <g
            transform={`rotate(${needleAngleDeg}, ${cx}, ${cy})`}
            filter={`url(#needle-shadow-${uid})`}
          >
            {/* Short rounded counterweight tail extending below center hub */}
            <path
              d={`M ${cx - 4.8} ${cy} L ${cx - 4.2} ${cy + 20} A 4.2 4.2 0 0 0 ${
                cx + 4.2
              } ${cy + 20} L ${cx + 4.8} ${cy} Z`}
              fill={`url(#needle-Lists-${uid})`}
            />

            {/* Tapered Red Needle Blade (Left bright half + Right shaded half for 3D bevel) */}
            <polygon
              points={`${cx - 4.5},${cy} ${cx - 0.9},${cy - 147} ${cx},${
                cy - 148.5
              } ${cx},${cy}`}
              fill={`url(#needle-bright-${uid})`}
            />
            <polygon
              points={`${cx + 4.5},${cy} ${cx + 0.9},${cy - 147} ${cx},${
                cy - 148.5
              } ${cx},${cy}`}
              fill={`url(#needle-Lists-${uid})`}
            />

            {/* Rounded tip cap at the needle apex */}
            <circle
              cx={cx}
              cy={cy - 147.2}
              r="1.15"
              fill="#e10617"
            />

            {/* Central Red Hub (faithful to uploaded reference) */}
            <circle
              cx={cx}
              cy={cy}
              r="13.8"
              fill={`url(#hub-red-${uid})`}
              stroke="#b80d18"
              strokeWidth="0.8"
            />
          </g>
        </svg>
      </div>

      {/* Live Numeric Readout & Status Below Speedometer */}
      <div className="text-center space-y-1 -mt-1">
        {modeBadge && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-extrabold uppercase tracking-wider text-primary">
            {activePulse && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
            )}
            <span>{modeBadge}</span>
          </div>
        )}
        <div className="text-xl sm:text-2xl font-extrabold text-foreground font-mono tracking-tight">
          {primaryLabel}
        </div>
        <div className="text-xs text-muted-foreground font-semibold">
          {secondaryLabel}
        </div>
      </div>
    </div>
  );
}
