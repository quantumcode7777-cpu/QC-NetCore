"use client";

import React, { useEffect, useState } from "react";
import {
  Network,
  Zap,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn, formatShortDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  SEED_TOPOLOGY_NODES,
  SEED_AUTOMATION_RULES,
} from "@/lib/db/os-2027-seed";
import {
  correlateOutageBlastRadius,
  AutomationRule,
} from "@/lib/network/topology-gis-automation";
import { useAuth } from "@/lib/auth/auth-context";

export function TopologyAndAutomationPanels() {
  const { isDemoMode } = useAuth();
  const [selectedNodeId, setSelectedNodeId] = useState<string>("node-rtr-01");
  const [showTopologyDetails, setShowTopologyDetails] = useState(false);
  const [showAutomationDetails, setShowAutomationDetails] = useState(false);
  const [rules, setRules] = useState<AutomationRule[]>(() =>
    isDemoMode ? SEED_AUTOMATION_RULES : []
  );

  useEffect(() => {
    setRules(isDemoMode ? SEED_AUTOMATION_RULES : []);
  }, [isDemoMode]);

  const topologyNodes = isDemoMode ? SEED_TOPOLOGY_NODES : [];

  const blastRadius =
    topologyNodes.length > 0
      ? correlateOutageBlastRadius(topologyNodes, selectedNodeId)
      : null;

  const toggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isEnabled: !r.isEnabled } : r))
    );
  };

  // Topology summary counts
  const coreNodes = topologyNodes.filter(
    (n) => n.nodeType === "UPSTREAM_TRANSIT" || n.nodeType === "CORE_ROUTER"
  );
  const popNodes = topologyNodes.filter((n) => n.nodeType === "OLT");
  const accessNodes = topologyNodes.filter(
    (n) => n.nodeType !== "UPSTREAM_TRANSIT" && n.nodeType !== "CORE_ROUTER" && n.nodeType !== "OLT"
  );
  const degradedNodes = topologyNodes.filter((n) => n.status !== "ONLINE").length;

  // Automation summary counts
  const activeRulesCount = rules.filter((r) => r.isEnabled).length;
  const pausedRulesCount = rules.length - activeRulesCount;
  const totalExecutions = rules.reduce((sum, r) => sum + r.executionCount, 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Compact Network Topology Summary Card */}
      <section className="rounded-lg border border-border bg-surface p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary">
              <Network className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Network Topology
              </h3>
              <p className="text-xs text-muted-foreground">
                {topologyNodes.length === 0
                  ? "No topology data"
                  : `${topologyNodes.length} nodes monitored · ${
                      degradedNodes === 0
                        ? "All healthy"
                        : `${degradedNodes} degraded`
                    }`}
              </p>
            </div>
          </div>

          {topologyNodes.length > 0 && (
            <button
              type="button"
              onClick={() => setShowTopologyDetails((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-subtle px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-surface"
            >
              {showTopologyDetails ? "Hide topology" : "View topology"}
              {showTopologyDetails ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          )}
        </div>

        {/* Compact Status Indicators */}
        {topologyNodes.length === 0 ? (
          <div className="mt-3 flex items-center justify-between rounded-md border border-border-subtle bg-surface-subtle/60 px-3 py-2.5 text-xs text-muted-foreground">
            <span>Core / POP / Access</span>
            <span className="font-mono">—</span>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-md border border-border-subtle bg-surface-subtle/50 px-3 py-2">
              <div className="text-[11px] text-muted-foreground">Core</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <span className="h-2 w-2 rounded-full bg-success" />
                <span>{coreNodes.length} Online</span>
              </div>
            </div>
            <div className="rounded-md border border-border-subtle bg-surface-subtle/50 px-3 py-2">
              <div className="text-[11px] text-muted-foreground">POP / OLT</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    popNodes.some((n) => n.status !== "ONLINE")
                      ? "bg-warning"
                      : "bg-success"
                  )}
                />
                <span>{popNodes.length} Active</span>
              </div>
            </div>
            <div className="rounded-md border border-border-subtle bg-surface-subtle/50 px-3 py-2">
              <div className="text-[11px] text-muted-foreground">Access</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    accessNodes.some((n) => n.status !== "ONLINE")
                      ? "bg-warning"
                      : "bg-success"
                  )}
                />
                <span>{accessNodes.length} Splitters</span>
              </div>
            </div>
          </div>
        )}

        {/* Expandable Interactive Topology Tree */}
        {showTopologyDetails && topologyNodes.length > 0 && (
          <div className="mt-3 space-y-2.5 border-t border-border-subtle pt-3">
            <div className="space-y-1.5">
              {topologyNodes.map((node) => {
                const selected = node.id === selectedNodeId;
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedNodeId(node.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors",
                      selected
                        ? "border-primary bg-primary-soft font-medium text-primary"
                        : "border-border bg-surface hover:bg-surface-subtle"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          node.status === "ONLINE" ? "bg-success" : "bg-warning"
                        )}
                      />
                      <span className="truncate">{node.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {node.nodeType}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {node.subscriberCount} subs · {node.latencyMs}ms
                      </span>
                      <StatusBadge status={node.status} />
                    </div>
                  </button>
                );
              })}
            </div>

            {blastRadius && (
              <div className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs">
                <div className="flex items-center justify-between font-semibold text-warning">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Blast Radius: {blastRadius.rootNodeName}
                  </span>
                  <span className="font-mono text-[11px]">
                    {blastRadius.estimatedAffectedSubscribers} subs ·{" "}
                    {blastRadius.suppressedChildAlertCount} alarms suppressed
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Compact Automation Summary Card */}
      <section className="rounded-lg border border-border bg-surface p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Automation
              </h3>
              <p className="text-xs text-muted-foreground">
                {rules.length === 0
                  ? "0 rules active"
                  : `${activeRulesCount} active · ${totalExecutions} executions`}
              </p>
            </div>
          </div>

          {rules.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAutomationDetails((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-subtle px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-surface"
            >
              {showAutomationDetails ? "Hide automation" : "View automation"}
              {showAutomationDetails ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          )}
        </div>

        {/* Compact Metrics Grid */}
        {rules.length === 0 ? (
          <div className="mt-3 flex items-center justify-between rounded-md border border-border-subtle bg-surface-subtle/60 px-3 py-2.5 text-xs text-muted-foreground">
            <span>Closed-loop rules</span>
            <span className="font-mono">0 active</span>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-md border border-border-subtle bg-surface-subtle/50 px-3 py-2">
              <div className="text-[11px] text-muted-foreground">Active Rules</div>
              <div className="mt-0.5 flex items-center gap-1.5 font-mono text-xs font-semibold text-foreground">
                <span className="h-2 w-2 rounded-full bg-success" />
                <span>{activeRulesCount}</span>
              </div>
            </div>
            <div className="rounded-md border border-border-subtle bg-surface-subtle/50 px-3 py-2">
              <div className="text-[11px] text-muted-foreground">Executed</div>
              <div className="mt-0.5 font-mono text-xs font-semibold text-foreground">
                {totalExecutions}
              </div>
            </div>
            <div className="rounded-md border border-border-subtle bg-surface-subtle/50 px-3 py-2">
              <div className="text-[11px] text-muted-foreground">Paused</div>
              <div className="mt-0.5 font-mono text-xs font-semibold text-muted-foreground">
                {pausedRulesCount}
              </div>
            </div>
          </div>
        )}

        {/* Expandable Automation Rules List */}
        {showAutomationDetails && rules.length > 0 && (
          <div className="mt-3 divide-y divide-border-subtle border-t border-border-subtle pt-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between gap-3 py-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">
                    {rule.name}
                  </div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">
                    {rule.triggerEvent} &rarr; {rule.actionType} ·{" "}
                    {rule.executionCount}x
                    {rule.lastTriggeredAt &&
                      ` (${formatShortDate(rule.lastTriggeredAt)})`}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={rule.isEnabled}
                  onClick={() => toggleRule(rule.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                    rule.isEnabled
                      ? "border-success/30 bg-success-soft text-success"
                      : "border-border bg-surface-subtle text-muted-foreground"
                  )}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {rule.isEnabled ? "Active" : "Paused"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
