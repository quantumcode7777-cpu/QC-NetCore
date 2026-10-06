// ============================================================================
// QC NETCORE — ISP FREE TOOLS ENGINE
// Pure, deterministic networking & capacity planning utilities for:
// 1. IPv4 Subnet & Block Splitting Calculator
// 2. ISP Upstream Bandwidth & Capacity Calculator
// ============================================================================

export interface SubnetCalculationResult {
  valid: true;
  inputIp: string;
  cidr: number;
  networkAddress: string;
  broadcastAddress: string;
  subnetMask: string;
  wildcardMask: string;
  cidrNotation: string;
  firstUsableHost: string;
  lastUsableHost: string;
  usableHosts: number;
  totalAddresses: number;
  addressScope: string;
  binarySubnetMask: string;
  splitPrefix: number;
  subnetCount: number;
  childSubnets: Array<{
    network: string;
    cidr: number;
    firstHost: string;
    lastHost: string;
    broadcast: string;
    usableHosts: number;
  }>;
}

export interface SubnetCalculationError {
  valid: false;
  error: string;
}

export type SubnetResult = SubnetCalculationResult | SubnetCalculationError;

/**
 * Converts a dotted-quad IPv4 string into an unsigned 32-bit integer.
 * Returns null if the IPv4 address is malformed or out of range.
 */
export function ipv4ToUint32(ip: string): number | null {
  const trimmed = ip.trim();
  const parts = trimmed.split(".");
  if (parts.length !== 4) return null;

  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    if (part.length > 1 && part.startsWith("0")) return null;
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    result = ((result << 8) | octet) >>> 0;
  }
  return result >>> 0;
}

/**
 * Converts an unsigned 32-bit integer into a dotted-quad IPv4 string.
 */
export function uint32ToIpv4(num: number): string {
  const u = num >>> 0;
  return [
    (u >>> 24) & 0xff,
    (u >>> 16) & 0xff,
    (u >>> 8) & 0xff,
    u & 0xff,
  ].join(".");
}

/**
 * Converts a CIDR prefix length (0..32) into an unsigned 32-bit netmask.
 */
export function cidrToMaskUint32(cidr: number): number {
  if (cidr <= 0) return 0;
  if (cidr >= 32) return 0xffffffff >>> 0;
  return (0xffffffff << (32 - cidr)) >>> 0;
}

/**
 * Converts a dotted-quad subnet mask into its CIDR prefix length (0..32),
 * or returns null if the mask is not a valid contiguous IPv4 subnet mask.
 */
export function subnetMaskToCidr(mask: string): number | null {
  const maskUint = ipv4ToUint32(mask);
  if (maskUint === null) return null;
  if (maskUint === 0) return 0;

  let seenZero = false;
  let count = 0;
  for (let i = 31; i >= 0; i--) {
    const bit = (maskUint >>> i) & 1;
    if (bit === 1) {
      if (seenZero) return null; // Non-contiguous mask bits
      count++;
    } else {
      seenZero = true;
    }
  }
  return count;
}

/**
 * Classifies an IPv4 address into its operational ISP scope (RFC 1918, CGNAT, etc.).
 */
export function classifyIpv4Scope(ipUint: number): string {
  const first = (ipUint >>> 24) & 0xff;
  const second = (ipUint >>> 16) & 0xff;

  if (first === 10) return "Private Network (RFC 1918 — Class A)";
  if (first === 172 && second >= 16 && second <= 31) {
    return "Private Network (RFC 1918 — Class B)";
  }
  if (first === 192 && second === 168) {
    return "Private Network (RFC 1918 — Class C)";
  }
  if (first === 100 && second >= 64 && second <= 127) {
    return "Carrier-Grade NAT / CGNAT (RFC 6598)";
  }
  if (first === 127) return "Loopback (RFC 1122)";
  if (first === 169 && second === 254) return "Link-Local / APIPA (RFC 3927)";
  if (first >= 224 && first <= 239) return "Multicast (RFC 5771)";
  if (first >= 240) return "Reserved / Experimental";
  return "Public Routable Unicast IPv4";
}

/**
 * Calculates full IPv4 subnet parameters and optional child block splits.
 */
