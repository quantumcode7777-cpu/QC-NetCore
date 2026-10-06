// ============================================================================
// QC NETCORE — IMMUTABLE EVENT BUS & SECURITY OPERATIONS CENTER (SOC) ENGINE
// Event-driven architecture log and real-time security anomaly detection.
// ============================================================================

export type SystemEventCategory =
  | "SUBSCRIBER"
  | "BILLING"
  | "NETWORK"
  | "FIELD"
  | "SECURITY"
  | "SYSTEM";

export type SystemEventSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface SystemEvent {
  id: string;
  organizationId: string;
  eventType: string;
  category: SystemEventCategory;
  severity: SystemEventSeverity;
  actorId?: string;
  actorName: string;
  entityType?: string;
  entityId?: string;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type SecuritySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface SecurityEvent {
  id: string;
  organizationId: string;
  eventCode: string;
  severity: SecuritySeverity;
  actorEmail?: string;
  sourceIp?: string;
  userAgent?: string;
  description: string;
  mitigationAction: string;
  isResolved: boolean;
  createdAt: string;
}

export function createSystemEvent(params: {
  id?: string;
  organizationId: string;
  eventType: string;
  category: SystemEventCategory;
  severity?: SystemEventSeverity;
  actorId?: string;
  actorName?: string;
  entityType?: string;
  entityId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}): SystemEvent {
  return {
    id: params.id || `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    organizationId: params.organizationId,
    eventType: params.eventType,
    category: params.category,
    severity: params.severity || "INFO",
    actorId: params.actorId,
    actorName: params.actorName || "system",
    entityType: params.entityType,
    entityId: params.entityId,
    summary: params.summary,
    metadata: params.metadata || {},
    createdAt: params.createdAt || new Date().toISOString(),
  };
}

/**
 * Evaluates authentication and operational telemetry for SOC threats:
 * - Brute-force login attempts (>= 5 failed attempts from same IP)
 * - Cross-tenant access probe
 * - Unsigned webhook callback payload
 * - Mass subscriber disconnect spike
 */
export function evaluateSocSignal(params: {
  organizationId: string;
  signalType:
    | "FAILED_AUTH_BURST"
    | "CROSS_TENANT_PROBE"
    | "UNSIGNED_WEBHOOK"
    | "MASS_DISCONNECT_SPIKE"
    | "PRIVILEGE_ESCALATION_ATTEMPT";
  actorEmail?: string;
  sourceIp?: string;
  count?: number;
  detail?: string;
  createdAt?: string;
}): SecurityEvent {
  const { organizationId, signalType, actorEmail, sourceIp, count = 1, detail } = params;

  switch (signalType) {
    case "FAILED_AUTH_BURST":
      return {
        id: `sec-${Date.now()}`,
        organizationId,
        eventCode: "SOC_BRUTE_FORCE_DETECTED",
        severity: count >= 10 ? "CRITICAL" : "HIGH",
        actorEmail,
        sourceIp: sourceIp || "197.232.61.14",
        description:
          detail ||
          `${count} consecutive failed authentication attempts detected from ${
            sourceIp || "unknown IP"
          }.`,
        mitigationAction: "IP rate-limited for 15 minutes; MFA challenge enforced.",
        isResolved: false,
        createdAt: params.createdAt || new Date().toISOString(),
      };

    case "CROSS_TENANT_PROBE":
      return {
        id: `sec-${Date.now()}`,
        organizationId,
        eventCode: "SOC_TENANT_ISOLATION_BLOCK",
        severity: "CRITICAL",
        actorEmail,
        sourceIp,
        description:
          detail ||
          `Blocked cross-tenant query attempt against non-member organization resource.`,
        mitigationAction: "Rejected by Row-Level Security (auth_org_id) and logged to immutable audit trail.",
        isResolved: true,
        createdAt: params.createdAt || new Date().toISOString(),
      };

    case "UNSIGNED_WEBHOOK":
      return {
        id: `sec-${Date.now()}`,
        organizationId,
        eventCode: "SOC_WEBHOOK_SIGNATURE_INVALID",
        severity: "HIGH",
        sourceIp,
        description:
          detail ||
          "Payment callback rejected due to invalid HMAC-SHA256 signature or untrusted origin IP.",
        mitigationAction: "Payload dropped; zero ledger impact.",
        isResolved: true,
        createdAt: params.createdAt || new Date().toISOString(),
      };

    case "MASS_DISCONNECT_SPIKE":
      return {
        id: `sec-${Date.now()}`,
        organizationId,
        eventCode: "SOC_BULK_ACTION_GUARD",
        severity: "MEDIUM",
        actorEmail,
        sourceIp,
        description:
          detail ||
          `Bulk disconnect request affecting ${count} subscribers intercepted by Maker-Checker guard.`,
        mitigationAction: "Held in pending approval queue awaiting supervisor sign-off.",
        isResolved: false,
        createdAt: params.createdAt || new Date().toISOString(),
      };

    case "PRIVILEGE_ESCALATION_ATTEMPT":
      return {
        id: `sec-${Date.now()}`,
        organizationId,
        eventCode: "SOC_RBAC_DENIED",
        severity: "HIGH",
        actorEmail,
        sourceIp,
        description:
          detail ||
          `Unauthorized attempt to execute privileged operation by ${actorEmail || "operator"}.`,
        mitigationAction: "Request denied (HTTP 403) and security alert raised.",
        isResolved: true,
        createdAt: params.createdAt || new Date().toISOString(),
      };
  }
}
