import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateIpv4Subnet,
  calculateIspBandwidth,
  ipv4ToUint32,
  uint32ToIpv4,
  subnetMaskToCidr,
} from "../src/lib/network/free-tools.ts";

test("IPv4 Subnet Calculator — standard /24 network, host range, and /26 block split", () => {
  const res = calculateIpv4Subnet("192.168.10.45", 24, 26);
  assert.equal(res.valid, true);
  if (!res.valid) return;

  assert.equal(res.networkAddress, "192.168.10.0");
  assert.equal(res.broadcastAddress, "192.168.10.255");
  assert.equal(res.subnetMask, "255.255.255.0");
  assert.equal(res.wildcardMask, "0.0.0.255");
  assert.equal(res.cidrNotation, "192.168.10.0/24");
  assert.equal(res.firstUsableHost, "192.168.10.1");
  assert.equal(res.lastUsableHost, "192.168.10.254");
  assert.equal(res.usableHosts, 254);
  assert.equal(res.totalAddresses, 256);
  assert.equal(res.subnetCount, 4);
  assert.equal(res.childSubnets.length, 4);
  assert.equal(res.childSubnets[0].network, "192.168.10.0");
  assert.equal(res.childSubnets[0].usableHosts, 62);
  assert.equal(res.childSubnets[3].network, "192.168.10.192");
  assert.equal(res.childSubnets[3].broadcast, "192.168.10.255");
});

test("IPv4 Subnet Calculator — CGNAT 100.64.0.0/20 and RFC 3021 /31 & /32 edge cases", () => {
  const cgnat = calculateIpv4Subnet("100.64.5.10/20", 24, 22);
  assert.equal(cgnat.valid, true);
  if (cgnat.valid) {
    assert.equal(cgnat.networkAddress, "100.64.0.0");
    assert.equal(cgnat.broadcastAddress, "100.64.15.255");
    assert.equal(cgnat.usableHosts, 4094);
    assert.equal(cgnat.addressScope, "Carrier-Grade NAT / CGNAT (RFC 6598)");
    assert.equal(cgnat.subnetCount, 4);
  }

  const p2p = calculateIpv4Subnet("172.16.0.10", "255.255.255.254");
  assert.equal(p2p.valid, true);
  if (p2p.valid) {
    assert.equal(p2p.cidr, 31);
    assert.equal(p2p.usableHosts, 2);
    assert.equal(p2p.firstUsableHost, "172.16.0.10");
    assert.equal(p2p.lastUsableHost, "172.16.0.11");
  }

  const singleHost = calculateIpv4Subnet("10.0.0.99", 32);
  assert.equal(singleHost.valid, true);
  if (singleHost.valid) {
    assert.equal(singleHost.usableHosts, 1);
    assert.equal(singleHost.firstUsableHost, "10.0.0.99");
    assert.equal(singleHost.lastUsableHost, "10.0.0.99");
  }
});

test("IPv4 Subnet Calculator — rejects invalid IPv4 octets, non-contiguous masks, and bad prefixes", () => {
  assert.equal(calculateIpv4Subnet("999.168.1.1", 24).valid, false);
  assert.equal(calculateIpv4Subnet("192.168.1", 24).valid, false);
  assert.equal(calculateIpv4Subnet("192.168.01.1", 24).valid, false);
  assert.equal(calculateIpv4Subnet("192.168.1.1/35", 24).valid, false);
  assert.equal(calculateIpv4Subnet("192.168.1.1", "255.255.129.0").valid, false);
  assert.equal(subnetMaskToCidr("255.255.252.0"), 22);
  assert.equal(uint32ToIpv4(ipv4ToUint32("203.0.113.195") ?? 0), "203.0.113.195");
});

test("ISP Bandwidth Calculator — estimates concurrent users, sustained, peak, and recommended upstream", () => {
  const res = calculateIspBandwidth({
    totalSubscribers: 500,
    concurrencyPercent: 35,
    planSpeedMbps: 10,
    contentionRatio: 8,
    headroomPercent: 25,
  });

  assert.equal(res.valid, true);
  if (!res.valid) return;

  assert.equal(res.activeConcurrentUsers, 175);
  assert.equal(res.sustainedDemandMbps, 219); // ceil(175 * 10 / 8 = 218.75)
  assert.ok(res.peakBurstDemandMbps >= res.sustainedDemandMbps);
  assert.ok(res.recommendedUpstreamMbps > res.peakBurstDemandMbps);

  // Rejects invalid negative or out-of-range inputs
  assert.equal(
    calculateIspBandwidth({
      totalSubscribers: 0,
      concurrencyPercent: 35,
      planSpeedMbps: 10,
      contentionRatio: 8,
      headroomPercent: 25,
    }).valid,
    false
  );
  assert.equal(
    calculateIspBandwidth({
      totalSubscribers: 500,
      concurrencyPercent: 150,
      planSpeedMbps: 10,
      contentionRatio: 8,
      headroomPercent: 25,
    }).valid,
    false
  );
});
