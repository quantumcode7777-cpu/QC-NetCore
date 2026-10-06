"use client";

import React from "react";
import { GTechLogo } from "./GTechLogo";

// Compatibility wrapper: existing pages import `NexaNetLogo` / `NexaNetIcon`.
// Both now render the G-Tech brand so every screen shows one identity.
// New code should import GTechLogo directly.

interface NexaNetLogoProps {
  variant?: "full" | "stacked" | "horizontal" | "compact" | "icon";
  size?: "sm" | "md" | "lg" | "xl" | "custom";
  className?: string;
  height?: number;
}

export function NexaNetIcon({ className }: { className?: string }) {
  return <GTechLogo showText={false} className={className} />;
}

export function NexaNetLogo({ variant = "horizontal", size = "md", className }: NexaNetLogoProps) {
  return <GTechLogo showText={variant !== "icon"} size={size} className={className} />;
}
