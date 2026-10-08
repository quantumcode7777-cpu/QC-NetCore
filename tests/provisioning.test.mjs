import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  escapeRouterOsString,
  sanitizeRouterOsComment,
  RouterScriptGenerator,
} from "../src/lib/network/script-generator.ts";
import {
  validateBootstrapRequest,
  validateRegistrationPayload,
  generateProvisioningToken,
  hashToken,
  allocateTunnelIp,
  encryptSecret,
  decryptSecret,
  loadProvisioningEnv,
} from "../src/lib/provisioning/core.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("Routers page does not disable provisioning button when routers fleet is empty", () => {
  const routersPage = read("src/app/routers/page.tsx");
  assert.doesNotMatch(
    routersPage,
    /disabled=\{routers\.length === 0\}/,
    "routers.length === 0 must NOT disable the provisioning button"
  );
  assert.match(
    routersPage,
    /handleOpenProvisioningAction/,
    "Button click handler must invoke provisioning action"
  );
  assert.match(
    routersPage,
    /Download \.rsc/,
    "Must offer Download .rsc script option"
  );
  assert.match(
    routersPage,
    /Add MikroTik Router/,
    "Must support adding first MikroTik router"
  );
  // Ensure no hardcoded secrets exist in client routers page
  assert.doesNotMatch(routersPage, /radiusSecret:\s*"GtechRadiusSecret/, "Must not leak hardcoded RADIUS secret");
  assert.doesNotMatch(routersPage, /routerPrivateKey:\s*"sEcReT_/, "Must not leak router private key");
});

