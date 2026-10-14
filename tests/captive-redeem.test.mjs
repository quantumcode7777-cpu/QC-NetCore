import test from "node:test";
import assert from "node:assert/strict";
import {
  buildActivationUpdate,
  decideRedeem,
  isSafeLinkLoginUrl,
  normalizeVoucherCode,
} from "../src/lib/captive/redeem.ts";

const NOW = Date.parse("2026-10-14T12:00:00Z");
const FUTURE = new Date(NOW + 86400000).toISOString();
const PAST = new Date(NOW - 1000).toISOString();

const plan = (over = {}) => ({
  id: "plan-1",
  name: "Daily Unlimited",
  service_type: "HOTSPOT",
  validity_duration_seconds: 86400,
  is_active: true,
  ...over,
});

const voucher = (over = {}) => ({
  id: "vch-1",
  organization_id: "org-1",
  plan_id: "plan-1",
  code: "GT-8924-XYZ",
  status: "AVAILABLE",
  first_activated_at: null,
  expires_at: null,
  ...over,
});

test("redeem — code normalization (uppercase, whitespace-tolerant, dashes kept)", () => {
  assert.equal(normalizeVoucherCode("  gt-8924-xyz "), "GT-8924-XYZ");
  assert.equal(normalizeVoucherCode("gt 8924 xyz"), "GT8924XYZ");
  assert.equal(normalizeVoucherCode(""), "");
  assert.equal(normalizeVoucherCode(undefined), "");
  assert.equal(normalizeVoucherCode(42), "");
});

test("redeem — unknown / disabled / expired vouchers rejected", () => {
  assert.deepEqual(decideRedeem(null, plan(), NOW).ok, false);
  assert.equal(decideRedeem(null, plan(), NOW).code, "VOUCHER_NOT_FOUND");
  assert.equal(
    decideRedeem(voucher({ status: "DISABLED" }), plan(), NOW).code,
    "VOUCHER_DISABLED"
  );
  assert.equal(
    decideRedeem(voucher({ status: "EXPIRED" }), plan(), NOW).code,
    "VOUCHER_EXPIRED"
  );
  assert.equal(
    decideRedeem(voucher({ status: "WEIRD" }), plan(), NOW).code,
    "VOUCHER_STATE_UNKNOWN"
  );
});

test("redeem — first activation needs a live HOTSPOT plan", () => {
  const d = decideRedeem(voucher(), plan(), NOW);
  assert.equal(d.ok, true);
  assert.equal(d.firstActivation, true);
  assert.equal(d.validityDurationSeconds, 86400);

  assert.equal(
    decideRedeem(voucher(), plan({ is_active: false }), NOW).code,
    "VOUCHER_PLAN_INACTIVE"
  );
  assert.equal(
    decideRedeem(voucher(), plan({ service_type: "PPPOE" }), NOW).code,
    "VOUCHER_PLAN_INACTIVE"
  );
  assert.equal(
    decideRedeem(voucher(), null, NOW).code,
    "VOUCHER_PLAN_INACTIVE"
  );
});

test("redeem — USED re-issues inside the window, expires past it", () => {
  const reissue = decideRedeem(
    voucher({ status: "USED", first_activated_at: FUTURE, expires_at: FUTURE }),
    plan(),
    NOW
  );
  assert.equal(reissue.ok, true);
  assert.equal(reissue.firstActivation, false);

  // Legacy USED rows with no expiry recorded still authenticate (matches 022).
  const legacy = decideRedeem(
    voucher({ status: "USED", expires_at: null }),
    plan(),
    NOW
  );
  assert.equal(legacy.ok, true);
  assert.equal(legacy.firstActivation, false);

  const lapsed = decideRedeem(
    voucher({ status: "USED", expires_at: PAST }),
    plan(),
    NOW
  );
  assert.equal(lapsed.ok, false);
  assert.equal(lapsed.code, "VOUCHER_EXPIRED");
  assert.equal(lapsed.markExpired, true);
});

test("redeem — activation stamps the paid window from plan validity", () => {
  const u = buildActivationUpdate(86400, NOW, {
    mac: "  AA:BB:CC:DD:EE:FF  ",
    phone: "+254712345678",
  });
  assert.equal(u.status, "USED");
  assert.equal(u.first_activated_at, new Date(NOW).toISOString());
  assert.equal(u.expires_at, new Date(NOW + 86400000).toISOString());
  assert.equal(u.used_mac_address, "AA:BB:CC:DD:EE:FF");
  assert.equal(u.used_by_phone, "+254712345678");

  const bare = buildActivationUpdate(3600, NOW);
  assert.equal(bare.expires_at, new Date(NOW + 3600000).toISOString());
  assert.ok(!("used_mac_address" in bare));
  assert.ok(!("used_by_phone" in bare));
});

test("redeem — bounce-back target must be a plain http(s) URL", () => {
  assert.equal(isSafeLinkLoginUrl("http://10.20.0.1/login"), true);
  assert.equal(isSafeLinkLoginUrl("http://wifi.login.local/login"), true);
  assert.equal(
    isSafeLinkLoginUrl("http://10.20.0.1/login?dst=x"),
    true
  );
  assert.equal(isSafeLinkLoginUrl("https://billing.quantumcode.co.ke/x"), true);
  assert.equal(isSafeLinkLoginUrl("javascript:alert(1)"), false);
  assert.equal(isSafeLinkLoginUrl("//evil.com/login"), false);
  assert.equal(isSafeLinkLoginUrl("http://10.20.0.1/log in"), false);
  assert.equal(isSafeLinkLoginUrl(""), false);
  assert.equal(isSafeLinkLoginUrl(undefined), false);
  assert.equal(isSafeLinkLoginUrl("x".repeat(501).replace(/^x/, "http://")), false);
});
