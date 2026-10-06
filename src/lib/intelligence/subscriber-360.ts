// ============================================================================
// QC NETCORE — SUBSCRIBER 360, CONNECTION QUALITY SCORE & CHURN INTELLIGENCE
// Deterministic scoring models for subscriber experience and retention risk.
// ============================================================================

export type QualityTier = "EXCELLENT" | "GOOD" | "DEGRADED" | "POOR";
export type ChurnRiskTier = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export interface ConnectionQualityInput {
  isOnline: boolean;
  latencyMs?: number; // Ideal <= 15ms
  packetLossPercent?: number; // Ideal 0%
  opticalRxDbm?: number; // Ideal -16 to -24 dBm; critical < -27 dBm
  sessionDropCount7d?: number; // Ideal <= 1
  attainedSpeedRatio?: number; // 0.0 to 1.0 (e.g. 0.94 = 94% of plan speed)
}

export interface ConnectionQualityBreakdown {
  score: number; // 0 to 100
  tier: QualityTier;
  latencyScore: number;
  packetLossScore: number;
  opticalScore: number;
  stabilityScore: number;
  summary: string;
  diagnosticFlags: string[];
}

export interface ChurnPredictionInput {
  status: string;
  balanceDue: number;
  planPrice: number;
  daysUntilExpiry: number; // negative if expired
  openSupportTickets: number;
  connectionQualityScore: number;
  latePaymentsLast90d?: number;
}

export interface ChurnPredictionResult {
  riskScore: number; // 0 to 100 (higher = more likely to churn)
  riskTier: ChurnRiskTier;
  primaryDrivers: string[];
  recommendedAction: string;
}

/**
 * Computes a deterministic 0–100 Subscriber Connection Quality Score (QoE).
 */
export function computeConnectionQualityScore(
  input: ConnectionQualityInput
): ConnectionQualityBreakdown {
  const flags: string[] = [];

  if (!input.isOnline) {
    flags.push("Subscriber session is currently offline");
  }

  // 1. Latency component (max 25 pts)
  const latency = input.latencyMs ?? (input.isOnline ? 9 : 85);
  let latencyScore = 25;
  if (latency > 80) {
    latencyScore = 6;
    flags.push(`High RTT latency (${latency} ms)`);
  } else if (latency > 40) {
    latencyScore = 15;
    flags.push(`Elevated latency (${latency} ms)`);
  } else if (latency > 20) {
    latencyScore = 21;
  }

  // 2. Packet Loss component (max 30 pts)
  const loss = input.packetLossPercent ?? 0;
  let packetLossScore = 30;
  if (loss >= 5) {
    packetLossScore = 4;
    flags.push(`Severe packet loss (${loss.toFixed(1)}%)`);
  } else if (loss >= 1.5) {
    packetLossScore = 14;
    flags.push(`Noticeable packet loss (${loss.toFixed(1)}%)`);
  } else if (loss > 0.2) {
    packetLossScore = 24;
  }

  // 3. Optical RX Power component (max 25 pts, ideal -15 to -24 dBm)
  const rxDbm = input.opticalRxDbm ?? -19.4;
  let opticalScore = 25;
  if (rxDbm < -27.5) {
    opticalScore = 5;
    flags.push(`Critical fiber attenuation (${rxDbm.toFixed(1)} dBm < -27 dBm LOS threshold)`);
  } else if (rxDbm < -25.0) {
    opticalScore = 14;
    flags.push(`Marginal ONU optical signal (${rxDbm.toFixed(1)} dBm)`);
  } else if (rxDbm > -8.0) {
    opticalScore = 16;
    flags.push(`Optical overdrive warning (${rxDbm.toFixed(1)} dBm)`);
  }

  // 4. Session stability & speed attainment (max 20 pts)
  const drops = input.sessionDropCount7d ?? 0;
  const speedRatio = input.attainedSpeedRatio ?? 0.96;
  let stabilityScore = 20;
  if (!input.isOnline) {
    stabilityScore -= 10;
  }
  if (drops >= 5) {
    stabilityScore -= 8;
    flags.push(`${drops} PPPoE session flaps in last 7 days`);
  } else if (drops >= 2) {
    stabilityScore -= 3;
  }
  if (speedRatio < 0.75) {
    stabilityScore -= 5;
    flags.push(`Throughput below 75% of provisioned profile`);
  }
  stabilityScore = Math.max(0, stabilityScore);

  const score = Math.max(
    0,
    Math.min(100, Math.round(latencyScore + packetLossScore + opticalScore + stabilityScore))
  );

  let tier: QualityTier = "EXCELLENT";
  if (score < 50) tier = "POOR";
  else if (score < 72) tier = "DEGRADED";
  else if (score < 88) tier = "GOOD";

  const summary =
    flags.length === 0
      ? `Healthy link (${rxDbm.toFixed(1)} dBm, ${latency} ms RTT, 0% packet loss)`
      : flags.join(" · ");

  return {
    score,
    tier,
    latencyScore,
    packetLossScore,
    opticalScore,
    stabilityScore,
    summary,
    diagnosticFlags: flags,
  };
}

