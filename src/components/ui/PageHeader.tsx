import React from "react";
import { cn } from "@/lib/utils";

/** Consistent page title block: title, optional description, right-aligned actions. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold leading-6 tracking-tight text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Shared button class recipes so every action looks the same. */
export const btn = {
  base:
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary: "border border-border bg-surface text-foreground hover:bg-surface-elevated",
  ghost: "text-muted-foreground hover:bg-surface-elevated hover:text-foreground",
  danger: "bg-danger text-accent-foreground hover:opacity-90",
};

export function btnClass(variant: keyof Omit<typeof btn, "base"> = "secondary", extra?: string) {
  return cn(btn.base, btn[variant], extra);
}
