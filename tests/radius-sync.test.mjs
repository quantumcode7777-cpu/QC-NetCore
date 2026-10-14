// ====================================================================
// QC NETCORE OPERATING SYSTEM
// Radius sync writers (migration 022) — integration test.
// Spins a throwaway Postgres container, applies the real migrations,
// and asserts radcheck/radreply stay in lockstep with the domain.
// Skipped automatically when Docker is unavailable.
// ====================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NAME = `qc-radius-sync-${process.pid}`;
const DB = "qc_radius_test";
const MIGRATIONS = [
  "001_extensions.sql",
  "002_organizations.sql",
  "003_profiles.sql",
  "004_sites_routers.sql",
  "005_service_plans.sql",
  "006_customers_subscribers.sql",
  "007_vouchers.sql",
  "010_radius_tables.sql",
  "022_radius_sync.sql",
];

const dockerOk = (() => {
  try {
    // Probe the daemon (not just the CLI) so the test skips cleanly
    // on machines where Docker Desktop isn't running.
    return (
      spawnSync("docker", ["info"], { encoding: "utf8", timeout: 30000 }).status ===
      0
    );
  } catch {
    return false;
  }
})();

function docker(args, input) {
  const r = spawnSync("docker", args, {
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (r.status !== 0) {
    throw new Error(
      `docker ${args.join(" ")} exited ${r.status}\n${r.stderr || ""}${
        r.stdout || ""
      }`
    );
  }
  return r.stdout || "";
}

function psqlTry(sql) {
  const r = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      NAME,
      "psql",
      "-U",
      "postgres",
      "-d",
      DB,
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
      "-t",
      "-A",
      "-f",
      "-",
    ],
    { encoding: "utf8", input: sql, maxBuffer: 16 * 1024 * 1024 }
  );
  return { ok: r.status === 0, out: (r.stdout || "").trim(), err: r.stderr || "" };
}

function psql(sql) {
  const r = psqlTry(sql);
  if (!r.ok) throw new Error(`psql failed:\n${sql}\n${r.err}${r.out}`);
  return r.out;
}

const one = (sql) => psql(sql);
const num = (sql) => Number(one(sql));
const applyMigration = (file) =>
  psql(readFileSync(path.join(ROOT, "supabase", "migrations", file), "utf8"));

