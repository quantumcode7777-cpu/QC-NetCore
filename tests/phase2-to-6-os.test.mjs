import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyOpticalPower,
  evaluateFairUsePolicy,
  buildSubscriberControlCommand,
} from "../src/lib/network/olt-cpe.ts";

import {
  validateInstallationSignoff,
  computeInventorySummary,
  evaluateTicketSla,
} from "../src/lib/operations/field-inventory-support.ts";

import {
  correlateOutageBlastRadius,
  checkGisServiceability,
  evaluateAutomationRules,
} from "../src/lib/network/topology-gis-automation.ts";

import {
  runCopilotQuery,
} from "../src/lib/ai/copilot.ts";

test("Phase 2 OLT/ONT & Fair-Use Engine: classifies GPON optical power, evaluates FUP/Night-Turbo, and generates RFC 5176 CoA commands", () => {
  const optGood = classifyOpticalPower(-19.4);
  assert.equal(optGood.status, "OPTIMAL");
  assert.equal(optGood.badgeTone, "success");

  const optLos = classifyOpticalPower(-28.4);
  assert.equal(optLos.status, "CRITICAL_LOW");
  assert.equal(optLos.badgeTone, "danger");

  const fupNormal = evaluateFairUsePolicy({
    baseDownloadKbps: 10240,
    baseUploadKbps: 5120,
    consumedGbThisMonth: 180,
    softCapGb: 500,
    throttledDownloadKbps: 4096,
    throttledUploadKbps: 2048,
    currentHourLocal: 14,
  });
  assert.equal(fupNormal.state, "NORMAL");
  assert.equal(fupNormal.mikrotikRateLimit, "5120k/10240k");

  const fupTurbo = evaluateFairUsePolicy({
    baseDownloadKbps: 10240,
    baseUploadKbps: 5120,
    consumedGbThisMonth: 180,
    softCapGb: 500,
    throttledDownloadKbps: 4096,
    throttledUploadKbps: 2048,
    nightTurboMultiplier: 1.5,
    currentHourLocal: 2,
  });
  assert.equal(fupTurbo.state, "NIGHT_TURBO");
  assert.equal(fupTurbo.effectiveDownloadKbps, 15360);

  const fupThrottled = evaluateFairUsePolicy({
    baseDownloadKbps: 10240,
    baseUploadKbps: 5120,
    consumedGbThisMonth: 520,
    softCapGb: 500,
    throttledDownloadKbps: 4096,
    throttledUploadKbps: 2048,
    currentHourLocal: 2,
  });
  assert.equal(fupThrottled.state, "FUP_THROTTLED");
  assert.equal(fupThrottled.mikrotikRateLimit, "2048k/4096k");

  const coa = buildSubscriberControlCommand({
    action: "DISCONNECT_SESSION",
    username: "gt_john_kamau",
    nasIpAddress: "10.200.1.4",
    framedIpAddress: "10.10.12.45",
  });
  assert.equal(coa.protocol, "RADIUS_RFC5176");
  assert.ok(coa.commandPayload.includes("radclient -x 10.200.1.4:3799 disconnect"));
});

