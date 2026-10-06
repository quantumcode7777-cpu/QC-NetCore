import test from "node:test";
import assert from "node:assert/strict";

// 1. Phone number normalizer tests
function formatPhoneNumber(phone) {
  let clean = phone.replace(/[^0-9]/g, "");
  if (clean.startsWith("0")) {
    clean = "254" + clean.substring(1);
  } else if (clean.startsWith("+254")) {
    clean = clean.substring(1);
  } else if (clean.startsWith("7") || clean.startsWith("1")) {
    clean = "254" + clean;
  }
  return clean;
}

test("M-Pesa Phone Number Normalizer", () => {
  assert.equal(formatPhoneNumber("0712345678"), "254712345678");
  assert.equal(formatPhoneNumber("+254799112233"), "254799112233");
  assert.equal(formatPhoneNumber("722001122"), "254722001122");
  assert.equal(formatPhoneNumber("0110123456"), "254110123456");
});

// 2. MikroTik Rate Limit string calculation test
function generateRateLimitString(uploadKbps, downloadKbps, burst) {
  const rx = `${uploadKbps}k`;
  const tx = `${downloadKbps}k`;
  if (burst) {
    const rxBurst = `${burst.up}k`;
    const txBurst = `${burst.down}k`;
    return `${rx}/${tx} ${rxBurst}/${txBurst} 4096k/8192k 15/15 7 2048k/4096k`;
  }
  return `${rx}/${tx}`;
}

test("MikroTik Rate-Limit String Generator", () => {
  const standard = generateRateLimitString(2560, 5120);
  assert.equal(standard, "2560k/5120k");

  const burst = generateRateLimitString(5120, 10240, { up: 7680, down: 15360 });
  assert.equal(burst, "5120k/10240k 7680k/15360k 4096k/8192k 15/15 7 2048k/4096k");
});

// 3. RBAC Permissions Matrix Test
const ROLE_PERMISSIONS = {
  super_admin: ["org.manage", "routers.manage", "billing.reconcile", "vouchers.generate"],
  customer: ["portal.access"],
};

function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

test("RBAC Permissions Verification", () => {
  assert.equal(hasPermission("super_admin", "org.manage"), true);
  assert.equal(hasPermission("super_admin", "routers.manage"), true);
  assert.equal(hasPermission("customer", "org.manage"), false);
  assert.equal(hasPermission("customer", "portal.access"), true);
});

// 4. Voucher Code Format Test
function generateVoucherCode(prefix = "GT") {
  const charset = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let random = "";
  for (let i = 0; i < 8; i++) {
    random += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return `${prefix}-${random.substring(0, 4)}-${random.substring(4, 8)}`;
}

test("Voucher Code Synthesizer", () => {
  const code = generateVoucherCode("GT1H");
  assert.match(code, /^GT1H-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
});
