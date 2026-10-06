"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Activity,
  Globe,
  Gauge,
  Network,
  Sparkles,
  ArrowUpRight,
  Wrench,
  X,
} from "lucide-react";
import {
  ScrollReveal,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/ScrollReveal";

const SpeedTestTool = dynamic(
  () => import("./SpeedTestTool").then((m) => m.SpeedTestTool),
  {
    loading: () => (
      <div className="h-64 rounded-2xl bg-surface-subtle border border-border animate-pulse" />
    ),
  }
);

const WhatIsMyIpTool = dynamic(
  () => import("./WhatIsMyIpTool").then((m) => m.WhatIsMyIpTool),
  {
    loading: () => (
      <div className="h-64 rounded-2xl bg-surface-subtle border border-border animate-pulse" />
    ),
  }
);

const BandwidthCalculatorTool = dynamic(
  () =>
    import("./BandwidthCalculatorTool").then((m) => m.BandwidthCalculatorTool),
  {
    loading: () => (
      <div className="h-64 rounded-2xl bg-surface-subtle border border-border animate-pulse" />
    ),
  }
);

const SubnetCalculatorTool = dynamic(
  () => import("./SubnetCalculatorTool").then((m) => m.SubnetCalculatorTool),
  {
    loading: () => (
      <div className="h-64 rounded-2xl bg-surface-subtle border border-border animate-pulse" />
    ),
  }
);

export type FreeToolId =
  | "speed-test"
  | "what-is-my-ip"
  | "bandwidth-calculator"
  | "subnet-calculator";

interface FreeToolsSectionProps {
  openTool?: FreeToolId | null;
  onOpenToolChange?: (tool: FreeToolId | null) => void;
  onEnterDemo: () => void;
}

const INTERACTIVE_TOOLS: Array<{
  id: FreeToolId;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "speed-test",
    title: "Speed Test",
    description: "Download, upload, ping and jitter in one run",
    icon: Activity,
  },
  {
    id: "what-is-my-ip",
    title: "What Is My IP",
    description: "Your public IP address and who it belongs to",
    icon: Globe,
  },
  {
    id: "bandwidth-calculator",
    title: "Bandwidth Calculator",
    description: "Size an upstream before you buy it",
    icon: Gauge,
  },
  {
    id: "subnet-calculator",
    title: "Subnet Calculator",
    description: "Split an IPv4 block and read off its hosts",
    icon: Network,
  },
];