test("Phase 3 Field Proof-of-Installation, Inventory Valuation & SLA Ticket Engine", () => {
  const validSignoff = validateInstallationSignoff({
    workOrderId: "wo-01",
    technicianName: "Brian Kiprop",
    onuSerialNumber: "HWTC8925B1C2",
    measuredRxDbm: -19.8,
    dropCableMeters: 85,
    napBoxCode: "NAP-WST-04",
    napPortNumber: 12,
    gpsCoordinates: "-1.2618, 36.8044",
    customerSignoffName: "Ahmed Hassan Omar",
  });
  assert.equal(validSignoff.valid, true);
  assert.equal(validSignoff.opticalQuality, "OPTIMAL");

  const badOpticalSignoff = validateInstallationSignoff({
    workOrderId: "wo-01",
    technicianName: "Brian Kiprop",
    onuSerialNumber: "HWTC8925B1C2",
    measuredRxDbm: -29.2,
    dropCableMeters: 85,
    napBoxCode: "NAP-WST-04",
    napPortNumber: 12,
    gpsCoordinates: "-1.2618, 36.8044",
    customerSignoffName: "Ahmed Hassan Omar",
  });
  assert.equal(badOpticalSignoff.valid, false);
  assert.equal(badOpticalSignoff.opticalQuality, "REJECTED");

  const invSummary = computeInventorySummary([
    {
      id: "1",
      organizationId: "org-1",
      sku: "ONT-1",
      name: "Huawei Wi-Fi 6 ONT",
      category: "ONU_ONT",
      unitOfMeasure: "UNIT",
      quantityOnHand: 20,
      reorderThreshold: 10,
      unitCostKes: 5000,
      warehouseLocation: "Central Store",
    },
    {
      id: "2",
      organizationId: "org-1",
      sku: "SFP-1",
      name: "GPON SFP C+",
      category: "SFP_OPTICS",
      unitOfMeasure: "UNIT",
      quantityOnHand: 3,
      reorderThreshold: 5,
      unitCostKes: 6000,
      warehouseLocation: "NOC Locker",
    },
  ]);
  assert.equal(invSummary.totalValuationKes, 118000);
  assert.equal(invSummary.lowStockItems.length, 1);

  const slaCheck = evaluateTicketSla({
    id: "tkt-1",
    organizationId: "org-1",
    ticketNumber: "TKT-01",
    customerName: "David Koech",
    channel: "NOC_AUTO",
    category: "LOS_RED_LIGHT",
    priority: "CRITICAL",
    status: "OPEN",
    subject: "LOS Alarm",
    description: "Optical loss",
    slaDueAt: new Date(Date.now() + 2 * 3600000).toISOString(),
    createdAt: new Date().toISOString(),
  });
  assert.equal(slaCheck.isBreached, false);
  assert.ok(slaCheck.remainingMinutes > 0);
});

test("Phase 4 & 5 Topology Outage Blast Radius, GIS Serviceability & Automation Rules", () => {
  const nodes = [
    {
      id: "node-transit",
      nodeCode: "TRANSIT",
      name: "Upstream Transit",
      nodeType: "UPSTREAM_TRANSIT",
      status: "ONLINE",
      subscriberCount: 81,
      latencyMs: 2.4,
      utilizationPercent: 34,
    },
    {
      id: "node-rtr-01",
      nodeCode: "BNG-CBD",
      name: "MikroTik-Core-CCR2004 (Nairobi CBD BNG)",
      nodeType: "CORE_ROUTER",
      parentNodeId: "node-transit",
      status: "ONLINE",
      subscriberCount: 62,
      latencyMs: 3.1,
      utilizationPercent: 28,
    },
    {
      id: "node-olt-01",
      nodeCode: "OLT-CBD",
      name: "Huawei-MA5800-X7-CBD",
      nodeType: "OLT",
      parentNodeId: "node-rtr-01",
      status: "ONLINE",
      subscriberCount: 54,
      latencyMs: 4.2,
      utilizationPercent: 41,
    },
    {
      id: "node-nap-01",
      nodeCode: "NAP-01",
      name: "Kilimani Splitter FAT #1",
      nodeType: "NAP_SPLITTER",
      parentNodeId: "node-olt-01",
      status: "ONLINE",
      subscriberCount: 14,
      latencyMs: 5.1,
      utilizationPercent: 87,
    },
  ];

  const blast = correlateOutageBlastRadius(nodes, "node-rtr-01");
  assert.equal(blast.rootNodeName, "MikroTik-Core-CCR2004 (Nairobi CBD BNG)");
  assert.equal(blast.affectedDownstreamNodes.length, 2);
  assert.equal(blast.estimatedAffectedSubscribers, 62);
  assert.equal(blast.suppressedChildAlertCount, 2);

  const gisNodes = [
    {
      id: "gis-01",
      code: "NAP-KIL-01",
      name: "Kilimani Menelik Road FAT #1",
      nodeKind: "NAP_FAT_BOX",
      latitude: -1.2952,
      longitude: 36.7865,
      totalPorts: 16,
      occupiedPorts: 13,
      feederCableCode: "FDR-KIL-24C-01",
      status: "ACTIVE",
    },
    {
      id: "gis-03",
      code: "NAP-CBD-02",
      name: "Nairobi CBD City House FAT #2",
      nodeKind: "NAP_FAT_BOX",
      latitude: -1.2864,
      longitude: 36.8172,
      totalPorts: 16,
      occupiedPorts: 16,
      feederCableCode: "FDR-CBD-96C-01",
      status: "FULL",
    },
  ];

  const gisOk = checkGisServiceability({
    latitude: -1.2956,
    longitude: 36.7869,
    gisNodes,
  });
  assert.equal(gisOk.serviceable, true);
  assert.equal(gisOk.nearestNode?.code, "NAP-KIL-01");
  assert.equal(gisOk.availablePorts, 3);

  const gisFull = checkGisServiceability({
    latitude: -1.2864,
    longitude: 36.8172,
    gisNodes,
  });
  assert.equal(gisFull.serviceable, false);
  assert.equal(gisFull.nearestNode?.code, "NAP-CBD-02");
  assert.equal(gisFull.availablePorts, 0);

  const triggered = evaluateAutomationRules({
    eventType: "payment.completed",
    payload: { amount: 2500 },
    rules: [
      {
        id: "rule-01",
        name: "Auto Reconnect on Payment",
        triggerEvent: "payment.completed",
        conditionSummary: "matchStatus == MATCHED",
        actionType: "AUTO_RECONNECT",
        isEnabled: true,
        executionCount: 10,
      },
    ],
  });
  assert.equal(triggered.length, 1);
  assert.equal(triggered[0].actionType, "AUTO_RECONNECT");
});