test(
  "radius sync writers keep rad tables in lockstep (migration 022)",
  {
    skip: dockerOk ? false : "docker not available",
    timeout: 600_000,
  },
  async (t) => {
    t.after(() => {
      try {
        docker(["rm", "-f", NAME]);
      } catch {
        /* container never started */
      }
    });

    docker([
      "run",
      "-d",
      "--rm",
      "--name",
      NAME,
      "-e",
      "POSTGRES_PASSWORD=test",
      "-e",
      `POSTGRES_DB=${DB}`,
      "postgres:15-alpine",
      "-c",
      "shared_preload_libraries=pg_stat_statements",
    ]);

    let ready = false;
    for (let i = 0; i < 120 && !ready; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      ready =
        spawnSync(
          "docker",
          ["exec", NAME, "pg_isready", "-U", "postgres"],
          { encoding: "utf8" }
        ).status === 0;
    }
    if (!ready) throw new Error("postgres container never became ready");

    // Supabase Auth stub (migration 003 references auth.users)
    psql(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT);
    `);
    for (const m of MIGRATIONS) applyMigration(m);

    // ---- Seed ------------------------------------------------------
    psql(`
      INSERT INTO organizations (id, name, slug, email, phone)
      VALUES ('11111111-1111-1111-1111-111111111111', 'Kutus ISP', 'kutus',
              'ops@kutus.test', '+254700000000');

      INSERT INTO plans (id, organization_id, name, service_type,
                         download_speed_kbps, upload_speed_kbps,
                         validity_duration_seconds, data_limit_mb, price,
                         mikrotik_rate_limit, simultaneous_sessions)
      VALUES
        ('21111111-1111-1111-1111-111111111111',
         '11111111-1111-1111-1111-111111111111',
         'Home 5M', 'PPPOE', 5000, 5000, 2592000, 1024, 1500, '5M/5M', 2),
        ('22222222-2222-2222-2222-222222222222',
         '11111111-1111-1111-1111-111111111111',
         'Daily Unlimited', 'HOTSPOT', 3000, 3000, 86400, 500, 50, '3M/3M', 1);

      INSERT INTO customers (id, organization_id, account_number, full_name,
                             phone_number, status)
      VALUES ('33333333-3333-3333-3333-333333333333',
              '11111111-1111-1111-1111-111111111111',
              'CUST-001', 'Jane Wanjiku', '+254711111111', 'ACTIVE');

      INSERT INTO pppoe_accounts (id, organization_id, customer_id, username,
                                  password_plain, service_plan_id,
                                  ip_assignment_type, static_ip, is_active)
      VALUES ('44444444-4444-4444-4444-444444444444',
              '11111111-1111-1111-1111-111111111111',
              '33333333-3333-3333-3333-333333333333',
              'kutus-john', 'pw123', '21111111-1111-1111-1111-111111111111',
              'STATIC', '10.5.0.10', TRUE);

      INSERT INTO subscriptions (id, organization_id, customer_id, plan_id,
                                 start_time, end_time, status)
      VALUES ('55555555-5555-5555-5555-555555555555',
              '11111111-1111-1111-1111-111111111111',
              '33333333-3333-3333-3333-333333333333',
              '21111111-1111-1111-1111-111111111111',
              now(), now() + interval '30 days', 'ACTIVE');

      INSERT INTO hotspot_vouchers (id, organization_id, plan_id, code, status)
      VALUES ('66666666-6666-6666-6666-666666666666',
              '11111111-1111-1111-1111-111111111111',
              '22222222-2222-2222-2222-222222222222',
              'ABCD1234', 'AVAILABLE');

      INSERT INTO radcheck (username, attribute, op, value)
      VALUES ('testuser', 'Cleartext-Password', ':=', 'testpass');
    `);

    // ---- 1) Initial write-through ----------------------------------
    assert.equal(num(`SELECT count(*) FROM radcheck WHERE username = 'kutus-john' AND source = 'PPPOE'`), 1);
    assert.equal(num(`SELECT count(*) FROM radreply WHERE username = 'kutus-john' AND source = 'PPPOE'`), 4,
      "pppoe reply: rate-limit, port-limit, framed-ip, total-limit");
    assert.equal(
      one(`SELECT value FROM radcheck WHERE username = 'kutus-john' AND source = 'PPPOE' AND attribute = 'Cleartext-Password'`),
      "pw123"
    );
    assert.equal(
      one(`SELECT (expires_at = (SELECT end_time FROM subscriptions
                                 WHERE customer_id = '33333333-3333-3333-3333-333333333333'))::int
             FROM radcheck WHERE username = 'kutus-john' AND source = 'PPPOE'`),
      "1",
      "pppoe radcheck carries the subscription end_time"
    );

    assert.equal(num(`SELECT count(*) FROM radcheck WHERE username = 'ABCD1234' AND source = 'VOUCHER'`), 1);
    assert.equal(num(`SELECT count(*) FROM radreply WHERE username = 'ABCD1234' AND source = 'VOUCHER'`), 3,
      "voucher reply: rate-limit, port-limit, total-limit");
    assert.equal(
      one(`SELECT (expires_at IS NULL)::int FROM radcheck
             WHERE username = 'ABCD1234' AND source = 'VOUCHER'`),
      "1",
      "unused voucher does not expire at login level"
    );

    // ---- 2) Migration is idempotent + preserves MANUAL rows --------
    applyMigration("022_radius_sync.sql");
    assert.equal(num(`SELECT count(*) FROM radcheck`), 3, "no duplicates after re-apply");
    assert.equal(num(`SELECT count(*) FROM radreply`), 7, "no duplicates after re-apply");
    assert.equal(num(`SELECT count(*) FROM radpostauth`), 0, "post-auth audit table exists");
    assert.equal(
      one(`SELECT value FROM radcheck WHERE username = 'testuser' AND source = 'MANUAL'`),
      "testpass",
      "manual radtest seed survives backfill"
    );

    // ---- 3) Account gating -----------------------------------------
    psql(`UPDATE pppoe_accounts SET is_active = FALSE WHERE username = 'kutus-john'`);
    assert.equal(num(`SELECT count(*) FROM radcheck WHERE username = 'kutus-john' AND source = 'PPPOE'`), 0);
    assert.equal(num(`SELECT count(*) FROM radcheck WHERE username = 'ABCD1234'`), 1, "voucher unaffected");
    psql(`UPDATE pppoe_accounts SET is_active = TRUE WHERE username = 'kutus-john'`);
    assert.equal(num(`SELECT count(*) FROM radreply WHERE username = 'kutus-john' AND source = 'PPPOE'`), 4);

    // ---- 4) Customer gating ----------------------------------------
    psql(`UPDATE customers SET status = 'SUSPENDED'
            WHERE id = '33333333-3333-3333-3333-333333333333'`);
    assert.equal(num(`SELECT count(*) FROM radcheck WHERE username = 'kutus-john' AND source = 'PPPOE'`), 0);
    psql(`UPDATE customers SET status = 'ACTIVE'
            WHERE id = '33333333-3333-3333-3333-333333333333'`);
    assert.equal(num(`SELECT count(*) FROM radcheck WHERE username = 'kutus-john' AND source = 'PPPOE'`), 1);

    // ---- 5) Subscription (payment) gating --------------------------
    psql(`UPDATE subscriptions SET status = 'EXPIRED'
            WHERE customer_id = '33333333-3333-3333-3333-333333333333'`);
    assert.equal(num(`SELECT count(*) FROM radcheck WHERE username = 'kutus-john' AND source = 'PPPOE'`), 0,
      "expired subscription blocks auth rows");

    psql(`UPDATE subscriptions
             SET status = 'ACTIVE', end_time = end_time + interval '30 days'
           WHERE customer_id = '33333333-3333-3333-3333-333333333333'`);
    assert.equal(num(`SELECT count(*) FROM radreply WHERE username = 'kutus-john' AND source = 'PPPOE'`), 4,
      "renewed subscription restores auth rows");
    assert.equal(
      one(`SELECT (r.expires_at = s.end_time)::int
             FROM radcheck r, subscriptions s
            WHERE r.username = 'kutus-john' AND r.source = 'PPPOE'
              AND s.customer_id = '33333333-3333-3333-3333-333333333333'`),
      "1",
      "renewal pushes the new end_time into radcheck"
    );

    // ---- 6) Username rename ----------------------------------------
    psql(`UPDATE pppoe_accounts SET username = 'kutus-jane' WHERE username = 'kutus-john'`);
    assert.equal(num(`SELECT count(*) FROM radcheck WHERE username = 'kutus-john' AND source = 'PPPOE'`), 0);
    assert.equal(num(`SELECT count(*) FROM radcheck WHERE username = 'kutus-jane' AND source = 'PPPOE'`), 1);
    psql(`UPDATE pppoe_accounts SET username = 'kutus-john' WHERE username = 'kutus-jane'`);

    // ---- 7) Voucher lifecycle --------------------------------------
    psql(`UPDATE hotspot_vouchers
             SET status = 'USED', expires_at = now() + interval '1 day'
           WHERE code = 'ABCD1234'`);
    assert.equal(num(`SELECT count(*) FROM radcheck WHERE username = 'ABCD1234' AND source = 'VOUCHER'`), 1,
      "USED voucher keeps auth rows (relogins allowed while paid window open)");
    assert.equal(
      one(`SELECT (r.expires_at = v.expires_at)::int
             FROM radcheck r, hotspot_vouchers v
            WHERE r.username = 'ABCD1234' AND v.code = 'ABCD1234'`),
      "1",
      "activation deadline lands in radcheck.expires_at"
    );

    psql(`UPDATE hotspot_vouchers SET status = 'EXPIRED' WHERE code = 'ABCD1234'`);
    assert.equal(num(`SELECT count(*) FROM radcheck WHERE username = 'ABCD1234'`), 0,
      "expired voucher is purged");
    psql(`UPDATE hotspot_vouchers SET status = 'AVAILABLE', expires_at = NULL WHERE code = 'ABCD1234'`);
    assert.equal(num(`SELECT count(*) FROM radcheck WHERE username = 'ABCD1234' AND source = 'VOUCHER'`), 1);

    // ---- 8) Plan edits propagate ------------------------------------
    psql(`UPDATE plans SET mikrotik_rate_limit = '6M/6M' WHERE service_type = 'PPPOE'`);
    assert.equal(
      one(`SELECT value FROM radreply
            WHERE username = 'kutus-john' AND attribute = 'Mikrotik-Rate-Limit'`),
      "6M/6M"
    );

    // ---- 9) Source scoping: voucher code == pppoe username ---------
    psql(`INSERT INTO hotspot_vouchers (organization_id, plan_id, code, status)
          VALUES ('11111111-1111-1111-1111-111111111111',
                  '22222222-2222-2222-2222-222222222222',
                  'kutus-john', 'AVAILABLE')`);
    assert.equal(num(`SELECT count(*) FROM radcheck WHERE username = 'kutus-john'`), 2,
      "voucher code and pppoe username coexist");
    psql(`DELETE FROM hotspot_vouchers WHERE code = 'kutus-john'`);
    assert.equal(num(`SELECT count(*) FROM radcheck WHERE username = 'kutus-john' AND source = 'PPPOE'`), 1,
      "removing the voucher leaves the pppoe account untouched");

    // ---- 10) RLS: browser roles denied, service_role allowed -------
    assert.equal(psqlTry(`SET ROLE anon; SELECT count(*) FROM radcheck;`).ok, false,
      "anon must not read radcheck");
    assert.equal(psqlTry(`SET ROLE authenticated; SELECT count(*) FROM radcheck;`).ok, false,
      "authenticated must not read radcheck");

    psql(`SET ROLE service_role;
          INSERT INTO radcheck (username, attribute, op, value)
          VALUES ('svc-role-check', 'Cleartext-Password', ':=', 'x');`);
    assert.equal(
      psql(`SET ROLE service_role;
            SELECT count(*) FROM radcheck WHERE username = 'svc-role-check';`),
      "1",
      "service_role can write radcheck under RLS"
    );
    psql(`SET ROLE service_role;
          DELETE FROM radcheck WHERE username = 'svc-role-check';`);

    // owner (FreeRADIUS connects as postgres) still reads everything
    assert.ok(num(`SELECT count(*) FROM radcheck`) >= 3, "owner read works after RLS");
  }
);
