import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateRevenueByDay,
  computeNiceTicks,
} from "../src/lib/revenue.ts";
import {
  validateOrganizationSettingsInput,
} from "../src/lib/settings-validation.ts";
import {
  sanitizeUserMessage,
  classifyAuthError,
} from "../src/lib/supabase/errors.ts";

test("Daily Revenue Aggregation — 7-day & 30-day windows, COMPLETED filtering, zero-fill", () => {
  const ref = new Date("2026-10-03T12:00:00");
  const payments = [
    {
      status: "COMPLETED",
      amount: 2500,
      processedAt: "2026-10-03T09:00:00",
      createdAt: "2026-10-03T09:00:00",
    },
    {
      status: "COMPLETED",
      amount: 50,
      processedAt: "2026-10-03T10:15:00",
      createdAt: "2026-10-03T10:15:00",
    },
    {
      status: "COMPLETED",
      amount: 4000,
      processedAt: "2026-10-02T14:00:00",
      createdAt: "2026-10-02T14:00:00",
    },
    {
      status: "FAILED",
      amount: 9999,
      processedAt: "2026-10-03T11:00:00",
      createdAt: "2026-10-03T11:00:00",
    },
    {
      status: "PENDING",
      amount: 1500,
      createdAt: "2026-10-03T11:30:00",
    },
  ];

  const series7 = aggregateRevenueByDay(payments, 7, ref);
  assert.equal(series7.buckets.length, 7);
  assert.equal(series7.totalRevenue, 6550);
  assert.equal(series7.totalPayments, 3);
  assert.equal(series7.maxDailyRevenue, 4000);

  // Today (last bucket) has 2 completed payments = 2550
  const todayBucket = series7.buckets[6];
  assert.equal(todayBucket.dateKey, "2026-10-03");
  assert.equal(todayBucket.total, 2550);
  assert.equal(todayBucket.count, 2);

  // Yesterday has 1 completed payment = 4000
  const yesterdayBucket = series7.buckets[5];
  assert.equal(yesterdayBucket.dateKey, "2026-10-02");
  assert.equal(yesterdayBucket.total, 4000);
  assert.equal(yesterdayBucket.count, 1);

  // Missing days are zero-filled
  assert.equal(series7.buckets[0].total, 0);
  assert.equal(series7.buckets[0].count, 0);

  const series30 = aggregateRevenueByDay(payments, 30, ref);
  assert.equal(series30.buckets.length, 30);
  assert.equal(series30.totalRevenue, 6550);
});

test("Revenue Y-Axis Tick Generator — handles zero, medium, and large values", () => {
  const zeroTicks = computeNiceTicks(0);
  assert.deepEqual(zeroTicks, [0, 500, 1000, 1500, 2000, 2500]);

  const mediumTicks = computeNiceTicks(2500, 5);
  assert.equal(mediumTicks[0], 0);
  assert.ok(mediumTicks[mediumTicks.length - 1] >= 2500);

  const largeTicks = computeNiceTicks(342500, 4);
  assert.equal(largeTicks[0], 0);
  assert.ok(largeTicks[largeTicks.length - 1] >= 342500);
});

test("Organization Settings Validator — accepts valid payload and rejects invalid/unknown fields", () => {
  const valid = validateOrganizationSettingsInput({
    name: "G-Tech ISP Ltd",
    business_number: "4084200",
    email: "noc@gtech.co.ke",
    phone: "+254 700 123456",
    currency: "KES",
    timezone: "Africa/Nairobi",
    billing_cycle_type: "ANNIVERSARY",
    grace_period_days: 2,
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.data?.name, "G-Tech ISP Ltd");
  assert.equal(valid.data?.currency, "KES");

  const unknownField = validateOrganizationSettingsInput({
    name: "G-Tech ISP Ltd",
    email: "noc@gtech.co.ke",
    phone: "+254700123456",
    currency: "KES",
    timezone: "Africa/Nairobi",
    billing_cycle_type: "ANNIVERSARY",
    grace_period_days: 2,
    consumer_secret: "should-be-rejected",
  });
  assert.equal(unknownField.valid, false);
  assert.ok(unknownField.errors.general);

  const badFields = validateOrganizationSettingsInput({
    name: "A",
    business_number: null,
    email: "not-an-email",
    phone: "12",
    currency: "EUR",
    timezone: "Invalid/Timezone",
    billing_cycle_type: "WEEKLY",
    grace_period_days: 99,
  });
  assert.equal(badFields.valid, false);
  assert.ok(badFields.errors.name);
  assert.ok(badFields.errors.email);
  assert.ok(badFields.errors.phone);
  assert.ok(badFields.errors.currency);
  assert.ok(badFields.errors.timezone);
  assert.ok(badFields.errors.billing_cycle_type);
  assert.ok(badFields.errors.grace_period_days);
});

test("User-Facing Error Sanitizer & Auth Classifier — strips SQL, env vars, endpoints, and stack traces", () => {
  const fallback = "Changes could not be saved. Please try again.";

  assert.equal(
    sanitizeUserMessage('PostgresError: relation "public.settings" does not exist', fallback),
    fallback
  );
  assert.equal(
    sanitizeUserMessage("PGRST116: JSON object requested, multiple rows returned", fallback),
    fallback
  );
  assert.equal(
    sanitizeUserMessage("DARAJA_CONSUMER_KEY is undefined", fallback),
    fallback
  );
  assert.equal(
    sanitizeUserMessage("ECONNREFUSED 127.0.0.1:8787", fallback),
    fallback
  );
  assert.equal(
    sanitizeUserMessage("TypeError: Cannot read properties of undefined", fallback),
    fallback
  );
  assert.equal(
    sanitizeUserMessage("POST /api/v1/settings failed", fallback),
    fallback
  );
  assert.equal(
    sanitizeUserMessage("Please check the highlighted fields and try again.", fallback),
    "Please check the highlighted fields and try again."
  );

  assert.equal(
    classifyAuthError({ message: "Invalid login credentials" }, "login"),
    "Invalid email or password. Please check your credentials and try again."
  );
  assert.equal(
    classifyAuthError({ message: "Postgres connection pool exhausted" }, "login"),
    "Sign in failed. Please check your credentials and try again."
  );
});