export function calculateIpv4Subnet(
  rawIpInput: string,
  cidrInput: number | string,
  targetSplitPrefix?: number
): SubnetResult {
  const raw = rawIpInput.trim();
  if (!raw) {
    return { valid: false, error: "Please enter an IPv4 address (e.g. 192.168.1.0)." };
  }

  let ipPart = raw;
  let resolvedCidr: number | null = null;

  // Support inline CIDR notation such as "10.20.30.0/24"
  if (raw.includes("/")) {
    const segments = raw.split("/");
    if (segments.length !== 2 || !segments[0] || !segments[1]) {
      return { valid: false, error: "Invalid CIDR format. Use IP/prefix (e.g. 192.168.1.0/24)." };
    }
    ipPart = segments[0].trim();
    const inlinePrefix = Number(segments[1].trim());
    if (!Number.isInteger(inlinePrefix) || inlinePrefix < 1 || inlinePrefix > 32) {
      return { valid: false, error: "CIDR prefix must be an integer between /1 and /32." };
    }
    resolvedCidr = inlinePrefix;
  } else if (typeof cidrInput === "string" && cidrInput.includes(".")) {
    resolvedCidr = subnetMaskToCidr(cidrInput);
    if (resolvedCidr === null || resolvedCidr < 1) {
      return {
        valid: false,
        error: "Invalid IPv4 subnet mask. Must be a contiguous mask between 128.0.0.0 and 255.255.255.255.",
      };
    }
  } else {
    const parsedCidr = Number(String(cidrInput).replace(/^\//, "").trim());
    if (!Number.isInteger(parsedCidr) || parsedCidr < 1 || parsedCidr > 32) {
      return { valid: false, error: "CIDR prefix must be between /1 and /32." };
    }
    resolvedCidr = parsedCidr;
  }

  const ipUint = ipv4ToUint32(ipPart);
  if (ipUint === null) {
    return {
      valid: false,
      error: "Invalid IPv4 address. Enter four octets between 0 and 255 (e.g. 192.168.10.1).",
    };
  }

  const maskUint = cidrToMaskUint32(resolvedCidr);
  const wildcardUint = (~maskUint) >>> 0;
  const networkUint = (ipUint & maskUint) >>> 0;
  const broadcastUint = (networkUint | wildcardUint) >>> 0;

  const hostBits = 32 - resolvedCidr;
  const totalAddresses = Math.pow(2, hostBits);

  let usableHosts: number;
  let firstHostUint: number;
  let lastHostUint: number;

  if (resolvedCidr === 32) {
    usableHosts = 1;
    firstHostUint = networkUint;
    lastHostUint = networkUint;
  } else if (resolvedCidr === 31) {
    // RFC 3021 point-to-point link
    usableHosts = 2;
    firstHostUint = networkUint;
    lastHostUint = broadcastUint;
  } else {
    usableHosts = Math.max(0, totalAddresses - 2);
    firstHostUint = (networkUint + 1) >>> 0;
    lastHostUint = (broadcastUint - 1) >>> 0;
  }

  const binarySubnetMask = [
    ((maskUint >>> 24) & 0xff).toString(2).padStart(8, "0"),
    ((maskUint >>> 16) & 0xff).toString(2).padStart(8, "0"),
    ((maskUint >>> 8) & 0xff).toString(2).padStart(8, "0"),
    (maskUint & 0xff).toString(2).padStart(8, "0"),
  ].join(".");

  const splitPrefix =
    targetSplitPrefix !== undefined &&
    Number.isInteger(targetSplitPrefix) &&
    targetSplitPrefix >= resolvedCidr &&
    targetSplitPrefix <= 32
      ? targetSplitPrefix
      : resolvedCidr;

  const subnetCount = Math.pow(2, splitPrefix - resolvedCidr);
  const childSubnets: SubnetCalculationResult["childSubnets"] = [];
  const maxPreviewSubnets = Math.min(subnetCount, 8);
  const childBlockSize = Math.pow(2, 32 - splitPrefix);

  for (let i = 0; i < maxPreviewSubnets; i++) {
    const childNet = (networkUint + i * childBlockSize) >>> 0;
    const childBcast = (childNet + childBlockSize - 1) >>> 0;
    const childFirst =
      splitPrefix >= 31 ? childNet : ((childNet + 1) >>> 0);
    const childLast =
      splitPrefix >= 31 ? childBcast : ((childBcast - 1) >>> 0);
    const childUsable =
      splitPrefix === 32 ? 1 : splitPrefix === 31 ? 2 : Math.max(0, childBlockSize - 2);

    childSubnets.push({
      network: uint32ToIpv4(childNet),
      cidr: splitPrefix,
      firstHost: uint32ToIpv4(childFirst),
      lastHost: uint32ToIpv4(childLast),
      broadcast: uint32ToIpv4(childBcast),
      usableHosts: childUsable,
    });
  }

  return {
    valid: true,
    inputIp: uint32ToIpv4(ipUint),
    cidr: resolvedCidr,
    networkAddress: uint32ToIpv4(networkUint),
    broadcastAddress: uint32ToIpv4(broadcastUint),
    subnetMask: uint32ToIpv4(maskUint),
    wildcardMask: uint32ToIpv4(wildcardUint),
    cidrNotation: `${uint32ToIpv4(networkUint)}/${resolvedCidr}`,
    firstUsableHost: uint32ToIpv4(firstHostUint),
    lastUsableHost: uint32ToIpv4(lastHostUint),
    usableHosts,
    totalAddresses,
    addressScope: classifyIpv4Scope(networkUint),
    binarySubnetMask,
    splitPrefix,
    subnetCount,
    childSubnets,
  };
}

// ============================================================================
// BANDWIDTH CALCULATOR
// ============================================================================

export interface BandwidthCalculatorInput {
  totalSubscribers: number;
  concurrencyPercent: number;
  planSpeedMbps: number;
  contentionRatio: number;
  headroomPercent: number;
}

export interface BandwidthCalculationResult {
  valid: true;
  activeConcurrentUsers: number;
  averagePerActiveUserMbps: number;
  sustainedDemandMbps: number;
  peakBurstDemandMbps: number;
  headroomMbps: number;
  recommendedUpstreamMbps: number;
  recommendedUpstreamGbps: number;
  suggestedPortTier: string;
}

export interface BandwidthCalculationError {
  valid: false;
  error: string;
}

export type BandwidthResult = BandwidthCalculationResult | BandwidthCalculationError;

/**
 * Estimates ISP upstream capacity based on subscriber count, peak concurrency,
 * package speed, contention ratio, and operational headroom.
 */
export function calculateIspBandwidth(
  input: BandwidthCalculatorInput
): BandwidthResult {
  const {
    totalSubscribers,
    concurrencyPercent,
    planSpeedMbps,
    contentionRatio,
    headroomPercent,
  } = input;

  if (!Number.isFinite(totalSubscribers) || totalSubscribers < 1 || totalSubscribers > 1_000_000) {
    return {
      valid: false,
      error: "Total subscribers must be between 1 and 1,000,000.",
    };
  }

  if (!Number.isFinite(concurrencyPercent) || concurrencyPercent < 1 || concurrencyPercent > 100) {
    return {
      valid: false,
      error: "Peak concurrent users percentage must be between 1% and 100%.",
    };
  }

  if (!Number.isFinite(planSpeedMbps) || planSpeedMbps <= 0 || planSpeedMbps > 10_000) {
    return {
      valid: false,
      error: "Average package speed must be between 0.5 Mbps and 10,000 Mbps.",
    };
  }

  if (!Number.isFinite(contentionRatio) || contentionRatio < 1 || contentionRatio > 100) {
    return {
      valid: false,
      error: "Contention ratio must be between 1:1 and 1:100.",
    };
  }

  if (!Number.isFinite(headroomPercent) || headroomPercent < 0 || headroomPercent > 200) {
    return {
      valid: false,
      error: "Safety headroom percentage must be between 0% and 200%.",
    };
  }

  const activeConcurrentUsers = Math.max(
    1,
    Math.ceil(totalSubscribers * (concurrencyPercent / 100))
  );

  // Effective average throughput per active user given contention ratio
  const averagePerActiveUserMbps = Number((planSpeedMbps / contentionRatio).toFixed(2));

  // Sustained baseline demand during peak window
  const sustainedRaw = (activeConcurrentUsers * planSpeedMbps) / contentionRatio;
  // Add statistical burst factor (15% traffic microburst allowance + at least 1 full user plan burst)
  const peakBurstRaw = Math.max(sustainedRaw * 1.15, sustainedRaw + planSpeedMbps);
  const headroomRaw = peakBurstRaw * (headroomPercent / 100);
  const recommendedRaw = peakBurstRaw + headroomRaw;

  const sustainedDemandMbps = Math.ceil(sustainedRaw);
  const peakBurstDemandMbps = Math.ceil(peakBurstRaw);
  const headroomMbps = Math.ceil(headroomRaw);
  const recommendedUpstreamMbps = Math.ceil(recommendedRaw);
  const recommendedUpstreamGbps = Number((recommendedUpstreamMbps / 1000).toFixed(2));

  let suggestedPortTier = "100 Mbps FastE / 1G SFP (Fractional Commit)";
  if (recommendedUpstreamMbps > 10000) {
    suggestedPortTier = "40G / 100G QSFP28 Core Uplink";
  } else if (recommendedUpstreamMbps > 1000) {
    suggestedPortTier = "10G SFP+ Fiber Uplink";
  } else if (recommendedUpstreamMbps > 200) {
    suggestedPortTier = "1 Gbps SFP / RJ45 Dedicated Uplink";
  }

  return {
    valid: true,
    activeConcurrentUsers,
    averagePerActiveUserMbps,
    sustainedDemandMbps,
    peakBurstDemandMbps,
    headroomMbps,
    recommendedUpstreamMbps,
    recommendedUpstreamGbps,
    suggestedPortTier,
  };
}
