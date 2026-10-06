"use client";

import React, { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";

export interface AnimatedNetworkGlobeProps {
  /** Which side of the hero this instance frames ("left" or "right") */
  side?: "left" | "right";
  /** Optional scale/size preset */
  size?: "sm" | "md" | "lg";
  /** Optional custom className */
  className?: string;
}

interface DeviceNodeSpec {
  id: string;
  cx: number;
  cy: number;
  r: number;
  tone: "teal" | "slate" | "primary";
  icon:
    | "users"
    | "laptop"
    | "home"
    | "phone"
    | "network"
    | "id-card"
    | "tablet"
    | "settings"
    | "message"
    | "mail"
    | "broadcast"
    | "checklist"
    | "upload"
    | "headset"
    | "wifi"
    | "shield";
  pulseDuration: string;
  pulseDelay: string;
  receiveDelay?: string;
  receiveDuration?: string;
}

interface JunctionDotSpec {
  cx: number;
  cy: number;
  r: number;
  tone: "teal" | "slate";
  delay: string;
}

interface PacketRouteSpec {
  id: string;
  d: string;
  duration: string;
  delay: string;
  direction: "outbound" | "inbound";
  tone: "teal" | "primary";
}

/**
 * Left-side node layout closely inspired by the reference illustration:
 * central globe hub surrounded by concentric circular arcs, radial spokes,
 * small junction dots, and circular device/profile/service icon badges.
 */
const LEFT_NODES: DeviceNodeSpec[] = [
  // Inner ring nodes (r ~ 96-105)
  {
    id: "l-tablet",
    cx: 196,
    cy: 126,
    r: 18,
    tone: "slate",
    icon: "tablet",
    pulseDuration: "3.6s",
    pulseDelay: "0.2s",
    receiveDuration: "2.8s",
    receiveDelay: "0.4s",
  },
  {
    id: "l-idcard",
    cx: 278,
    cy: 136,
    r: 18,
    tone: "slate",
    icon: "id-card",
    pulseDuration: "4.1s",
    pulseDelay: "1.1s",
  },
  {
    id: "l-settings",
    cx: 146,
    cy: 162,
    r: 15,
    tone: "slate",
    icon: "settings",
    pulseDuration: "3.9s",
    pulseDelay: "0.7s",
  },
  {
    id: "l-home",
    cx: 326,
    cy: 196,
    r: 18,
    tone: "teal",
    icon: "home",
    pulseDuration: "3.4s",
    pulseDelay: "0.5s",
    receiveDuration: "3.1s",
    receiveDelay: "1.2s",
  },
  {
    id: "l-mic-wifi",
    cx: 134,
    cy: 222,
    r: 18,
    tone: "teal",
    icon: "wifi",
    pulseDuration: "3.2s",
    pulseDelay: "1.4s",
    receiveDuration: "2.6s",
    receiveDelay: "0.8s",
  },
  {
    id: "l-chat-bottom",
    cx: 232,
    cy: 318,
    r: 19,
    tone: "slate",
    icon: "message",
    pulseDuration: "4.3s",
    pulseDelay: "0.9s",
  },
  // Middle & outer ring nodes (r ~ 135-190)
  {
    id: "l-bird-net",
    cx: 234,
    cy: 94,
    r: 18,
    tone: "teal",
    icon: "Shield" in ({} as never) ? "shield" : "shield",
    pulseDuration: "3.7s",
    pulseDelay: "0.3s",
  },
  {
    id: "l-users",
    cx: 132,
    cy: 102,
    r: 23,
    tone: "teal",
    icon: "users",
    pulseDuration: "3.5s",
    pulseDelay: "0.1s",
    receiveDuration: "2.9s",
    receiveDelay: "1.6s",
  },
  {
    id: "l-upload",
    cx: 234,
    cy: 46,
    r: 12,
    tone: "slate",
    icon: "upload",
    pulseDuration: "4.4s",
    pulseDelay: "1.8s",
  },
  {
    id: "l-laptop",
    cx: 344,
    cy: 148,
    r: 20,
    tone: "slate",
    icon: "laptop",
    pulseDuration: "3.8s",
    pulseDelay: "0.6s",
    receiveDuration: "3.3s",
    receiveDelay: "2.1s",
  },
  {
    id: "l-phone",
    cx: 92,
    cy: 180,
    r: 20,
    tone: "slate",
    icon: "phone",
    pulseDuration: "3.3s",
    pulseDelay: "1.2s",
    receiveDuration: "2.7s",
    receiveDelay: "1.9s",
  },
  {
    id: "l-broadcast",
    cx: 382,
    cy: 184,
    r: 19,
    tone: "slate",
    icon: "broadcast",
    pulseDuration: "4.0s",
    pulseDelay: "1.5s",
  },
  {
    id: "l-network",
    cx: 388,
    cy: 232,
    r: 19,
    tone: "slate",
    icon: "network",
    pulseDuration: "3.5s",
    pulseDelay: "0.4s",
    receiveDuration: "3.0s",
    receiveDelay: "0.9s",
  },
  {
    id: "l-message-teal",
    cx: 334,
    cy: 258,
    r: 18,
    tone: "teal",
    icon: "message",
    pulseDuration: "3.6s",
    pulseDelay: "1.7s",
  },
  {
    id: "l-checklist",
    cx: 296,
    cy: 336,
    r: 19,
    tone: "teal",
    icon: "checklist",
    pulseDuration: "3.9s",
    pulseDelay: "0.8s",
    receiveDuration: "3.4s",
    receiveDelay: "2.4s",
  },
  {
    id: "l-mail",
    cx: 344,
    cy: 344,
    r: 20,
    tone: "slate",
    icon: "mail",
    pulseDuration: "4.2s",
    pulseDelay: "1.3s",
  },
  {
    id: "l-headset",
    cx: 118,
    cy: 352,
    r: 18,
    tone: "teal",
    icon: "headset",
    pulseDuration: "3.7s",
    pulseDelay: "1.0s",
    receiveDuration: "3.2s",
    receiveDelay: "1.5s",
  },
];

const LEFT_JUNCTIONS: JunctionDotSpec[] = [
  { cx: 160, cy: 86, r: 4.2, tone: "teal", delay: "0.2s" },
  { cx: 162, cy: 136, r: 4.2, tone: "teal", delay: "0.8s" },
  { cx: 214, cy: 118, r: 4.2, tone: "teal", delay: "1.3s" },
  { cx: 256, cy: 120, r: 4.2, tone: "teal", delay: "0.5s" },
  { cx: 298, cy: 84, r: 4.5, tone: "slate", delay: "1.6s" },
  { cx: 382, cy: 124, r: 4.2, tone: "teal", delay: "1.1s" },
  { cx: 300, cy: 168, r: 4.2, tone: "teal", delay: "0.4s" },
  { cx: 334, cy: 226, r: 4.2, tone: "teal", delay: "1.9s" },
  { cx: 380, cy: 274, r: 4.5, tone: "slate", delay: "0.7s" },
  { cx: 304, cy: 248, r: 4.2, tone: "teal", delay: "1.4s" },
  { cx: 392, cy: 324, r: 4.2, tone: "teal", delay: "2.1s" },
  { cx: 260, cy: 322, r: 4.2, tone: "teal", delay: "0.9s" },
  { cx: 312, cy: 374, r: 4.2, tone: "teal", delay: "1.5s" },
  { cx: 272, cy: 382, r: 4.5, tone: "slate", delay: "0.3s" },
  { cx: 194, cy: 384, r: 4.5, tone: "slate", delay: "1.8s" },
  { cx: 196, cy: 296, r: 4.2, tone: "teal", delay: "0.6s" },
  { cx: 162, cy: 266, r: 4.2, tone: "teal", delay: "1.2s" },
  { cx: 140, cy: 192, r: 4.2, tone: "teal", delay: "1.7s" },
  { cx: 64, cy: 222, r: 4.5, tone: "slate", delay: "0.9s" },
];

/**
 * Multi-hop data transmission paths between the Globe Hub (232, 214)
 * and connected network nodes / user devices.
 */
const LEFT_PACKET_ROUTES: PacketRouteSpec[] = [
  // 1. Globe -> Top-Left Junction -> Users Community Node
  {
    id: "lp-users",
    d: "M 192 174 L 162 136 L 132 102",
    duration: "2.9s",
    delay: "0.1s",
    direction: "outbound",
    tone: "teal",
  },
  // 2. Globe -> Inner Right -> Home CPE Node -> Broadcast Tower
  {
    id: "lp-home",
    d: "M 284 202 L 326 196 L 382 184",
    duration: "3.1s",
    delay: "0.7s",
    direction: "outbound",
    tone: "teal",
  },
  // 3. Globe -> Top-Right Junction -> Laptop Workstation -> Terminal
  {
    id: "lp-laptop",
    d: "M 276 182 L 300 168 L 344 148 L 382 124",
    duration: "3.3s",
    delay: "1.3s",
    direction: "outbound",
    tone: "primary",
  },
  // 4. Inbound: Phone / Mobile M-Pesa -> Junction -> Globe
  {
    id: "lp-phone-in",
    d: "M 92 180 L 140 192 L 176 204",
    duration: "2.7s",
    delay: "0.9s",
    direction: "inbound",
    tone: "teal",
  },
  // 5. Globe -> Right Ring -> Network Switch Hierarchy
  {
    id: "lp-network",
    d: "M 284 224 L 334 226 L 388 232",
    duration: "3.0s",
    delay: "0.4s",
    direction: "outbound",
    tone: "primary",
  },
  // 6. Globe -> Bottom-Right Ring -> Checklist / Work Order
  {
    id: "lp-checklist",
    d: "M 264 264 L 260 322 L 296 336",
    duration: "3.4s",
    delay: "1.6s",
    direction: "outbound",
    tone: "teal",
  },
  // 7. Globe -> Bottom-Left Spoke -> Headset Support Node
  {
    id: "lp-headset",
    d: "M 190 256 L 162 266 L 118 352",
    duration: "3.2s",
    delay: "0.5s",
    direction: "outbound",
    tone: "teal",
  },
  // 8. Inbound: WiFi Hotspot Node -> Globe Hub
  {
    id: "lp-wifi-in",
    d: "M 64 222 L 134 222 L 174 218",
    duration: "2.6s",
    delay: "1.8s",
    direction: "inbound",
    tone: "primary",
  },
];

/**
 * Renders crisp vector icons centered at (0,0) inside a circular node badge.
 */
function NodeGlyph({ icon }: { icon: DeviceNodeSpec["icon"] }) {
  switch (icon) {
    case "users":
      return (
        <g fill="none" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="-5" cy="-2" r="2.6" fill="#ffffff" stroke="none" />
          <path d="M -9.5 6.5 C -9.5 3.8 -7.5 2.2 -5 2.2 C -2.5 2.2 -0.5 3.8 -0.5 6.5" fill="#ffffff" stroke="none" />
          <circle cx="5" cy="-2" r="2.6" fill="#ffffff" stroke="none" />
          <path d="M 0.5 6.5 C 0.5 3.8 2.5 2.2 5 2.2 C 7.5 2.2 9.5 3.8 9.5 6.5" fill="#ffffff" stroke="none" />
          <circle cx="0" cy="-0.5" r="3" fill="#ffffff" stroke="none" />
          <path d="M -5.2 8.5 C -5.2 5.2 -2.9 3.4 0 3.4 C 2.9 3.4 5.2 5.2 5.2 8.5" fill="#ffffff" stroke="none" />
          <ellipse cx="-2.5" cy="-8.5" rx="3.5" ry="2.3" fill="#ffffff" stroke="none" />
          <ellipse cx="3.5" cy="-7.2" rx="3" ry="2" fill="#ffffff" stroke="none" />
        </g>
      );
    case "laptop":
      return (
        <g fill="none" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="-7" y="-6.5" width="14" height="9.5" rx="1.5" />
          <path d="M -9.5 5.5 L 9.5 5.5 L 7.5 3 L -7.5 3 Z" fill="#ffffff" />
        </g>
      );
    case "home":
      return (
        <g fill="none" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M -8 0.5 L 0 -7 L 8 0.5" />
          <path d="M -5.5 -1 L -5.5 7 L 5.5 7 L 5.5 -1" fill="#ffffff" stroke="none" />
          <rect x="-1.8" y="2.2" width="3.6" height="4.8" fill="currentColor" stroke="none" />
        </g>
      );
    case "phone":
      return (
        <g fill="none" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M -6.5 -4.5 C -6.5 1.5 -1.5 6.5 4.5 6.5 L 6.8 4.2 C 7.3 3.7 7.3 2.9 6.7 2.5 L 3.8 0.8 C 3.2 0.4 2.4 0.5 1.9 1 L 0.7 2.2 C -1.4 1.1 -3.1 -0.6 -4.2 -2.7 L -3 -3.9 C -2.5 -4.4 -2.4 -5.2 -2.8 -5.8 L -4.5 -8.7 C -4.9 -9.3 -5.7 -9.3 -6.2 -8.8 Z"
            fill="#ffffff"
            stroke="none"
          />
          <path d="M 1.5 -5.5 A 4.5 4.5 0 0 1 5.5 -1.5" />
          <path d="M 1.5 -8.5 A 7.5 7.5 0 0 1 8.5 -1.5" />
        </g>
      );
    case "network":
      return (
        <g fill="#ffffff" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="-2.8" y="-7.5" width="5.6" height="4.2" rx="0.8" />
          <rect x="-8.5" y="3" width="5.2" height="4.2" rx="0.8" />
          <rect x="3.3" y="3" width="5.2" height="4.2" rx="0.8" />
          <path d="M 0 -3.3 L 0 0 M -5.9 0 L 5.9 0 M -5.9 0 L -5.9 3 M 5.9 0 L 5.9 3" fill="none" />
        </g>
      );
    case "id-card":
      return (
        <g fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="-8" y="-5.5" width="16" height="11" rx="1.6" />
          <circle cx="-3.8" cy="-0.8" r="1.8" fill="#ffffff" stroke="none" />
          <path d="M -6.4 3.4 C -6.4 1.8 -5.2 1 -3.8 1 C -2.4 1 -1.2 1.8 -1.2 3.4" />
          <line x1="1.2" y1="-2" x2="5.8" y2="-2" />
          <line x1="1.2" y1="1.2" x2="5.8" y2="1.2" />
        </g>
      );
    case "tablet":
      return (
        <g fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="-7.5" y="-6" width="15" height="10" rx="1.5" />
          <path d="M 0 -1 L 0 6.5 M -2.2 3.5 L 0 1.2 L 2.2 3.5" />
        </g>
      );
    case "settings":
      return (
        <g fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="0" cy="0" r="2.6" />
          <path d="M 0 -6.2 L 0 -4.4 M 0 4.4 L 0 6.2 M -6.2 0 L -4.4 0 M 4.4 0 L 6.2 0 M -4.4 -4.4 L -3.1 -3.1 M 3.1 3.1 L 4.4 4.4 M 4.4 -4.4 L 3.1 -3.1 M -3.1 3.1 L -4.4 4.4" />
        </g>
      );
    case "message":
      return (
        <g fill="#ffffff" stroke="none">
          <path d="M -7.5 -5.5 H 7.5 C 8.6 -5.5 9.5 -4.6 9.5 -3.5 V 2.5 C 9.5 3.6 8.6 4.5 7.5 4.5 H -1.5 L -5.5 7.8 V 4.5 H -7.5 C -8.6 4.5 -9.5 3.6 -9.5 2.5 V -3.5 C -9.5 -4.6 -8.6 -5.5 -7.5 -5.5 Z" />
          <line x1="-5" y1="-2" x2="5" y2="-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="-5" y1="1" x2="3" y2="1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );
    case "mail":
      return (
        <g fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="-8" y="-5.5" width="16" height="11" rx="1.5" />
          <path d="M -7.5 -4.8 L 0 1.2 L 7.5 -4.8" />
        </g>
      );
    case "broadcast":
      return (
        <g fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M -6.5 1.5 L -2 -3 L 1.5 0.5 L -3 5 Z" fill="#ffffff" />
          <path d="M 1.5 -4.5 A 5.5 5.5 0 0 1 5.5 -0.5" />
          <path d="M 3 -7.5 A 9 9 0 0 1 8.5 -2" />
        </g>
      );
    case "checklist":
      return (
        <g fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="-6.5" y="-7" width="12" height="14" rx="1.4" />
          <line x1="-3.5" y1="-3" x2="2.5" y2="-3" />
          <line x1="-3.5" y1="0.5" x2="1.5" y2="0.5" />
          <line x1="-3.5" y1="4" x2="0.5" y2="4" />
          <path d="M 2.5 1.5 L 7.5 -3.5" strokeWidth="1.8" />
        </g>
      );
    case "upload":
      return (
        <g fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 0 4 V -3.5 M -3 -0.5 L 0 -3.8 L 3 -0.5" />
          <path d="M -4.5 2.5 V 4.8 H 4.5 V 2.5" />
        </g>
      );
    case "headset":
      return (
        <g fill="none" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M -6.5 1 V -1 A 6.5 6.5 0 0 1 6.5 -1 V 1" />
          <rect x="-7.5" y="0.5" width="3.2" height="5.2" rx="1.2" fill="#ffffff" />
          <rect x="4.3" y="0.5" width="3.2" height="5.2" rx="1.2" fill="#ffffff" />
        </g>
      );
    case "wifi":
      return (
        <g fill="none" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M -7 -1.5 A 9.5 9.5 0 0 1 7 -1.5" />
          <path d="M -4.5 1.8 A 6 6 0 0 1 4.5 1.8" />
          <circle cx="0" cy="5" r="1.5" fill="#ffffff" stroke="none" />
        </g>
      );
    case "shield":
    default:
      return (
        <g fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 0 -6.8 L 6 -4.2 V 0.5 C 6 4.2 3.4 6.5 0 7.6 C -3.4 6.5 -6 4.2 -6 0.5 V -4.2 Z" />
          <path d="M -2.3 0.4 L -0.6 2.1 L 2.8 -1.4" />
        </g>
      );
  }
}

/**
 * Single hemisphere continent vector set (width = 160 units) rendered twice
 * side-by-side (total width = 320 units) inside the circular globe clip mask
 * so translating by -160px produces an infinitely seamless spherical rotation.
 */
function WorldContinentStrip({ offsetX = 0 }: { offsetX?: number }) {
  return (
    <g transform={`translate(${offsetX}, 0)`}>
      {/* North America */}
      <path d="M 14 168 C 22 160, 38 158, 48 165 C 54 170, 52 182, 43 190 C 36 196, 33 204, 38 210 L 31 214 C 24 206, 16 196, 12 184 Z" />
      {/* Greenland */}
      <path d="M 52 152 C 58 149, 66 151, 68 157 C 66 163, 58 164, 52 159 Z" />
      {/* South America */}
      <path d="M 40 216 C 48 216, 58 224, 60 236 C 61 248, 53 264, 45 274 C 41 268, 39 252, 37 236 Z" />
      {/* Europe */}
      <path d="M 78 162 C 86 156, 102 156, 110 164 C 112 172, 104 180, 94 184 C 84 184, 78 176, 78 168 Z" />
      {/* Africa */}
      <path d="M 78 190 C 90 186, 106 192, 114 204 C 118 218, 112 242, 100 258 C 92 256, 86 240, 84 224 C 78 214, 74 202, 78 190 Z" />
      {/* Asia */}
      <path d="M 108 164 C 122 158, 144 162, 154 174 C 158 186, 150 202, 136 208 C 124 208, 116 196, 110 184 Z" />
      {/* Australia / Oceania */}
      <path d="M 134 234 C 142 232, 152 236, 154 246 C 152 254, 142 256, 134 250 Z" />
      {/* Madagascar / Islands */}
      <ellipse cx="116" cy="244" rx="3" ry="6" />
    </g>
  );
}

export function AnimatedNetworkGlobe({
  size = "lg",
  className,
}: AnimatedNetworkGlobeProps) {
  const uid = useId().replace(/:/g, "");
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const nodes = LEFT_NODES;
  const junctions = LEFT_JUNCTIONS;
  const packetRoutes = LEFT_PACKET_ROUTES;

  const globeCx = 232;
  const globeCy = 214;
  const globeR = 64;

  const sizeClass =
    size === "sm"
      ? "w-40 h-40 sm:w-48 sm:h-48"
      : size === "md"
      ? "w-56 h-56 lg:w-72 lg:h-72"
      : "w-64 h-64 lg:w-80 lg:h-80 xl:w-[370px] xl:h-[370px]";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none select-none relative flex items-center justify-center",
        sizeClass,
        className
      )}
    >
      <svg
        viewBox="0 0 440 420"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible"
      >
        <defs>
          {/* Circular clip mask for the rotating globe hub */}
          <clipPath id={`globe-clip-${uid}`}>
            <circle cx={globeCx} cy={globeCy} r={globeR} />
          </clipPath>

          {/* Globe Ocean Gradient (Teal/Cyan harmonized with QC NetCore primary) */}
          <radialGradient id={`globe-ocean-${uid}`} cx="38%" cy="32%" r="70%">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="55%" stopColor="#0d9488" />
            <stop offset="100%" stopColor="#0f766e" />
          </radialGradient>

          {/* Spherical 3D inner lighting overlay */}
          <radialGradient id={`globe-shade-${uid}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="65%" stopColor="#0f172a" stopOpacity="0.0" />
            <stop offset="100%" stopColor="#090d16" stopOpacity="0.32" />
          </radialGradient>

          {/* Soft ambient halo behind globe */}
          <radialGradient id={`globe-halo-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
            <stop offset="55%" stopColor="#0d9488" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
          </radialGradient>

          {/* Ground shadow below the network hub (matches reference illustration) */}
          <radialGradient id={`ground-shadow-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--foreground)" stopOpacity="0.16" />
            <stop offset="65%" stopColor="var(--foreground)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="var(--foreground)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Subtle ground shadow ellipse */}
        <ellipse
          cx={globeCx}
          cy="398"
          rx="118"
          ry="7"
          fill={`url(#ground-shadow-${uid})`}
        />

        {/* Ambient glow behind central globe */}
        <circle
          cx={globeCx}
          cy={globeCy}
          r="116"
          fill={`url(#globe-halo-${uid})`}
        />

        {/* ============================================================
            STATIC CONCENTRIC NETWORK ARCS & SPOKE PATHS
            (Paths stay stable while data packets travel along them)
            ============================================================ */}
        <g
          className="text-muted-foreground/55 dark:text-muted-foreground/45"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        >
          {/* Inner partial orbital arc (r = 96) */}
          <circle
            cx={globeCx}
            cy={globeCy}
            r="96"
            strokeDasharray="195 75 150 85"
            transform="rotate(-28 232 214)"
          />

          {/* Middle primary network ring (r = 132) */}
          <circle
            cx={globeCx}
            cy={globeCy}
            r="132"
            strokeDasharray="340 68 260 65"
            transform="rotate(15 232 214)"
          />

          {/* Outer partial network arc (r = 166) */}
          <circle
            cx={globeCx}
            cy={globeCy}
            r="166"
            strokeDasharray="180 140 160 190"
            transform="rotate(108 232 214)"
          />

          {/* Radial & branched network connection spokes */}
          <line x1="192" y1="174" x2="132" y2="102" />
          <line x1="184" y1="154" x2="160" y2="86" />
          <line x1="214" y1="118" x2="196" y2="66" />
          <line x1="234" y1="94" x2="234" y2="46" />
          <line x1="256" y1="120" x2="298" y2="84" />
          <line x1="276" y1="182" x2="344" y2="148" />
          <line x1="344" y1="148" x2="382" y2="124" />
          <line x1="284" y1="202" x2="382" y2="184" />
          <line x1="284" y1="224" x2="388" y2="232" />
          <line x1="304" y1="248" x2="380" y2="274" />
          <line x1="292" y1="272" x2="392" y2="324" />
          <line x1="280" y1="288" x2="344" y2="344" />
          <line x1="264" y1="264" x2="296" y2="336" />
          <line x1="296" y1="336" x2="312" y2="374" />
          <line x1="260" y1="322" x2="272" y2="382" />
          <line x1="232" y1="318" x2="232" y2="368" />
          <line x1="206" y1="342" x2="194" y2="384" />
          <line x1="190" y1="256" x2="118" y2="352" />
          <line x1="168" y1="244" x2="114" y2="278" />
          <line x1="174" y1="218" x2="64" y2="222" />
          <line x1="176" y1="204" x2="92" y2="180" />
        </g>

        {/* ============================================================
            ANIMATED DATA TRANSMISSION STREAMS & PACKETS
            ============================================================ */}
        {packetRoutes.map((route) => {
          const strokeColor =
            route.tone === "teal" ? "#14b8a6" : "var(--primary)";
          return (
            <g key={route.id}>
              {/* Subtle illuminated path pulse */}
              <path
                d={route.d}
                stroke={strokeColor}
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeDasharray="10 120"
                className="qc-net-stream-left"
                style={{
                  animationDuration: route.duration,
                  animationDelay: route.delay,
                }}
              />

              {/* Moving data packet with glowing halo */}
              {!reducedMotion && (
                <g>
                  <circle
                    r="5.5"
                    fill={strokeColor}
                    opacity="0.28"
                  >
                    <animateMotion
                      dur={route.duration}
                      begin={route.delay}
                      repeatCount="indefinite"
                      path={route.d}
                    />
                  </circle>
                  <circle
                    r="2.7"
                    fill={strokeColor}
                    stroke="#ffffff"
                    strokeWidth="0.9"
                  >
                    <animateMotion
                      dur={route.duration}
                      begin={route.delay}
                      repeatCount="indefinite"
                      path={route.d}
                    />
                  </circle>
                </g>
              )}
            </g>
          );
        })}

        {/* ============================================================
            JUNCTION / TERMINAL DOTS (Subtle independent pulsing)
            ============================================================ */}
        {junctions.map((j, idx) => (
          <circle
            key={idx}
            cx={j.cx}
            cy={j.cy}
            r={j.r}
            fill={j.tone === "teal" ? "#0d9488" : "var(--muted-foreground)"}
            className="qc-net-junction-pulse"
            style={{
              animationDelay: j.delay,
              transformOrigin: `${j.cx}px ${j.cy}px`,
            }}
          />
        ))}

        {/* ============================================================
            CENTRAL ROTATING GLOBE HUB
            ============================================================ */}
        <g>
          {/* Outer subtle telemetry ring around globe */}
          <circle
            cx={globeCx}
            cy={globeCy}
            r={globeR + 5}
            stroke="#0d9488"
            strokeOpacity="0.28"
            strokeWidth="1.2"
            strokeDasharray="6 6"
            className="qc-net-orbit-slow-left"
            style={{ transformOrigin: `${globeCx}px ${globeCy}px` }}
          />

          {/* Ocean Sphere Base */}
          <circle
            cx={globeCx}
            cy={globeCy}
            r={globeR}
            fill={`url(#globe-ocean-${uid})`}
          />

          {/* Clipped Rotating Continents & Graticule */}
          <g clipPath={`url(#globe-clip-${uid})`}>
            {/* Subtle latitude/longitude grid */}
            <g stroke="#ffffff" strokeOpacity="0.16" strokeWidth="0.8">
              <ellipse cx={globeCx} cy={globeCy} rx="32" ry={globeR} />
              <ellipse cx={globeCx} cy={globeCy} rx="52" ry={globeR} />
              <line
                x1={globeCx - globeR}
                y1={globeCy}
                x2={globeCx + globeR}
                y2={globeCy}
              />
              <line
                x1={globeCx - globeR}
                y1={globeCy - 26}
                x2={globeCx + globeR}
                y2={globeCy - 26}
              />
              <line
                x1={globeCx - globeR}
                y1={globeCy + 26}
                x2={globeCx + globeR}
                y2={globeCy + 26}
              />
            </g>

            {/* Seamlessly translating dual-hemisphere continent map */}
            <g
              fill="#e2e8f0"
              fillOpacity="0.92"
              className="qc-net-globe-pan-left"
            >
              <g transform={`translate(${globeCx - 80}, 0)`}>
                <WorldContinentStrip offsetX={0} />
                <WorldContinentStrip offsetX={160} />
              </g>
            </g>

            {/* Spherical 3D shading overlay */}
            <circle
              cx={globeCx}
              cy={globeCy}
              r={globeR}
              fill={`url(#globe-shade-${uid})`}
            />
          </g>

          {/* Crisp Globe Rim */}
          <circle
            cx={globeCx}
            cy={globeCy}
            r={globeR}
            stroke="#0d9488"
            strokeOpacity="0.55"
            strokeWidth="1.5"
          />
        </g>

        {/* ============================================================
            CONNECTED DEVICE / USER / NETWORK SERVICE NODES
            ============================================================ */}
        {nodes.map((node) => {
          const badgeFill =
            node.tone === "teal"
              ? "#0d9488"
              : node.tone === "primary"
              ? "var(--primary)"
              : "#4b5563";

          const ringStroke =
            node.tone === "teal"
              ? "#14b8a6"
              : node.tone === "primary"
              ? "var(--primary)"
              : "#94a3b8";

          return (
            <g
              key={node.id}
              className="qc-net-node-pulse"
              style={{
                transformOrigin: `${node.cx}px ${node.cy}px`,
                animationDuration: node.pulseDuration,
                animationDelay: node.pulseDelay,
              }}
            >
              {/* Data-received highlight halo when packet arrives */}
              {node.receiveDuration && (
                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={node.r + 5}
                  fill="none"
                  stroke={ringStroke}
                  strokeWidth="1.8"
                  opacity="0"
                  className="qc-net-node-receive"
                  style={{
                    transformOrigin: `${node.cx}px ${node.cy}px`,
                    animationDuration: node.receiveDuration,
                    animationDelay: node.receiveDelay || "0s",
                  }}
                />
              )}

              {/* Node circular badge */}
              <circle
                cx={node.cx}
                cy={node.cy}
                r={node.r}
                fill={badgeFill}
                stroke="#ffffff"
                strokeOpacity="0.22"
                strokeWidth="1.2"
              />

              {/* Centered vector glyph */}
              <g
                transform={`translate(${node.cx}, ${node.cy}) scale(${
                  node.r / 19
                })`}
                style={{ color: badgeFill }}
              >
                <NodeGlyph icon={node.icon} />
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
