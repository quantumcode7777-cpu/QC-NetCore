import React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      {Icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-elevated text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Error block: what happened, whether anything changed, what to do next. */
export function ErrorState({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm">
      <div className="font-semibold text-danger">{title}</div>
      {detail && <p className="mt-0.5 text-foreground/80">{detail}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground hover:bg-surface-elevated"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("gt-skeleton h-4 w-full", className)} />;
}

/** Skeleton rows that match the final table layout. */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-label="Loading" className="divide-y divide-border-subtle">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={c === 0 ? "h-4 w-1/4" : "h-4 flex-1"} />
          ))}
        </div>
      ))}
    </div>
  );
}
