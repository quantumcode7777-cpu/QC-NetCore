// ============================================================================
// QC NETCORE — NOC TOPOLOGY, OUTAGE CORRELATION, GIS & AUTOMATION ENGINE
// ============================================================================

export type TopologyNodeType =
  | "UPSTREAM_TRANSIT"
  | "CORE_ROUTER"
  | "OLT"
  | "POP_SECTOR"
  | "NAP_SPLITTER"
  | "SUBSCRIBER_ONT";

export interface TopologyNode {
  id: string;
  nodeCode: string;
  name: string;
  nodeType: TopologyNodeType;
  parentNodeId?: string;
  status: "ONLINE" | "DEGRADED" | "OFFLINE";
  subscriberCount: number;
  latencyMs: number;
  utilizationPercent: number;
}

export interface OutageBlastRadiusReport {
  rootNodeId: string;
  rootNodeName: string;
  rootNodeType: TopologyNodeType;
  affectedDownstreamNodes: TopologyNode[];
  estimatedAffectedSubscribers: number;
  suppressedChildAlertCount: number;
  probableRootCause: string;
  recommendedAction: string;
}

/**
 * Traverses the network topology graph downward from `failedNodeId` to compute
 * the exact outage blast radius, affected subscriber count, and child alert suppression.
 */
export function correlateOutageBlastRadius(
  nodes: TopologyNode[],
  failedNodeId: string
): OutageBlastRadiusReport {
  const root = nodes.find((n) => n.id === failedNodeId || n.nodeCode === failedNodeId);
  if (!root) {
    throw new Error(`Topology node "${failedNodeId}" not found.`);
  }

  const childrenByParent = new Map<string, TopologyNode[]>();
  for (const n of nodes) {
    if (!n.parentNodeId) continue;
    const list = childrenByParent.get(n.parentNodeId) || [];
    list.push(n);
    childrenByParent.set(n.parentNodeId, list);
  }

  const downstream: TopologyNode[] = [];
  const queue: TopologyNode[] = [...(childrenByParent.get(root.id) || [])];

  while (queue.length > 0) {
    const current = queue.shift()!;
    downstream.push(current);
    const kids = childrenByParent.get(current.id) || [];
    queue.push(...kids);
  }

  // Leaf subscriber count or root subscriber count
  const leafCount = downstream.reduce(
    (sum, n) =>
      (childrenByParent.get(n.id) || []).length === 0 ? sum + n.subscriberCount : sum,
    0
  );
  const estimatedAffectedSubscribers = Math.max(root.subscriberCount, leafCount);

  let probableRootCause = "Hardware or power interruption at node.";
  if (root.nodeType === "UPSTREAM_TRANSIT") {
    probableRootCause = "Upstream BGP peer flap or transit fiber cut.";
  } else if (root.nodeType === "CORE_ROUTER") {
    probableRootCause = "Core BNG/Router unreachable or WireGuard management tunnel down.";
  } else if (root.nodeType === "OLT") {
    probableRootCause = "OLT chassis power event or uplink SFP loss of signal.";
  } else if (root.nodeType === "NAP_SPLITTER") {
    probableRootCause = "Feeder/distribution fiber cut between OLT PON port and NAP splitter box.";
  }

  return {
    rootNodeId: root.id,
    rootNodeName: root.name,
    rootNodeType: root.nodeType,
    affectedDownstreamNodes: downstream,
    estimatedAffectedSubscribers,
    suppressedChildAlertCount: downstream.length,
    probableRootCause,
    recommendedAction: `Suppress ${downstream.length} downstream child alarm(s), broadcast proactive outage advisory to ${estimatedAffectedSubscribers} subscriber(s), and dispatch field engineer to ${root.name}.`,
  };
}

// ============================================================================
// GIS FIBER / NAP COVERAGE & SERVICEABILITY ENGINE
// ============================================================================

export interface GisFiberNode {
  id: string;
  code: string;
  name: string;
  nodeKind: "POP_TOWER" | "FDC_CABINET" | "NAP_FAT_BOX" | "SPLICE_CLOSURE";
  latitude: number;
  longitude: number;
  totalPorts: number;
  occupiedPorts: number;
  feederCableCode: string;
  status: "ACTIVE" | "FULL" | "MAINTENANCE";
}