test("Phase 6 Grounded AI ISP Operations Copilot: returns accurate subscriber diagnostics, revenue metrics, and confirmation-gated actions", () => {
  const snapshot = {
    organizationName: "QC NetCore",
    subscribers: [
      {
        id: "cust-03",
        accountNumber: "GT-8923",
        fullName: "David Kipchumba Koech",
        status: "SUSPENDED",
        balanceDue: 2500,
        planName: "Silver Fiber - 10 Mbps",
        siteName: "Nairobi CBD",
        isOnline: false,
        rxPowerDbm: -28.4,
        qualityScore: 42,
        churnRiskScore: 86,
        churnRiskTier: "CRITICAL",
      },
    ],
    financials: {
      mrr: 18500,
      arr: 222000,
      arpu: 2642.85,
      collectedThisPeriod: 16500,
      collectionRatePercent: 89.2,
      totalArOutstanding: 6500,
      trialBalanceBalanced: true,
      pendingApprovalsCount: 1,
      unmatchedPaymentsCount: 1,
    },
    network: {
      totalRouters: 3,
      onlineRouters: 3,
      totalOlts: 2,
      losOntCount: 1,
      openAlertsCount: 1,
    },
  };

  const subDiag = runCopilotQuery("Why is David Koech (GT-8923) offline?", snapshot);
  assert.equal(subDiag.intent, "SUBSCRIBER_DIAGNOSTIC");
  assert.ok(subDiag.answerMarkdown.includes("GT-8923"));
  assert.ok(subDiag.answerMarkdown.includes("-28.4 dBm"));
  assert.ok(subDiag.proposedActions.length >= 1);
  assert.equal(subDiag.proposedActions[0].requiresConfirmation, true);

  const finSummary = runCopilotQuery("Summarize today's MRR, ARPU, and Trial Balance", snapshot);
  assert.equal(finSummary.intent, "REVENUE_AND_LEDGER_SUMMARY");
  assert.ok(finSummary.answerMarkdown.includes("BALANCED"));

  const churnAudit = runCopilotQuery("Which subscribers have high churn risk or optical attenuation?", snapshot);
  assert.equal(churnAudit.intent, "CHURN_AND_OPTICAL_AUDIT");
  assert.ok(churnAudit.answerMarkdown.includes("David Kipchumba Koech"));
});
