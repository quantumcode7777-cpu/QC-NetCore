"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  History,
  KeyRound,
  Webhook,
  CheckCircle2,
} from "lucide-react";
import { cn, formatShortDate } from "@/lib/utils";
import {
  SEED_SYSTEM_EVENTS,
  SEED_SECURITY_EVENTS,
} from "@/lib/db/os-2027-seed";
import { listRolePermissions } from "@/lib/auth/rbac";
import { useAuth } from "@/lib/auth/auth-context";
import type { UserRole } from "@/types";

const ROLES_TO_INSPECT: UserRole[] = [
  "isp_owner",
  "isp_admin",
  "noc_engineer",
  "finance",
  "support",
  "technician",
  "auditor",
  "reseller",
];

export function SocAndGovernancePanels() {
  const { isDemoMode } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>("noc_engineer");
  const permissions = listRolePermissions(selectedRole);

  const securityEvents = isDemoMode ? SEED_SECURITY_EVENTS : [];
  const systemEvents = isDemoMode ? SEED_SYSTEM_EVENTS : [];

  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Security Operations Center (SOC) Feed */}
        <section className="rounded-lg border border-border bg-surface shadow-xs">
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            <ShieldAlert className="h-4 w-4 text-primary" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Security Operations Center (SOC) &amp; Threat Telemetry
              </h2>
              <p className="text-xs text-muted-foreground">
                Real-time brute-force protection, HMAC webhook signature
                enforcement, and tenant RLS guardrails.
              </p>
            </div>
          </header>
          <div className="divide-y divide-border-subtle">
            {securityEvents.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                No security events or threat alerts recorded.
              </div>
            ) : (
              securityEvents.map((sec) => (
                <div key={sec.id} className="space-y-1 p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-primary">
                      {sec.eventCode}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[11px] font-semibold",
                        sec.severity === "HIGH" || sec.severity === "CRITICAL"
                          ? "bg-danger-soft text-danger"
                          : "bg-success-soft text-success"
                      )}
                    >
                      {sec.severity}
                    </span>
                  </div>
                  <p className="text-foreground">{sec.description}</p>
                  <div className="text-[11px] text-muted-foreground">
                    Source IP: <span className="font-mono">{sec.sourceIp}</span> ·
                    Mitigation: {sec.mitigationAction}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Immutable Event Bus & Audit Trail */}
        <section className="rounded-lg border border-border bg-surface shadow-xs">
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            <History className="h-4 w-4 text-primary" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Immutable System Event Bus &amp; Audit Timeline
              </h2>
              <p className="text-xs text-muted-foreground">
                Cryptographically ordered operational events across Billing,
                NOC, OLT, and Maker-Checker workflows.
              </p>
            </div>
          </header>
          <div className="divide-y divide-border-subtle">
            {systemEvents.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                No system audit events recorded yet.
              </div>
            ) : (
              systemEvents.map((evt) => (
                <div key={evt.id} className="space-y-1 p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-foreground">
                      {evt.eventType}
                    </span>
                    <span className="text-muted-foreground">
                      {formatShortDate(evt.createdAt)}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{evt.summary}</p>
                  <div className="text-[11px] text-muted-foreground">
                    Actor: <strong>{evt.actorName}</strong> · Category:{" "}
                    {evt.category}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Granular RBAC Matrix & Signed Webhooks */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">
                Granular RBAC Permission Inspector
              </h3>
            </div>
            <select
              aria-label="Inspect role permissions"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as UserRole)}
              className="h-8 rounded-md border border-border bg-surface px-2.5 text-xs font-medium"
            >
              {ROLES_TO_INSPECT.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {permissions.map((perm) => (
              <span
                key={perm}
                className="inline-flex items-center gap-1 rounded border border-border bg-surface-subtle px-2 py-0.5 font-mono text-[11px] text-foreground"
              >
                <CheckCircle2 className="h-3 w-3 text-success" />
                {perm}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4 shadow-xs space-y-2">
          <div className="flex items-center gap-2">
            <Webhook className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">
              Open API &amp; HMAC-SHA256 Signed Webhooks
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Outbound event streams signed with{" "}
            <code className="font-mono text-foreground">
              X-QCNetCore-Signature-256
            </code>{" "}
            for ERP, accounting, and WhatsApp Business gateway integrations.
          </p>
          <div className="rounded border border-border bg-surface-subtle p-2.5 font-mono text-xs">
            {isDemoMode ? (
              <>
                <div>
                  Endpoint: <span className="text-primary">https://erp.nexanet.co.ke/webhooks/isp</span>
                </div>
                <div className="text-muted-foreground">
                  Subscribed: payment.completed, subscriber.suspended,
                  network.outage_detected
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">
                No outbound webhook endpoints configured yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
