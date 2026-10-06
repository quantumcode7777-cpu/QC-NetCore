"use client";

import React from "react";
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Loader2,
  PauseCircle,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One status language for the whole console.
 * Every status has an icon + text + semantic colour, so meaning never
 * depends on colour alone.
 */
export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_STYLES: Record<StatusTone, string> = {
  success: "bg-success-soft text-success border-success/25",
  warning: "bg-warning-soft text-warning border-warning/25",
  danger: "bg-danger-soft text-danger border-danger/25",
  info: "bg-info-soft text-info border-info/25",
  neutral: "bg-surface-elevated text-muted-foreground border-border",
};

type StatusDef = { tone: StatusTone; label: string; icon: React.ComponentType<{ className?: string }> };

const STATUS_MAP: Record<string, StatusDef> = {
  // Network
  ONLINE: { tone: "success", label: "Online", icon: CheckCircle2 },
  OFFLINE: { tone: "danger", label: "Offline", icon: XCircle },
  DEGRADED: { tone: "warning", label: "Degraded", icon: AlertTriangle },
  UNREACHABLE: { tone: "danger", label: "Unreachable", icon: XCircle },
  // Customer / subscription
  ACTIVE: { tone: "success", label: "Active", icon: CheckCircle2 },
  GRACE: { tone: "warning", label: "Grace period", icon: Clock },
  EXPIRED: { tone: "danger", label: "Expired", icon: XCircle },
  SUSPENDED: { tone: "danger", label: "Suspended", icon: PauseCircle },
  CANCELLED: { tone: "neutral", label: "Cancelled", icon: XCircle },
  TERMINATED: { tone: "neutral", label: "Terminated", icon: XCircle },
  LEAD: { tone: "info", label: "Lead", icon: Circle },
  PENDING_INSTALLATION: { tone: "warning", label: "Pending install", icon: Clock },
  // Payments / invoices
  COMPLETED: { tone: "success", label: "Paid", icon: CheckCircle2 },
  PAID: { tone: "success", label: "Paid", icon: CheckCircle2 },
  PENDING: { tone: "warning", label: "Pending", icon: Clock },
  INITIATED: { tone: "info", label: "Processing", icon: Loader2 },
  FAILED: { tone: "danger", label: "Failed", icon: XCircle },
  REVERSED: { tone: "neutral", label: "Reversed", icon: XCircle },
  UNPAID: { tone: "warning", label: "Unpaid", icon: Clock },
  PARTIALLY_PAID: { tone: "warning", label: "Part paid", icon: Clock },
  OVERDUE: { tone: "danger", label: "Overdue", icon: AlertTriangle },
  VOID: { tone: "neutral", label: "Void", icon: XCircle },
  // Vouchers / work orders
  AVAILABLE: { tone: "success", label: "Available", icon: CheckCircle2 },
  USED: { tone: "neutral", label: "Used", icon: CheckCircle2 },
  DISABLED: { tone: "neutral", label: "Disabled", icon: XCircle },
};

export function StatusBadge({
  status,
  label,
  tone,
  className,
}: {
  status: string;
  /** Override the default label */
  label?: string;
  /** Override the default tone */
  tone?: StatusTone;
  className?: string;
}) {
  const def = STATUS_MAP[status.toUpperCase()] ?? {
    tone: "neutral" as StatusTone,
    label: status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
    icon: Circle,
  };
  const Icon = def.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium leading-4 whitespace-nowrap",
        TONE_STYLES[tone ?? def.tone],
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {label ?? def.label}
    </span>
  );
}
