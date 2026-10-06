"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface GlassBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: "primary" | "success" | "warning" | "destructive" | "neutral";
  size?: "sm" | "md";
}

// Legacy name kept for existing call sites; now a compact, semantic-token chip.
export function GlassBadge({
  children,
  variant = "neutral",
  size = "md",
  className,
  ...props
}: GlassBadgeProps) {
  const variantStyles = {
    primary: "bg-info-soft text-info border-info/25",
    success: "bg-success-soft text-success border-success/25",
    warning: "bg-warning-soft text-warning border-warning/25",
    destructive: "bg-danger-soft text-danger border-danger/25",
    neutral: "bg-surface-elevated text-muted-foreground border-border",
  };

  const sizeStyles = {
    sm: "text-xs px-1.5 py-0.5 font-medium",
    md: "text-xs px-2 py-1 font-medium",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-md border whitespace-nowrap",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
