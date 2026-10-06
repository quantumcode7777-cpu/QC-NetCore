import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_METHOD_REGISTRY,
  DEFAULT_DEMO_HOTSPOT_PLANS,
  PORTAL_TEMPLATES,
  applyTemplate,
  buildAssetPrefix,
  cleanText,
  contrastRatio,
  detectImageType,
  ensureContrast,
  getDefaultDemoPortalConfig,
  getDefaultPortalConfig,
  getPortalWarnings,
  isOrgAssetUrl,
  isSafeHttpsUrl,
  presentPackages,
  resolvePalette,
  resolveTenantKey,
  sanitizePortalConfig,
} from "../src/lib/captive/config.ts";

const SUPA = "https://abc.supabase.co";
const ORG_A = "11111111-1111-1111-1111-111111111111";
const ORG_B = "22222222-2222-2222-2222-222222222222";
const prefixA = buildAssetPrefix(SUPA, ORG_A);
const prefixB = buildAssetPrefix(SUPA, ORG_B);
const optsFor = (prefix, plans = []) => ({
  isAllowedAssetUrl: (u) => isOrgAssetUrl(u, prefix),
  validPlanIds: new Set(plans),
});

test("Portal config — defaults are valid and templates produce valid configs", () => {
  const res = sanitizePortalConfig(getDefaultPortalConfig("Acme ISP"), optsFor(prefixA));
  assert.deepEqual(res.errors, {});
  assert.equal(PORTAL_TEMPLATES.length, 7);
  for (const t of PORTAL_TEMPLATES) {
    const cfg = applyTemplate(getDefaultPortalConfig("Acme ISP"), t.id);
    const r = sanitizePortalConfig(cfg, optsFor(prefixA));
    assert.deepEqual(r.errors, {}, `template ${t.id}`);
    assert.equal(r.config.template, t.id);
  }
});

test("Portal config — applying a template keeps business identity and customised copy", () => {
  const base = getDefaultPortalConfig("Acme ISP");
  base.branding.headline = "Welcome to Acme";
  base.content.phone = "+254712345678";
  const out = applyTemplate(base, "hotel");
  assert.equal(out.branding.businessName, "Acme ISP");
  assert.equal(out.branding.headline, "Welcome to Acme");
  assert.equal(out.content.phone, "+254712345678");
  assert.equal(out.ui.colorMode, "dark");
});

test("Portal config — rejects unsafe/invalid input and never keeps HTML", () => {
  const cfg = getDefaultPortalConfig("Acme ISP");
  cfg.branding.primaryColor = "red; background:url(javascript:alert(1))";
  cfg.branding.headline = "<script>alert(1)</script>Hello";
  cfg.ui.fontFamily = "Comic Sans";
  cfg.content.email = "not-an-email";
  cfg.content.phone = "call me";
  cfg.content.social.facebook = "javascript:alert(1)";
  cfg.promotions.banner = { enabled: true, text: "Sale", ctaText: "Go", ctaUrl: "http://insecure.example.com" };
  const r = sanitizePortalConfig(cfg, optsFor(prefixA));
  assert.ok(r.errors["branding.primaryColor"]);
  assert.ok(r.errors["ui.fontFamily"]);
  assert.ok(r.errors["content.email"]);
  assert.ok(r.errors["content.phone"]);
  assert.ok(r.errors["content.social.facebook"]);
  assert.ok(r.errors["promotions.banner.ctaUrl"]);
  assert.ok(!r.config.branding.headline.includes("<"));
  assert.equal(r.config.branding.primaryColor, "#1f5fd1"); // fell back to safe default
  assert.equal(r.config.content.social.facebook, "");
});