/**
 * Predicts subscriber churn risk (0–100) and recommends next-best retention action.
 */
export function predictSubscriberChurnRisk(
  input: ChurnPredictionInput
): ChurnPredictionResult {
  let risk = 8;
  const drivers: string[] = [];

  if (input.status === "SUSPENDED") {
    risk += 35;
    drivers.push("Account currently suspended");
  } else if (input.status === "TERMINATED") {
    risk = 98;
    drivers.push("Account terminated");
  }

  if (input.balanceDue > 0) {
    const ratio = input.planPrice > 0 ? input.balanceDue / input.planPrice : 1;
    risk += Math.min(28, Math.round(ratio * 18));
    drivers.push(`Unpaid balance of KES ${input.balanceDue.toLocaleString()}`);
  }

  if (input.daysUntilExpiry < 0) {
    const overdueDays = Math.abs(input.daysUntilExpiry);
    risk += Math.min(25, Math.round(overdueDays * 3));
    drivers.push(`Subscription expired ${overdueDays} day(s) ago`);
  } else if (input.daysUntilExpiry <= 2) {
    risk += 10;
    drivers.push(`Expires within ${input.daysUntilExpiry} day(s)`);
  }

  if (input.openSupportTickets > 0) {
    risk += Math.min(22, input.openSupportTickets * 11);
    drivers.push(`${input.openSupportTickets} unresolved field/support ticket(s)`);
  }

  if (input.connectionQualityScore < 70) {
    risk += Math.round((70 - input.connectionQualityScore) * 0.6);
    drivers.push(`Degraded connection quality score (${input.connectionQualityScore}/100)`);
  }

  if ((input.latePaymentsLast90d || 0) >= 2) {
    risk += 10;
    drivers.push(`${input.latePaymentsLast90d} late renewals in last 90 days`);
  }

  const riskScore = Math.max(2, Math.min(99, risk));

  let riskTier: ChurnRiskTier = "LOW";
  if (riskScore >= 75) riskTier = "CRITICAL";
  else if (riskScore >= 50) riskTier = "HIGH";
  else if (riskScore >= 28) riskTier = "MODERATE";

  let recommendedAction = "No intervention needed — subscriber is healthy and active.";
  if (riskTier === "CRITICAL") {
    recommendedAction =
      input.openSupportTickets > 0
        ? "Expedite priority field technician dispatch and offer 48-hour goodwill grace extension."
        : "Send personalized WhatsApp M-Pesa STK renewal link or offer 3-day payment arrangement.";
  } else if (riskTier === "HIGH") {
    recommendedAction =
      input.connectionQualityScore < 75
        ? "Run automated ONU optical & PPPoE line diagnostic before renewal window."
        : "Trigger automated 48h expiry reminder with 1-tap M-Pesa STK prompt.";
  } else if (riskTier === "MODERATE") {
    recommendedAction = "Monitor link stability and ensure auto-renewal notice is delivered.";
  }

  return {
    riskScore,
    riskTier,
    primaryDrivers: drivers.length > 0 ? drivers : ["Consistent on-time renewal & clean link"],
    recommendedAction,
  };
}
