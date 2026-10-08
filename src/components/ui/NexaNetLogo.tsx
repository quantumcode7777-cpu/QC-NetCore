"use client";

import React from "react";
import { QCNetCoreLogo } from "./GTechLogo";

// Compatibility wrapper: existing pages import `NexaNetLogo` / `NexaNetIcon`.
// Both now render the QC NetCore brand so every screen shows one identity.
// New code should import QCNetCoreLogo directly.

interface NexaNetLogoProps {
  variant?: "full" | "stacked" | "horizontal" | "compact" | "icon";
  size?: "sm" | "md" | "lg" | "xl" | "custom";
  className?: string;
  height?: number;
}

export function NexaNetIcon({ className }: { className?: string }) {
  return <QCNetCoreLogo showText={false} className={className} />;
}

export function NexaNetLogo({ variant = "horizontal", size = "md", className }: NexaNetLogoProps) {
  return <QCNetCoreLogo showText={variant !== "icon"} size={size} className={className} />;
}