test("Portal config — only backend-supported login methods; at least one required", () => {
  const supported = AUTH_METHOD_REGISTRY.filter((m) => m.supported).map((m) => m.id);
  assert.deepEqual(supported.sort(), ["mpesa", "voucher"]);

  const cfg = getDefaultPortalConfig("Acme ISP");
  cfg.authMethods = { voucher: false, mpesa: false };
  assert.ok(sanitizePortalConfig(cfg, optsFor(prefixA)).errors["authMethods"]);

  const fake = { ...getDefaultPortalConfig("X"), authMethods: { voucher: true, mpesa: true, phone_otp: true } };
  const r = sanitizePortalConfig(fake, optsFor(prefixA));
  assert.ok(r.errors["authMethods.phone_otp"]);
  assert.equal("phone_otp" in r.config.authMethods, false);
});

test("Tenant isolation — ISP A cannot reference ISP B's assets", () => {
  const urlB = `${prefixB}logo-abc.png`;
  const urlA = `${prefixA}logo-abc.png`;
  assert.equal(isOrgAssetUrl(urlA, prefixA), true);
  assert.equal(isOrgAssetUrl(urlB, prefixA), false);
  assert.equal(isOrgAssetUrl(`${prefixA}../${ORG_B}/logo.png`, prefixA), false);
  assert.equal(isOrgAssetUrl(`${prefixA}%2e%2e/${ORG_B}/logo.png`, prefixA), false);
  assert.equal(isOrgAssetUrl("https://evil.example.com/logo.png", prefixA), false);

  const cfg = getDefaultPortalConfig("A");
  cfg.branding.logoUrl = urlB; // A tries to use B's logo
  const r = sanitizePortalConfig(cfg, optsFor(prefixA));
  assert.ok(r.errors["branding.logoUrl"]);
  assert.equal(r.config.branding.logoUrl, "");
});

test("Tenant isolation — package overrides only apply to the tenant's own plans", () => {
  const cfg = getDefaultPortalConfig("A");
  cfg.packages.overrides = {
    "plan-a-1": { featured: true, cta: "Buy" },
    "plan-b-1": { featured: true, hidden: true },
  };
  const r = sanitizePortalConfig(cfg, optsFor(prefixA, ["plan-a-1"]));
  assert.deepEqual(Object.keys(r.config.packages.overrides), ["plan-a-1"]);
});

test("Two ISPs — configurations never cross over", () => {
  const plansA = [{ id: "a1", name: "Hotspot Daily", price: 50, downloadSpeedKbps: 10240, validityDurationSeconds: 86400, dataLimitMb: 0 }];
  const plansB = [{ id: "b1", name: "Hotspot Weekly", price: 300, downloadSpeedKbps: 5120, validityDurationSeconds: 604800, dataLimitMb: 5120 }];

  const a = getDefaultPortalConfig("Alpha Net");
  a.branding.primaryColor = "#0b3d91";
  a.packages.overrides = { a1: { featured: true, cta: "Connect Now" } };
  const b = applyTemplate(getDefaultPortalConfig("Beta WiFi"), "cafe");
  b.packages.overrides = { b1: { description: "Best for travellers" } };

  const ra = sanitizePortalConfig(a, optsFor(prefixA, ["a1"])).config;
  const rb = sanitizePortalConfig(b, optsFor(prefixB, ["b1"])).config;
  assert.equal(ra.branding.businessName, "Alpha Net");
  assert.equal(rb.branding.businessName, "Beta WiFi");
  assert.notEqual(ra.branding.primaryColor, rb.branding.primaryColor);

  const pa = presentPackages(plansA, ra);
  const pb = presentPackages(plansB, rb);
  assert.equal(pa.length, 1);
  assert.equal(pa[0].name, "Daily");
  assert.equal(pa[0].featured, true);
  assert.equal(pa[0].speedLabel, "10 Mbps");
  assert.equal(pa[0].durationLabel, "1 Day");
  assert.equal(pa[0].dataLabel, "Unlimited");
  assert.equal(pb[0].name, "Weekly");
  assert.equal(pb[0].description, "Best for travellers");
  assert.equal(pb[0].dataLabel, "5 GB");
  // B's overrides do not leak into A's presentation of A's plans
  assert.equal(pa[0].description, "");
});

