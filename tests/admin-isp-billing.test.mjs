import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInvoiceNumber,
  buildInvoiceSms,
  computeShareAmount,
  normalizePhoneKE,
  parsePeriod,
  periodWindowUtc,
  statusAfterPayment,
  validateCreateIspInvoice,
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

test("isp-billing — create validation", () => {
  const good = validateCreateIspInvoice({
    organizationId: "org-1",
    period: "2026-10",
    sharePct: 10,
    dueDate: "2026-11-14",
    notes: "  October fee  ",
  });
  assert.equal(good.ok, true);
  assert.deepEqual(good.value, {
    organizationId: "org-1",
    year: 2026,
    month: 10,
    sharePct: 10,
    dueDate: "2026-11-14",
    notes: "October fee",
  });

  for (const [input, code] of [
    [{ period: "2026-10", sharePct: 10, dueDate: "2026-11-14" }, "ISP_REQUIRED"],
    [{ organizationId: "o", period: "2026", sharePct: 10, dueDate: "2026-11-14" }, "BAD_PERIOD"],
    [{ organizationId: "o", period: "2026-10", sharePct: 150, dueDate: "2026-11-14" }, "BAD_SHARE"],
    [{ organizationId: "o", period: "2026-10", sharePct: 10, dueDate: "14/11/2026" }, "BAD_DUE_DATE"],
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

test("isp-billing — invoice SMS fits one segment and names everything", () => {
  const sms = buildInvoiceSms({
    ispName: "Dagi Net",
    invoiceNumber: "QC-202610-DAGINE-3F8K",
    year: 2026,
    month: 10,
    baseAmount: 10000,
    sharePct: 10,
    totalAmount: 1000,
    dueDate: "2026-11-14",
    currency: "KES",
  });
  assert.ok(sms.length <= 160, `SMS is ${sms.length} chars: ${sms}`);
  assert.ok(sms.includes("Dagi Net"));
  assert.ok(sms.includes("QC-202610-DAGINE-3F8K"));
  assert.ok(sms.includes("October 2026"));
  assert.ok(sms.includes("2026-11-14"));
});

test("isp-billing — payment status transitions", () => {
  assert.equal(statusAfterPayment(1000, 0), "SENT");
  assert.equal(statusAfterPayment(1000, 400), "PARTIALLY_PAID");
  assert.equal(statusAfterPayment(1000, 1000), "PAID");
  assert.equal(statusAfterPayment(1000, 999.999), "PAID"); // rounding tolerance
});
