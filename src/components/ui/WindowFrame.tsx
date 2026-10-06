"use client";

import React from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface WindowFrameProps {
  urlPreview?: string;
  tabs?: Array<{ label: string; active?: boolean; onClick?: () => void }>;
  children: React.ReactNode;
  className?: string;
}

export function WindowFrame({
  urlPreview = "g-tech-isp-billing-system.vercel.app/operations",
  tabs,
  children,
  className,
}: WindowFrameProps) {
  return (
    <div className={cn("rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden", className)}>
      {/* Window Top Control Bar */}
      <div className="flex items-center justify-between border-b border-border bg-surface-elevated/70 px-4 sm:px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
          <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
          <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
          {urlPreview && (
            <span className="ml-2 hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-background px-3 py-0.5 rounded-lg border border-border">
              <Lock className="w-3 h-3 text-primary" />
              {urlPreview}
            </span>
          )}
        </div>

        {tabs && tabs.length > 0 && (
          <div className="flex items-center gap-1 bg-background p-1 rounded-xl border border-border">
            {tabs.map((tab, idx) => (
              <button
                key={idx}
                onClick={tab.onClick}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                  tab.active
                    ? "bg-surface-elevated text-foreground border border-border shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Frame Body */}
      <div>{children}</div>
    </div>
  );
}
