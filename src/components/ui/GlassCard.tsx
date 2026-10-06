"use client";

import React from "react";
import { cn } from "@/lib/utils";

// Legacy name kept so every existing page inherits the new flat surface
// without per-page edits. Visually: solid surface, 1px border, no glow.

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  elevated?: boolean;
  hoverEffect?: boolean;
}

export function GlassCard({
  children,
  className,
  elevated = false,
  hoverEffect = false,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface text-foreground shadow-xs overflow-hidden",
        elevated && "bg-surface-elevated",
        hoverEffect && "transition-colors hover:border-border-strong",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function GlassCardHeader({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border px-4 py-2.5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function GlassCardContent({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-4", className)} {...props}>
      {children}
    </div>
  );
}