test("RouterScriptGenerator escapes RouterOS strings against command injection", () => {
  const maliciousInput = 'router" ; /system reboot ; :put "injected';
  const escaped = escapeRouterOsString(maliciousInput);
  assert.doesNotMatch(escaped, /" ; \/system reboot/);
  assert.match(escaped, /\\22/);

  assert.throws(() => {
    escapeRouterOsString("router\n/system identity set name=hacked");
  }, /control characters/);

  const cleanComment = sanitizeRouterOsComment("Core Router #1 (Main Pop) <script>");
  assert.strictEqual(cleanComment, "Core Router 1 (Main Pop) script");
});

test("RouterScriptGenerator generates valid v7 script without hardcoded secrets", () => {
  const validKey = "soi2weumuf2A9tx20aJYYORBr4M6dLPFVEkdK07DJiw=";
  const script = RouterScriptGenerator.generateScript({
    routerName: "Core-BNG-01",
    orgName: "Acme Networks",
    orgSlug: "acme-net",
    orgId: "org-123",
    routerOsVersion: "v7",
    managementTunnelIp: "10.200.1.25",
    saasGatewayHost: "vpn.example.com",
    saasGatewayPort: 51820,
    saasPublicKey: validKey,
    radiusSecret: "super-secret-radius-key",
    radiusAuthPort: 1812,
    radiusAcctPort: 1813,
    hotspotDnsName: "wifi.acme.local",
  });

  assert.match(script, /\/system identity set name="Core-BNG-01"/);
  assert.match(script, /\/interface wireguard add name=wg-qcnetcore/);
  assert.match(script, /address=10\.200\.1\.25\/16 interface=wg-qcnetcore/);
  assert.match(script, /secret="super-secret-radius-key"/);
  assert.match(script, /dns-name="wifi\.acme\.local"/);
});

test("validateBootstrapRequest validates payload and rejects injection/invalid inputs", () => {
  const valid = validateBootstrapRequest({
    routerName: "Pop-01",
    routerOsVersion: "v7",
  });
  assert.strictEqual(valid.ok, true);
  if (valid.ok) {
    assert.strictEqual(valid.value.routerName, "Pop-01");
    assert.strictEqual(valid.value.routerOsVersion, "v7");
  }

  const invalidVersion = validateBootstrapRequest({
    routerName: "Pop-01",
    routerOsVersion: "v8",
  });
  assert.strictEqual(invalidVersion.ok, false);

  const emptyName = validateBootstrapRequest({
    routerName: "   ",
    routerOsVersion: "v7",
  });
  assert.strictEqual(emptyName.ok, false);
});

test("validateRegistrationPayload validates router callback reports", () => {
  const validKey = "soi2weumuf2A9tx20aJYYORBr4M6dLPFVEkdK07DJiw=";
  const valid = validateRegistrationPayload({
    token: "valid-provisioning-token-with-sufficient-length-12345",
    publicKey: validKey,
    routerosVersion: "7.15.2",
    boardModel: "CCR2004-16G-2S+",
    cpuLoad: 12,
    freeMemoryMb: 3450,
    uptime: "2d 4h 10m",
  });
  assert.strictEqual(valid.ok, true);

  const badCpu = validateRegistrationPayload({
    token: "valid-provisioning-token-with-sufficient-length-12345",
    routerosVersion: "7.15.2",
    boardModel: "CCR2004",
    cpuLoad: 150, // Invalid: cpuLoad > 100
    freeMemoryMb: 3450,
    uptime: "2d",
  });
  assert.strictEqual(badCpu.ok, false);
});

test("Token hashing and tunnel IP allocation logic", () => {
  const { token, tokenHash } = generateProvisioningToken();
  assert.ok(token.length >= 32);
  assert.strictEqual(hashToken(token), tokenHash);

  const ip1 = allocateTunnelIp([]);
  assert.strictEqual(ip1, "10.200.1.2");

  const ip2 = allocateTunnelIp(["10.200.1.2", "10.200.1.3"]);
  assert.strictEqual(ip2, "10.200.1.4");
});

test("Secret AES-256-GCM encryption and decryption roundtrip", () => {
  const keyHex = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const secret = "TopSecretRadiusCredentials123$!";
  const encrypted = encryptSecret(secret, keyHex);
  assert.notStrictEqual(encrypted, secret);
  const decrypted = decryptSecret(encrypted, keyHex);
  assert.strictEqual(decrypted, secret);
});

test("loadProvisioningEnv validates required server secrets safely", () => {
  const missingResult = loadProvisioningEnv({});
  assert.strictEqual(missingResult.ok, false);
  if (!missingResult.ok) {
    assert.ok(missingResult.missing.includes("WIREGUARD_PUBLIC_ENDPOINT"));
    assert.ok(missingResult.missing.includes("RADIUS_SECRET"));
    assert.ok(missingResult.missing.includes("APP_ENCRYPTION_KEY"));
  }

  // Invalid key length for APP_ENCRYPTION_KEY
  const badKeyResult = loadProvisioningEnv({
    WIREGUARD_PUBLIC_ENDPOINT: "vpn.qcnetcore.internal:51820",
    WIREGUARD_SERVER_PUBLIC_KEY: "soi2weumuf2A9tx20aJYYORBr4M6dLPFVEkdK07DJiw=",
    RADIUS_SERVER: "10.200.1.1",
    RADIUS_SECRET: "radius-secret-pass-2026",
    PROVISIONING_BASE_URL: "https://qcnetcore.internal",
    APP_ENCRYPTION_KEY: "short_key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key-test",
  });
  assert.strictEqual(badKeyResult.ok, false);
  if (!badKeyResult.ok) {
    assert.ok(badKeyResult.missing.includes("APP_ENCRYPTION_KEY"));
  }

  // Missing WireGuard public key
  const badWgResult = loadProvisioningEnv({
    WIREGUARD_PUBLIC_ENDPOINT: "vpn.qcnetcore.internal:51820",
    WIREGUARD_SERVER_PUBLIC_KEY: "invalid_key",
    RADIUS_SERVER: "10.200.1.1",
    RADIUS_SECRET: "radius-secret-pass-2026",
    PROVISIONING_BASE_URL: "https://qcnetcore.internal",
    APP_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key-test",
  });
  assert.strictEqual(badWgResult.ok, false);
  if (!badWgResult.ok) {
    assert.ok(badWgResult.missing.includes("WIREGUARD_SERVER_PUBLIC_KEY"));
  }

  // Valid production environment
  const validKey = "soi2weumuf2A9tx20aJYYORBr4M6dLPFVEkdK07DJiw=";
  const validResult = loadProvisioningEnv({
    WIREGUARD_PUBLIC_ENDPOINT: "vpn.qcnetcore.internal:51820",
    WIREGUARD_SERVER_PUBLIC_KEY: validKey,
    RADIUS_SERVER: "10.200.1.1",
    RADIUS_SECRET: "radius-secret-pass-2026",
    PROVISIONING_BASE_URL: "https://qcnetcore.internal",
    APP_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key-test",
  });
  assert.strictEqual(validResult.ok, true);
});

test("getProvisioningConfigDiagnostics safely reports status without exposing secret values", async () => {
  const { getProvisioningConfigDiagnostics } = await import("../src/lib/provisioning/core.ts");
  const diag = getProvisioningConfigDiagnostics({
    WIREGUARD_PUBLIC_ENDPOINT: "vpn.qcnetcore.internal:51820",
    WIREGUARD_SERVER_PUBLIC_KEY: "soi2weumuf2A9tx20aJYYORBr4M6dLPFVEkdK07DJiw=",
    RADIUS_SERVER: "10.200.1.1",
    RADIUS_SECRET: "radius-secret-pass-2026",
    PROVISIONING_BASE_URL: "http://localhost:3000",
    APP_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
  });

  assert.strictEqual(diag.ready, true);
  for (const item of diag.diagnostics) {
    assert.strictEqual(item.status, "configured");
    // Ensure no values exist in diagnostic object
    assert.strictEqual(typeof item.value, "undefined");
  }
});