test("Tenant resolution — slug, custom domain readiness, platform hosts ignored", () => {
  assert.deepEqual(resolveTenantKey({ org: "Alpha-Net" }), { type: "slug", value: "alpha-net" });
  assert.equal(resolveTenantKey({ org: "bad slug!" }), null);
  assert.deepEqual(resolveTenantKey({ host: "wifi.exampleisp.co.ke:443" }), { type: "domain", value: "wifi.exampleisp.co.ke" });
  assert.equal(resolveTenantKey({ host: "g-tech-isp-billing-system.vercel.app" }), null);
  assert.equal(resolveTenantKey({ host: "localhost:3000" }), null);
  // explicit slug wins over host
  assert.equal(resolveTenantKey({ org: "alpha", host: "wifi.exampleisp.co.ke" }).type, "slug");
});

test("Uploads — magic-byte detection rejects SVG/HTML disguised as images", () => {
  assert.equal(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(detectImageType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script>1</script></svg>")), null);
  assert.equal(detectImageType(new TextEncoder().encode("<html><script>alert(1)</script></html>")), null);
});

test("Accessibility — contrast helpers keep brand colours readable", () => {
  assert.ok(contrastRatio("#000000", "#ffffff") > 20);
  const pale = ensureContrast("#fde68a", "#ffffff", 4.5);
  assert.ok(contrastRatio(pale, "#ffffff") >= 4.5);

  const cfg = getDefaultPortalConfig("A");
  cfg.branding.primaryColor = "#ffff00";
  const pal = resolvePalette(cfg, false);
  assert.ok(contrastRatio(pal.primary, pal.primaryText) >= 4.5, "button text readable on bright brand colour");
  assert.ok(contrastRatio(pal.primaryOnSurface, pal.surface) >= 4.5, "brand text readable on card");
  assert.ok(getPortalWarnings(cfg).some((w) => w.field === "branding.primaryColor"));
});

test("Text/URL primitives", () => {
  assert.equal(cleanText("  <b>hi</b>\u0000 there ", 20), "bhi/b there");
  assert.equal(isSafeHttpsUrl("https://example.com/x"), true);
  assert.equal(isSafeHttpsUrl("http://example.com"), false);
  assert.equal(isSafeHttpsUrl("javascript:alert(1)"), false);
  assert.equal(isSafeHttpsUrl("https://user:pw@example.com"), false);
});

test("Demo captive portal — includes Daily Basic, Weekly Plus, and Monthly Pro packages with badges", () => {
  const demoCfg = getDefaultDemoPortalConfig("QC NetCore");
  const validIds = DEFAULT_DEMO_HOTSPOT_PLANS.map((p) => p.id);
  const sanitized = sanitizePortalConfig(demoCfg, optsFor(prefixA, validIds));
  assert.deepEqual(sanitized.errors, {});

  const presented = presentPackages(DEFAULT_DEMO_HOTSPOT_PLANS, sanitized.config);
  const daily = presented.find((p) => p.name === "Daily Basic");
  const weekly = presented.find((p) => p.name === "Weekly Plus");
  const monthly = presented.find((p) => p.name === "Monthly Pro");

  assert.ok(daily, "Daily Basic package present");
  assert.equal(daily.price, 50);
  assert.equal(daily.speedLabel, "5 Mbps");
  assert.equal(daily.durationLabel, "1 Day");
  assert.equal(daily.dataLabel, "Unlimited");

  assert.ok(weekly, "Weekly Plus package present");
  assert.equal(weekly.price, 250);
  assert.equal(weekly.speedLabel, "10 Mbps");
  assert.equal(weekly.durationLabel, "7 Days");
  assert.equal(weekly.dataLabel, "Unlimited");
  assert.equal(weekly.badge, "Popular");

  assert.ok(monthly, "Monthly Pro package present");
  assert.equal(monthly.price, 800);
  assert.equal(monthly.speedLabel, "20 Mbps");
  assert.equal(monthly.durationLabel, "30 Days");
  assert.equal(monthly.dataLabel, "Unlimited");
  assert.equal(monthly.badge, "Best Value");
});

