import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNetworkMap,
  formatCoordinates,
  summarizeSites,
  validateSiteInput,
} from "../src/lib/sites.ts";

const sites = [
  {
    id: "site-01",
    name: "CBD POP",
    latitude: -1.286389,
    longitude: 36.817223,
    powerBackupType: "GENERATOR",
    isActive: true,
  },
  { id: "site-02", name: "Westlands", latitude: -1.2618, longitude: 36.8044, isActive: false },
];

const routers = [
  { id: "rtr-01", siteId: "site-01", name: "Core", status: "ONLINE" },
  { id: "rtr-02", siteId: "site-01", name: "Backup", status: "OFFLINE" },
  { id: "rtr-03", siteId: "site-02", name: "West", status: "ONLINE" },
];

const customers = [
  { id: "c1", siteId: "site-01", status: "ACTIVE" },
  { id: "c2", siteId: "site-01", status: "GRACE" },
  { id: "c3", siteId: "site-01", status: "SUSPENDED" },
  { id: "c4", siteId: "site-02", status: "ACTIVE" },
];

const accessPoints = [
  { id: "ap-01", siteId: "site-01", routerId: "rtr-01", name: "AP East", status: "ONLINE" },
  { id: "ap-02", siteId: "site-02", routerId: null, name: "AP West", status: "DEGRADED" },
];

test("sites — summaries count only rows belonging to each site", () => {
  const rows = summarizeSites(sites, routers, customers, accessPoints);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].routerCount, 2);
  assert.equal(rows[0].onlineRouters, 1);
  assert.equal(rows[0].customerCount, 3);
  assert.equal(rows[0].activeCustomers, 2);
  assert.equal(rows[0].accessPointCount, 1);
  assert.equal(rows[1].routerCount, 1);
  assert.equal(rows[1].isActive, false);
});

test("sites — validation rejects bad coordinates and power types", () => {
  const ok = validateSiteInput({
    name: "  Kilimani POP  ",
    locationDescription: "  Yaya Tower  ",
    latitude: "-1.2952",
    longitude: "36.7865",
    powerBackupType: "SOLAR",
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.value.name, "Kilimani POP");
    assert.equal(ok.value.locationDescription, "Yaya Tower");
    assert.equal(ok.value.latitude, -1.2952);
    assert.equal(ok.value.powerBackupType, "SOLAR");
  }

  assert.equal(validateSiteInput({ name: "Bad lat", latitude: 91 }).ok, false);
  assert.equal(validateSiteInput({ name: "Bad lng", longitude: -181 }).ok, false);
  assert.equal(validateSiteInput({ name: "Bad power", powerBackupType: "NUCLEAR" }).ok, false);
  assert.equal(validateSiteInput({ name: "" }).ok, false);
  assert.equal(validateSiteInput({}, true).ok, true);
});

test("network map — geographic nodes share one projection", () => {
  const map = buildNetworkMap({
    sites,
    routers,
    accessPoints,
    topologyNodes: [],
    gisNodes: [
      {
        id: "gis-01",
        code: "NAP-KIL-04",
        name: "Yaya NAP",
        nodeKind: "NAP_FAT_BOX",
        siteId: "site-02",
        latitude: -1.2952,
        longitude: 36.7865,
      },
    ],
  });

  assert.equal(map.schematic, false);
  assert.equal(map.nodes.length, 8);
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  assert.equal(byId.get("site:site-01").x > byId.get("site:site-02").x, true);
  assert.equal(byId.get("gis:gis-01").y > byId.get("site:site-01").y, true);
  assert.equal(
    map.links.some((l) => l.from === "site:site-01" && l.to === "router:rtr-01" && l.kind === "site-router"),
    true
  );
  assert.equal(
    map.links.some((l) => l.from === "router:rtr-01" && l.to === "access-point:ap-01"),
    true
  );
});

test("network map — topology without coordinates is labelled schematic", () => {
  const map = buildNetworkMap({
    sites: sites.map((s) => ({ ...s, latitude: null, longitude: null })),
    routers: [],
    accessPoints: [],
    topologyNodes: [
      { id: "t1", nodeCode: "UPSTREAM", name: "Upstream", nodeType: "UPSTREAM_TRANSIT" },
      { id: "t2", nodeCode: "CORE", name: "Core", nodeType: "CORE_ROUTER", parentNodeId: "t1" },
      { id: "t3", nodeCode: "NAP", name: "NAP", nodeType: "NAP_SPLITTER", parentNodeId: "t2" },
    ],
    gisNodes: [],
  });

  assert.equal(map.schematic, true);
  const topo = map.nodes.filter((n) => n.kind === "topology");
  assert.equal(topo.length, 3);
  assert.equal(topo[0].y < topo[1].y, true);
  assert.equal(topo[1].y < topo[2].y, true);
  assert.equal(
    map.links.some((l) => l.from === "topology:t1" && l.to === "topology:t2" && l.kind === "topology"),
    true
  );
});

test("network map — coordinates formatter is honest when unset", () => {
  assert.equal(formatCoordinates(-1.286389, 36.817223), "-1.28639, 36.81722");
  assert.equal(formatCoordinates(null, null), "Coordinates not set");
});
