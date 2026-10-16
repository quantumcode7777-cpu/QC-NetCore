import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateIspStats,
  normalizeOrgSlug,
  validateCreateOrg,
  validateUpdateOrg,
} from "../src/lib/admin/isps.ts";

test("isps — slug normalization (url-safe, lowercase, dashed)", () => {
  assert.equal(normalizeOrgSlug("Dagi Net Ltd"), "dagi-net-ltd");
  assert.equal(normalizeOrgSlug("  G_Tech!! 2026 "), "g-tech-2026");
  assert.equal(normalizeOrgSlug("a"), "a");
  assert.equal(normalizeOrgSlug("---"), "");
  assert.equal(normalizeOrgSlug(undefined), "");
});

test("isps — create validation (name/email/phone required, slug derived)", () => {
  const good = validateCreateOrg({
    name: "Rift ISP",
    email: "ops@riftisp.co.ke",
    phone: "+254700000001",
  });
  assert.equal(good.ok, true);
  assert.deepEqual(good.value, {
    name: "Rift ISP",
    slug: "rift-isp",
    email: "ops@riftisp.co.ke",
    phone: "+254700000001",
    currency: "KES",
  });

  const explicit = validateCreateOrg({
    name: "Rift ISP",
    slug: "RIFT_01",
    email: "ops@riftisp.co.ke",
    phone: "+254700000001",
    currency: "usd",
  });
  assert.equal(explicit.ok, true);
  assert.equal(explicit.value.slug, "rift-01");
  assert.equal(explicit.value.currency, "USD");

  for (const [input, code] of [
    [{ name: " ", email: "a@b.co", phone: "1" }, "NAME_REQUIRED"],
    [{ name: "X", email: "a@b.co", phone: "1" }, "BAD_SLUG"],
    [{ name: "Rift", email: "not-an-email", phone: "1" }, "BAD_EMAIL"],
    [{ name: "Rift", email: "a@b.co", phone: " " }, "PHONE_REQUIRED"],
  ]) {
    const bad = validateCreateOrg(input);
    assert.equal(bad.ok, false);
    assert.equal(bad.code, code);
  }
});

test("isps — update validation (partial patch, typed fields)", () => {
  const patch = validateUpdateOrg({ phone: " +254711111111 ", is_active: false });
  assert.equal(patch.ok, true);
  assert.deepEqual(patch.value, { phone: "+254711111111", is_active: false });
  assert.equal(patch.empty, false);

  const empty = validateUpdateOrg({});
  assert.equal(empty.ok, true);
  assert.equal(empty.empty, true);

  const bad = validateUpdateOrg({ is_active: "yes" });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, "BAD_STATUS");
});

test("isps — stats aggregation rolls rows into per-org blocks", () => {
  const stats = aggregateIspStats({
    routers: [{ organization_id: "a" }, { organization_id: "a" }, { organization_id: "b" }],
    customers: [{ organization_id: "a" }],
    plans: [
      { organization_id: "a", service_type: "HOTSPOT" },
      { organization_id: "a", service_type: "PPPOE" },
    ],
    vouchers: [
      { organization_id: "a", status: "AVAILABLE" },
      { organization_id: "a", status: "USED" },
      { organization_id: "a", status: "EXPIRED" },
    ],
    profiles: [{ organization_id: "a" }, { organization_id: "a" }],
    payments: [
      { organization_id: "a", amount: 100, status: "COMPLETED" },
      { organization_id: "a", amount: 50, status: "PENDING" },
      { organization_id: "b", amount: 25, status: "COMPLETED" },
    ],
    portalConfigs: [
      { organization_id: "a", status: "ARCHIVED" },
      { organization_id: "a", status: "PUBLISHED" },
    ],
  });
  assert.deepEqual(stats.a, {
    routers: 2,
    customers: 1,
    users: 2,
    hotspotPlans: 1,
    pppoePlans: 1,
    vouchersAvailable: 1,
    vouchersUsed: 1,
    revenueCompleted: 100,
    portalPublished: true,
  });
  assert.equal(stats.b.routers, 1);
  assert.equal(stats.b.revenueCompleted, 25);
  assert.equal(stats.b.portalPublished, false);
});
