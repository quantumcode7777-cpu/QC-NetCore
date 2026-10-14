import test from "node:test";
import assert from "node:assert/strict";
import {
  buildVoucherCode,
  formatPlanDuration,
  generateBatchCodes,
  normalizeBatchPrefix,
  validateBatchRequest,
  VOUCHER_BATCH_MAX_QTY,
} from "../src/lib/vouchers/batch.ts";

test("batch — prefix normalization (uppercase, strips junk, caps length)", () => {
  assert.equal(normalizeBatchPrefix("qc"), "QC");
  assert.equal(normalizeBatchPrefix("  Gt-01! "), "GT01");
  assert.equal(normalizeBatchPrefix("ABCDEFGH"), "ABCDEF");
  assert.equal(normalizeBatchPrefix(""), "");
  assert.equal(normalizeBatchPrefix(undefined), "");
  assert.equal(normalizeBatchPrefix(42), "");
});

test("batch — request validation", () => {
  const good = validateBatchRequest({ planId: "plan-1", quantity: 10, prefix: "qc" });
  assert.equal(good.ok, true);
  assert.deepEqual(good.value, { planId: "plan-1", quantity: 10, prefix: "QC" });

  const noPlan = validateBatchRequest({ planId: " ", quantity: 10 });
  assert.equal(noPlan.ok, false);
  assert.equal(noPlan.code, "PLAN_REQUIRED");

  for (const qty of [0, -5, 1.5, VOUCHER_BATCH_MAX_QTY + 1, "abc", undefined]) {
    const bad = validateBatchRequest({ planId: "plan-1", quantity: qty });
    assert.equal(bad.ok, false, `qty ${String(qty)} should fail`);
    assert.equal(bad.code, "BAD_QUANTITY");
  }

  const strQty = validateBatchRequest({ planId: "plan-1", quantity: "25" });
  assert.equal(strQty.ok, true);
  assert.equal(strQty.value.quantity, 25);
});

test("batch — code shape PREFIX-XXXX-XXXX and prefix-less XXXX-XXXX", () => {
  assert.equal(buildVoucherCode("QC", "ABCDEFGH"), "QC-ABCD-EFGH");
  assert.equal(buildVoucherCode("", "ABCDEFGH"), "ABCD-EFGH");
});

test("batch — generated codes use the unambiguous charset only", () => {
  const codes = generateBatchCodes("T", 200);
  assert.equal(codes.length, 200);
  assert.equal(new Set(codes).size, 200);
  for (const c of codes) {
    assert.match(c, /^T-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  }
});

test("batch — skips taken codes and stays deterministic with injected rand", () => {
  const lcg = (seed) => {
    let s = seed;
    return (max) => {
      s = (s * 1103515245 + 12345) % 2147483648; // long-period deterministic stream
      return s % max;
    };
  };
  const first = generateBatchCodes("Q", 5, new Set(), lcg(7));
  assert.equal(first.length, 5);
  // Same seed, but the first code is taken -> skipped, stream continues past it
  const skipped = generateBatchCodes("Q", 5, new Set([first[0]]), lcg(7));
  assert.equal(skipped.length, 5);
  assert.ok(!skipped.includes(first[0]));
  assert.deepEqual(skipped.slice(0, 4), first.slice(1));
  // Untaken seed replays the same stream exactly
  const again = generateBatchCodes("Q", 5, new Set(), lcg(7));
  assert.deepEqual(again, first);
});

test("batch — plan duration labels match the dashboard format", () => {
  assert.equal(formatPlanDuration(3600), "1 Hour(s)");
  assert.equal(formatPlanDuration(10800), "3 Hour(s)");
  assert.equal(formatPlanDuration(86400), "1 Day(s)");
  assert.equal(formatPlanDuration(2592000), "30 Day(s)");
});
