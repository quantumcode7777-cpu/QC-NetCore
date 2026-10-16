import test from "node:test";
import assert from "node:assert/strict";
import {
  attributeHotspotPayments,
  buildInvoiceNumber,
  buildInvoiceSms,
  computeInvoiceTotals,
  computeShareAmount,
  countPppoeUsers,
  normalizePhoneKE,
  parsePeriod,
  periodWindowUtc,
  statusAfterPayment,
  validateCreateIspInvoice,
  voucherFaceValue,
  DEFAULT_HOTSPOT_PCT,
  DEFAULT_PPPOE_RATE_USD,
  DEFAULT_FX_KES_PER_USD,
} from "../src/lib/admin/isp-billing.ts";

test("isp-billing — period parsing and UTC month window", () => {
  assert.deepEqual(parsePeriod("2026-10"), { year: 2026, month: 10 });
  assert.equal(parsePeriod("2026-13"), null);
  assert.equal(parsePeriod("Oct 2026"), null);
  assert.equal(parsePeriod(undefined), null);
  assert.deepEqual(periodWindowUtc(2026, 12), {
    start: "2026-12-01T00:00:00.000Z",
    end: "2027-01-01T00:00:00.000Z",
  });
  assert.deepEqual(periodWindowUtc(2026, 2), {
    start: "2026-02-01T00:00:00.000Z",
    end: "2026-03-01T00:00:00.000Z",
  });
});

test("isp-billing — create validation (rates default, share nullable)", () => {
  const good = validateCreateIspInvoice({
    organizationId: "org-1",
    period: "2026-10",
    dueDate: "2026-11-14",
    notes: "  October fee  ",
  });
  assert.equal(good.ok, true);
  assert.deepEqual(good.value, {
    organizationId: "org-1",
    year: 2026,
    month: 10,
    sharePct: null,
    pppoeRateUsd: DEFAULT_PPPOE_RATE_USD,
    fxRate: DEFAULT_FX_KES_PER_USD,
    customAmount: 0,
    customLabel: "",
    dueDate: "2026-11-14",
    notes: "October fee",
  });
  assert.equal(DEFAULT_HOTSPOT_PCT, 3);

  const custom = validateCreateIspInvoice({
    organizationId: "org-1",
    period: "2026-10",
    sharePct: 5,
    pppoeRateUsd: 0.3,
    fxRate: 130,
    customAmount: 5000,
    customLabel: "Enterprise platform fee",
    dueDate: "2026-11-14",
  });
  assert.equal(custom.ok, true);
  assert.equal(custom.value.sharePct, 5);
  assert.equal(custom.value.customAmount, 5000);

  for (const [input, code] of [
    [{ period: "2026-10", dueDate: "2026-11-14" }, "ISP_REQUIRED"],
    [{ organizationId: "o", period: "2026", dueDate: "2026-11-14" }, "BAD_PERIOD"],
    [{ organizationId: "o", period: "2026-10", sharePct: 150, dueDate: "2026-11-14" }, "BAD_SHARE"],
    [{ organizationId: "o", period: "2026-10", pppoeRateUsd: -1, dueDate: "2026-11-14" }, "BAD_PPPOE_RATE"],
    [{ organizationId: "o", period: "2026-10", fxRate: 0, dueDate: "2026-11-14" }, "BAD_FX"],
    [{ organizationId: "o", period: "2026-10", customAmount: -5, dueDate: "2026-11-14" }, "BAD_CUSTOM"],
    [{ organizationId: "o", period: "2026-10", dueDate: "14/11/2026" }, "BAD_DUE_DATE"],
  ]) {
    const bad = validateCreateIspInvoice(input);
    assert.equal(bad.ok, false);
    assert.equal(bad.code, code);
  }
});

test("isp-billing — share math rounds to cents, negatives treated as zero", () => {
  assert.equal(computeShareAmount(10000, 10), 1000);
  assert.equal(computeShareAmount(333, 10), 33.3);
  assert.equal(computeShareAmount(100, 7.5), 7.5);
  assert.equal(computeShareAmount(-50, 10), 0);
  assert.equal(computeShareAmount(NaN, 10), 0);
});

test("isp-billing — invoice numbers are namespaced and compact", () => {
  const no = buildInvoiceNumber(2026, 10, "dagi-net-3038", "3f8k");
  assert.equal(no, "QC-202610-DAGINE-3F8K");
  assert.equal(buildInvoiceNumber(2026, 1, "g-tech-2081", "ab12").length <= 24, true);
});

test("isp-billing — Kenyan MSISDN normalization", () => {
  assert.equal(normalizePhoneKE("+254703377395"), "+254703377395");
  assert.equal(normalizePhoneKE("0703377395"), "+254703377395");
  assert.equal(normalizePhoneKE("254703377395"), "+254703377395");
  assert.equal(normalizePhoneKE("703377395"), "+254703377395");
  assert.equal(normalizePhoneKE("07 033 773 95"), "+254703377395");
  assert.equal(normalizePhoneKE("12345"), null);
  assert.equal(normalizePhoneKE(undefined), null);
});