export function FreeToolsSection({
  openTool: controlledOpenTool,
  onOpenToolChange,
  onEnterDemo,
}: FreeToolsSectionProps) {
  const [internalOpenTool, setInternalOpenTool] = useState<FreeToolId | null>(
    null
  );
  const activeModalTool =
    controlledOpenTool !== undefined ? controlledOpenTool : internalOpenTool;

  const setModalTool = (tool: FreeToolId | null) => {
    setInternalOpenTool(tool);
    onOpenToolChange?.(tool);
  };

  // Close popup on Escape key and prevent background page scroll while modal is open
  useEffect(() => {
    if (!activeModalTool) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModalTool(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeModalTool]);

  const currentToolMeta = INTERACTIVE_TOOLS.find(
    (t) => t.id === activeModalTool
  );

  return (
    <section
      id="free-tools"
      className="py-16 md:py-24 bg-background border-t border-border scroll-mt-20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Section Header */}
        <ScrollReveal
          variant="fade-up"
          className="text-center max-w-3xl mx-auto space-y-3"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
            <Wrench className="w-3.5 h-3.5" />
            <span>Free Tools</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Free ISP &amp; Network Engineering Utilities
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Run live diagnostics, inspect public routing, size upstream capacity, calculate IPv4 subnets, or explore the pre-populated QC NetCore operator workspace.
          </p>
        </ScrollReveal>

        {/* 5 Free Tool Trigger Cards (Open as Screen Popup on Click) */}
        <StaggerContainer
          staggerMs={75}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
        >
          {INTERACTIVE_TOOLS.map((tool, idx) => {
            const Icon = tool.icon;
            return (
              <StaggerItem key={tool.id} index={idx} variant="metric-card">
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => setModalTool(tool.id)}
                  className="w-full h-full text-left p-5 rounded-2xl bg-surface hover:bg-surface-subtle border border-border hover:border-primary/50 hover:-translate-y-1 hover:shadow-md active:scale-[0.99] transition-all duration-200 flex flex-col justify-between gap-4 group cursor-pointer shadow-xs"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-105 transition-all duration-200">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-surface-subtle text-muted-foreground border border-border group-hover:border-primary/30 group-hover:text-primary transition-colors">
                        Open Tool
                      </span>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-foreground group-hover:text-primary transition-colors">
                        {tool.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {tool.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-xs font-bold text-primary">
                    <span>Launch popup</span>
                    <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </button>
              </StaggerItem>
            );
          })}

          {/* 5th Card: Live Demo */}
          <StaggerItem index={4} variant="metric-card">
            <Link
              href="/dashboard?demo=true"
              onClick={onEnterDemo}
              className="w-full h-full text-left p-5 rounded-2xl bg-surface hover:bg-surface-subtle border border-border hover:border-primary/50 hover:-translate-y-1 hover:shadow-md active:scale-[0.99] transition-all duration-200 flex flex-col justify-between gap-4 group shadow-xs"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-105 transition-all duration-200">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-surface-subtle text-muted-foreground border border-border group-hover:border-primary/30 group-hover:text-primary transition-colors">
                    Operator App
                  </span>
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-foreground group-hover:text-primary transition-colors">
                    Live Demo
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    The operator app, already filled with data
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 text-xs font-bold text-primary">
                <span>Open operator demo</span>
                <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </Link>
          </StaggerItem>
        </StaggerContainer>
      </div>

      {/* Screen-Level Tool Popup / Modal Overlay */}
      {activeModalTool && currentToolMeta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="free-tool-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center sm:p-4 md:p-6 bg-background/80 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setModalTool(null);
            }
          }}
        >
          <div className="w-full h-dvh sm:h-auto sm:max-h-[90vh] max-w-5xl bg-surface sm:rounded-3xl sm:border sm:border-border shadow-2xl flex flex-col overflow-hidden">
            {/* Sticky Modal Header with Tool Switcher & Close Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4 border-b border-border bg-surface-subtle/60 shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                    <currentToolMeta.icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h2
                      id="free-tool-modal-title"
                      className="text-sm sm:text-base font-extrabold text-foreground truncate"
                    >
                      {currentToolMeta.title}
                    </h2>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {currentToolMeta.description}
                    </p>
                  </div>
                </div>

                {/* Mobile Close Button */}
                <button
                  type="button"
                  onClick={() => setModalTool(null)}
                  aria-label="Close tool popup"
                  className="sm:hidden w-9 h-9 rounded-xl bg-surface border border-border text-foreground flex items-center justify-center hover:bg-surface-elevated shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Tool Tabs + Desktop Close Button */}
              <div className="flex items-center justify-between sm:justify-end gap-2 overflow-x-auto pb-1 sm:pb-0">
                <div className="flex items-center gap-1">
                  {INTERACTIVE_TOOLS.map((t) => {
                    const isCurrent = t.id === activeModalTool;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setModalTool(t.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                          isCurrent
                            ? "bg-primary text-primary-foreground"
                            : "bg-surface border border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t.title}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setModalTool(null)}
                  aria-label="Close tool popup"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-border hover:border-primary/40 text-xs font-bold text-foreground transition-colors shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Close</span>
                </button>
              </div>
            </div>

            {/* Scrollable Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
              {activeModalTool === "speed-test" && <SpeedTestTool />}
              {activeModalTool === "what-is-my-ip" && <WhatIsMyIpTool />}
              {activeModalTool === "bandwidth-calculator" && (
                <BandwidthCalculatorTool />
              )}
              {activeModalTool === "subnet-calculator" && (
                <SubnetCalculatorTool />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