export interface GisServiceabilityResult {
  serviceable: boolean;
  nearestNode?: GisFiberNode;
  distanceMeters: number;
  estimatedDropCableMeters: number;
  availablePorts: number;
  feasibilityNote: string;
}

/**
 * Computes great-circle distance in meters between two GPS coordinates using Haversine formula.
 */
export function computeHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Evaluates FTTH drop feasibility from a prospect's GPS coordinates against
 * active NAP/FAT splitter boxes (standard drop limit <= 300m).
 */
export function checkGisServiceability(params: {
  latitude: number;
  longitude: number;
  gisNodes: GisFiberNode[];
  maxDropMeters?: number;
}): GisServiceabilityResult {
  const maxDrop = params.maxDropMeters ?? 300;
  const candidateNodes = params.gisNodes.filter(
    (n) => n.nodeKind === "NAP_FAT_BOX" && n.status !== "MAINTENANCE"
  );

  if (candidateNodes.length === 0) {
    return {
      serviceable: false,
      distanceMeters: 0,
      estimatedDropCableMeters: 0,
      availablePorts: 0,
      feasibilityNote: "No active NAP/FAT distribution boxes registered in GIS.",
    };
  }

  let bestNode: GisFiberNode | undefined;
  let bestDist = Infinity;

  for (const node of candidateNodes) {
    const d = computeHaversineDistanceMeters(
      params.latitude,
      params.longitude,
      node.latitude,
      node.longitude
    );
    if (d < bestDist) {
      bestDist = d;
      bestNode = node;
    }
  }

  const chosen = bestNode!;
  const availablePorts = Math.max(0, chosen.totalPorts - chosen.occupiedPorts);
  // Add 18% slack for pole routing and service loops
  const estimatedDropCableMeters = Math.round(bestDist * 1.18);

  if (availablePorts === 0) {
    return {
      serviceable: false,
      nearestNode: chosen,
      distanceMeters: bestDist,
      estimatedDropCableMeters,
      availablePorts: 0,
      feasibilityNote: `Nearest box ${chosen.code} (${bestDist}m) is at 100% port occupancy (${chosen.occupiedPorts}/${chosen.totalPorts}). Splitter expansion required.`,
    };
  }

  if (estimatedDropCableMeters > maxDrop) {
    return {
      serviceable: false,
      nearestNode: chosen,
      distanceMeters: bestDist,
      estimatedDropCableMeters,
      availablePorts,
      feasibilityNote: `Nearest box ${chosen.code} requires ~${estimatedDropCableMeters}m drop cable (exceeds ${maxDrop}m standard aerial span limit).`,
    };
  }

  return {
    serviceable: true,
    nearestNode: chosen,
    distanceMeters: bestDist,
    estimatedDropCableMeters,
    availablePorts,
    feasibilityNote: `Serviceable via ${chosen.code} (${bestDist}m line-of-sight, ~${estimatedDropCableMeters}m drop cable, ${availablePorts} free port(s)).`,
  };
}

// ============================================================================
// IF-THIS-THEN-THAT AUTOMATION RULES ENGINE
// ============================================================================

export interface AutomationRule {
  id: string;
  name: string;
  triggerEvent: string;
  conditionSummary: string;
  actionType:
    | "AUTO_RECONNECT"
    | "SEND_WHATSAPP_ADVISORY"
    | "CREATE_FIELD_TICKET"
    | "THROTTLE_FUP"
    | "REQUIRE_APPROVAL";
  isEnabled: boolean;
  executionCount: number;
  lastTriggeredAt?: string;
}

export function evaluateAutomationRules(params: {
  eventType: string;
  payload: Record<string, unknown>;
  rules: AutomationRule[];
}): Array<{ ruleId: string; ruleName: string; actionType: AutomationRule["actionType"] }> {
  return params.rules
    .filter((r) => r.isEnabled && r.triggerEvent === params.eventType)
    .map((r) => ({
      ruleId: r.id,
      ruleName: r.name,
      actionType: r.actionType,
    }));
}