test("isp-billing — invoice SMS itemizes lines and fits one segment", () => {
  const sms = buildInvoiceSms({
    ispName: "Dagi Net",
    invoiceNumber: "QC-202610-DAGINE-3F8K",
    year: 2026,
    month: 10,
    hotspotBase: 12400,
    hotspotPct: 3,
    hotspotAmount: 372,
    pppoeUsers: 8,
    pppoeRateUsd: 0.25,
    pppoeAmount: 258,
    customAmount: 0,
    customLabel: "",
    totalAmount: 630,
    dueDate: "2026-11-14",
    currency: "KES",
  });
  assert.ok(sms.length <= 160, `SMS is ${sms.length} chars: ${sms}`);
  assert.ok(sms.includes("Dagi Net"));
  assert.ok(sms.includes("October 2026"));
  assert.ok(sms.includes("Hotspot 3%x12,400=372"));
  assert.ok(sms.includes("PPPoE 8x$0.25=258"));
  assert.ok(sms.includes("QC-202610-DAGINE-3F8K"));
  assert.ok(sms.includes("2026-11-14"));

  // Zero lines omitted; empty invoice still explains itself
  const empty = buildInvoiceSms({
    ispName: "Dagi Net",
    invoiceNumber: "QC-202610-DAGINE-0000",
    year: 2026,
    month: 10,
    hotspotBase: 0,
    hotspotPct: 3,
    hotspotAmount: 0,
    pppoeUsers: 0,
    pppoeRateUsd: 0.25,
    pppoeAmount: 0,
    customAmount: 0,
    customLabel: "",
    totalAmount: 0,
    dueDate: "2026-11-14",
    currency: "KES",
  });
  assert.ok(empty.includes("No chargeable usage"));
  assert.ok(empty.length <= 160);
});

test("isp-billing — hotspot attribution follows the subscription plan", () => {
  const subs = [
    { customer_id: "c1", plan_id: "hot", status: "ACTIVE", start_time: "2026-10-01T00:00:00Z", end_time: "2026-11-01T00:00:00Z" },
    { customer_id: "c2", plan_id: "fib", status: "ACTIVE", start_time: "2026-10-01T00:00:00Z", end_time: "2026-11-01T00:00:00Z" },
    { customer_id: "c3", plan_id: "hot", status: "EXPIRED", start_time: "2026-08-01T00:00:00Z", end_time: "2026-09-01T00:00:00Z" },
  ];
  const pays = [
    { customer_id: "c1", amount: 1000 },
    { customer_id: "c2", amount: 2000 },
    { customer_id: "c3", amount: 500 },
    { customer_id: null, amount: 700 },
  ];
  const base = attributeHotspotPayments(
    pays,
    subs,
    new Set(["hot"]),
    "2026-10-01T00:00:00.000Z",
    "2026-11-01T00:00:00.000Z"
  );
  assert.equal(base, 1000); // only c1: c2 is fibre, c3 stale, null unattributed
});

test("isp-billing — voucher face value counts redemptions in-window", () => {
  const face = voucherFaceValue(
    [
      { plan_id: "p1", first_activated_at: "2026-10-05T10:00:00Z" },
      { plan_id: "p1", first_activated_at: "2026-09-30T23:59:59Z" },
      { plan_id: "p9", first_activated_at: "2026-10-06T10:00:00Z" },
    ],
    new Map([["p1", 50]]),
    "2026-10-01T00:00:00.000Z",
    "2026-11-01T00:00:00.000Z"
  );
  assert.equal(face, 50); // Sept one out, unknown plan priced zero
});

test("isp-billing — PPPoE users are distinct ACTIVE/GRACE overlaps", () => {
  const subs = [
    { customer_id: "c1", plan_id: "fib", status: "ACTIVE", start_time: "2026-10-01T00:00:00Z", end_time: "2026-11-01T00:00:00Z" },
    { customer_id: "c1", plan_id: "fib", status: "ACTIVE", start_time: "2026-11-01T00:00:00Z", end_time: "2026-12-01T00:00:00Z" },
    { customer_id: "c2", plan_id: "fib", status: "GRACE", start_time: "2026-10-01T00:00:00Z", end_time: "2026-10-05T00:00:00Z" },
    { customer_id: "c3", plan_id: "fib", status: "SUSPENDED", start_time: "2026-10-01T00:00:00Z", end_time: "2026-11-01T00:00:00Z" },
    { customer_id: "c4", plan_id: "hot", status: "ACTIVE", start_time: "2026-10-01T00:00:00Z", end_time: "2026-11-01T00:00:00Z" },
  ];
  assert.equal(
    countPppoeUsers(subs, new Set(["fib"]), "2026-10-01T00:00:00.000Z", "2026-11-01T00:00:00.000Z"),
    2 // c1 once + c2 grace; c3 suspended, c4 hotspot
  );
});

test("isp-billing — line totals match the pricing page", () => {
  // 3% of 12,400 hotspot + 8 PPPoE users x $0.25 x 129 + 5,000 custom
  assert.deepEqual(
    computeInvoiceTotals({
      hotspotBase: 12400,
      hotspotPct: 3,
      pppoeUsers: 8,
      pppoeRateUsd: 0.25,
      fxRate: 129,
      customAmount: 5000,
    }),
    { hotspotAmount: 372, pppoeAmount: 258, customAmount: 5000, total: 5630 }
  );
  assert.deepEqual(
    computeInvoiceTotals({ hotspotBase: 0, hotspotPct: 3, pppoeUsers: 0, pppoeRateUsd: 0.25, fxRate: 129, customAmount: 0 }),
    { hotspotAmount: 0, pppoeAmount: 0, customAmount: 0, total: 0 }
  );
});

test("isp-billing — payment status transitions", () => {
  assert.equal(statusAfterPayment(1000, 0), "SENT");
  assert.equal(statusAfterPayment(1000, 400), "PARTIALLY_PAID");
  assert.equal(statusAfterPayment(1000, 1000), "PAID");
  assert.equal(statusAfterPayment(1000, 999.999), "PAID"); // rounding tolerance
});
