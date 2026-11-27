import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateHourlyActivity,
  aggregateUsageByDay,
  classifyPaymentService,
  computeArpu,
  formatBytes,
  inWindow,
  revenueByRouter,
  summarizeRevenue,
  topCustomersByPayments,
  windowForDays,
} from "../src/lib/analytics.ts";

const ref = new Date(2026, 10, 27, 12, 0, 0);
const iso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0).toISOString();

const plans = [
  { id: "hp1", name: "1 Hour", serviceType: "HOTSPOT", price: 200 },
  { id: "pp1", name: "Home 5M", serviceType: "PPPOE", price: 2500 },
];

const subscriptions = [
  { customerId: "c1", planId: "hp1", status: "ACTIVE", startTime: iso(2026, 11, 1), endTime: iso(2026, 12, 1) },
  { customerId: "c2", planId: "pp1", status: "ACTIVE", startTime: iso(2026, 11, 1), endTime: iso(2026, 12, 1) },
];

const payments = [
  { customerId: "c1", amount: 1000, status: "COMPLETED", createdAt: iso(2026, 11, 26) },
  { customerId: "c2", amount: 2000, status: "COMPLETED", createdAt: iso(2026, 11, 25) },
  { customerId: "c3", amount: 500, status: "COMPLETED", createdAt: iso(2026, 11, 24) },
  { customerId: "c1", amount: 9000, status: "COMPLETED", createdAt: iso(2026, 10, 1) },
  { customerId: "c1", amount: 700, status: "FAILED", createdAt: iso(2026, 11, 26) },
];

const vouchers = [
  { planId: "hp1", firstActivatedAt: iso(2026, 11, 26, 15) },
  { planId: "hp1", firstActivatedAt: iso(2026, 10, 2) },
];

test("analytics — local calendar window excludes its exclusive end", () => {
  const win = windowForDays(7, ref);
  assert.equal(win.start < win.end, true);
  assert.equal(inWindow(win.start, win), true);
  assert.equal(inWindow(win.end, win), false);
  assert.equal(inWindow(iso(2026, 11, 26), win), true);
  assert.equal(inWindow(iso(2026, 10, 1), win), false);
  assert.equal(inWindow(null, win), false);
});

test("analytics — payment service attribution overlaps plans and hotspot wins ties", () => {
  const plansById = new Map(plans.map((p) => [p.id, p]));
  assert.equal(classifyPaymentService(payments[0], subscriptions, plansById), "HOTSPOT");
  assert.equal(classifyPaymentService(payments[1], subscriptions, plansById), "PPPOE");
  assert.equal(classifyPaymentService(payments[2], subscriptions, plansById), "UNATTRIBUTED");

  const both = [
    { customerId: "c1", planId: "hp1", status: "ACTIVE", startTime: iso(2026, 11, 1), endTime: iso(2026, 12, 1) },
    { customerId: "c1", planId: "pp1", status: "ACTIVE", startTime: iso(2026, 11, 1), endTime: iso(2026, 12, 1) },
  ];
  assert.equal(classifyPaymentService(payments[0], both, plansById), "HOTSPOT");
});

test("analytics — revenue summary splits collections and voucher face value", () => {
  const summary = summarizeRevenue({ payments, subscriptions, plans, vouchers, window: windowForDays(7, ref) });
  assert.equal(summary.hotspotPayments, 1000);
  assert.equal(summary.voucherFaceValue, 200);
  assert.equal(summary.hotspot, 1200);
  assert.equal(summary.pppoe, 2000);
  assert.equal(summary.unattributed, 500);
  assert.equal(summary.total, 3700);
  assert.equal(summary.paymentCount, 3);
  assert.equal(summary.transactionCount, 4);
});

test("analytics — router revenue maps PPPoE customers and keeps unknown separate", () => {
  const rows = revenueByRouter({
    payments,
    subscriptions,
    plans,
    vouchers,
    window: windowForDays(7, ref),
    routers: [
      { id: "r1", name: "Main RB5009", siteName: "Town" },
      { id: "r2", name: "Backup hex", siteName: "Site B" },
    ],
    pppoeAccounts: [
      { customerId: "c2", routerId: "r1", isOnline: true, bytesIn: 1000, bytesOut: 500 },
    ],
  });
  const byId = new Map(rows.map((r) => [r.routerId, r]));
  assert.equal(byId.get("r1").total, 2000);
  assert.equal(byId.get("r1").pppoe, 2000);
  assert.equal(byId.get("r1").sessions, 1);
  assert.equal(byId.get("r1").downloadBytes, 1000);
  assert.equal(byId.get("r2").total, 0);
  assert.equal(byId.get("unattributed").total, 1500);
  assert.equal(byId.get("unattributed").hotspot, 1000);
  assert.equal(rows[0].routerId, "r1");
});

test("analytics — ARPU and top customers ignore zero denominators", () => {
  assert.equal(computeArpu(3700, 76), 48.68);
  assert.equal(computeArpu(3700, 0), 0);
  const top = topCustomersByPayments(
    payments,
    [{ id: "c2", fullName: "Wanjiku", accountNumber: "GT-100" }],
    windowForDays(7, ref),
    1
  );
  assert.equal(top.length, 1);
  assert.equal(top[0].name, "Wanjiku");
  assert.equal(top[0].amount, 2000);
});

test("analytics — usage snapshots become per-day deltas, never invented history", () => {
  const twoDays = aggregateUsageByDay(
    [
      { at: iso(2026, 11, 26), downloadBytes: 0, uploadBytes: 0 },
      { at: iso(2026, 11, 27), downloadBytes: 2000, uploadBytes: 1000 },
    ],
    2,
    ref
  );
  assert.equal(twoDays.totalBytes, 3000);
  assert.equal(twoDays.downloadBytes, 2000);
  assert.equal(twoDays.uploadBytes, 1000);
  assert.equal(twoDays.dailyAverageBytes, 1500);
  assert.equal(twoDays.busiestDay.dateKey, "2026-11-27");

  const none = aggregateUsageByDay([], 7, ref);
  assert.equal(none.totalBytes, 0);
  assert.equal(none.busiestDay, null);
  assert.equal(none.buckets.length, 7);
});

test("analytics — hourly activity averages snapshots and finds the busiest hour", () => {
  const activity = aggregateHourlyActivity([
    { at: iso(2026, 11, 27, 9), onlineHotspot: 10, onlinePppoe: 20 },
    { at: iso(2026, 11, 27, 9), onlineHotspot: 20, onlinePppoe: 40 },
    { at: iso(2026, 11, 27, 10), onlineHotspot: 2, onlinePppoe: 3 },
  ]);
  assert.equal(activity.buckets.length, 24);
  assert.equal(activity.buckets[9].onlineHotspot, 15);
  assert.equal(activity.buckets[9].onlinePppoe, 30);
  assert.equal(activity.busiestHour.hour, 9);
  assert.equal(aggregateHourlyActivity([]).busiestHour, null);
});

test("analytics — byte formatter uses readable units", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(2048), "2.0 KB");
  assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB");
});
