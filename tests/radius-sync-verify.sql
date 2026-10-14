-- ====================================================================
-- verify-022.sql — self-asserting verification for migration 022.
-- Run against a SCRATCH database only, NEVER production:
--   psql -h 127.0.0.1 -p 5433 -U postgres -d scratch -v ON_ERROR_STOP=1 \
--     -f tests/radius-sync-verify.sql
-- Requires migrations 001-007 + 010 + 022 applied (plus an auth.users stub).
-- Any failed check RAISES EXCEPTION (non-zero exit). Ends with a success row.
-- ====================================================================

CREATE FUNCTION pg_temp.qassert(p_ok boolean, p_msg text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT p_ok THEN RAISE EXCEPTION 'VERIFY FAILED: %', p_msg; END IF;
END $$;

-- ---- seed ------------------------------------------------------------
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

-- ---- 1) initial write-through ----------------------------------------
SELECT pg_temp.qassert(
  (SELECT count(*) FROM radcheck
    WHERE username = 'kutus-john' AND source = 'PPPOE') = 1,
  'pppoe radcheck row written');
SELECT pg_temp.qassert(
  (SELECT count(*) FROM radreply
    WHERE username = 'kutus-john' AND source = 'PPPOE') = 4,
  'pppoe radreply rows (rate, port, framed-ip, total-limit)');
SELECT pg_temp.qassert(
  (SELECT value FROM radcheck
    WHERE username = 'kutus-john' AND source = 'PPPOE'
      AND attribute = 'Cleartext-Password') = 'pw123',
  'pppoe password value');
SELECT pg_temp.qassert(
  (SELECT (r.expires_at = s.end_time) FROM radcheck r, subscriptions s
    WHERE r.username = 'kutus-john' AND r.source = 'PPPOE'
      AND s.customer_id = '33333333-3333-3333-3333-333333333333'),
  'pppoe radcheck carries subscription end_time');
SELECT pg_temp.qassert(
  (SELECT count(*) FROM radcheck
    WHERE username = 'ABCD1234' AND source = 'VOUCHER') = 1,
  'voucher radcheck row written');
SELECT pg_temp.qassert(
  (SELECT count(*) FROM radreply
    WHERE username = 'ABCD1234' AND source = 'VOUCHER') = 3,
  'voucher radreply rows (rate, port, total-limit)');
SELECT pg_temp.qassert(
  (SELECT expires_at IS NULL FROM radcheck
    WHERE username = 'ABCD1234' AND source = 'VOUCHER'),
  'unused voucher has no login-level expiry');
SELECT pg_temp.qassert(
  (SELECT count(*) FROM radpostauth) = 0,
  'radpostauth audit table exists');

-- ---- 2) backfill is idempotent, MANUAL rows preserved ----------------
DO $$
DECLARE
    rp pppoe_accounts%ROWTYPE;
    rv hotspot_vouchers%ROWTYPE;
BEGIN
    DELETE FROM radcheck WHERE source IN ('PPPOE', 'VOUCHER');
    DELETE FROM radreply  WHERE source IN ('PPPOE', 'VOUCHER');
    FOR rp IN SELECT * FROM pppoe_accounts LOOP
        PERFORM radius_reconcile_pppoe(rp);
    END LOOP;
    FOR rv IN SELECT * FROM hotspot_vouchers LOOP
        PERFORM radius_reconcile_voucher(rv);
    END LOOP;
END $$;

SELECT pg_temp.qassert(
  (SELECT count(*) FROM radcheck) = 3, 'no duplicate radcheck after backfill');
SELECT pg_temp.qassert(
  (SELECT count(*) FROM radreply) = 7, 'no duplicate radreply after backfill');
SELECT pg_temp.qassert(
  (SELECT value FROM radcheck
    WHERE username = 'testuser' AND source = 'MANUAL') = 'testpass',
  'MANUAL radtest seed survives backfill');

-- ---- 3) account gating ------------------------------------------------
UPDATE pppoe_accounts SET is_active = FALSE WHERE username = 'kutus-john';
SELECT pg_temp.qassert(
  (SELECT count(*) FROM radcheck
    WHERE username = 'kutus-john' AND source = 'PPPOE') = 0,
  'deactivated account purged');
SELECT pg_temp.qassert(
  (SELECT count(*) FROM radcheck WHERE username = 'ABCD1234') = 1,
  'voucher unaffected by pppoe toggle');
UPDATE pppoe_accounts SET is_active = TRUE WHERE username = 'kutus-john';
SELECT pg_temp.qassert(
  (SELECT count(*) FROM radreply
    WHERE username = 'kutus-john' AND source = 'PPPOE') = 4,
  'reactivated account restored');

-- ---- 4) customer gating -----------------------------------------------
UPDATE customers SET status = 'SUSPENDED'
 WHERE id = '33333333-3333-3333-3333-333333333333';
SELECT pg_temp.qassert(
  (SELECT count(*) FROM radcheck
    WHERE username = 'kutus-john' AND source = 'PPPOE') = 0,
  'suspended customer purged');
UPDATE customers SET status = 'ACTIVE'
 WHERE id = '33333333-3333-3333-3333-333333333333';
SELECT pg_temp.qassert(
  (SELECT count(*) FROM radcheck
    WHERE username = 'kutus-john' AND source = 'PPPOE') = 1,
  'restored customer re-synced');

-- ---- 5) subscription (payment) gating ---------------------------------
UPDATE subscriptions SET status = 'EXPIRED'
 WHERE customer_id = '33333333-3333-3333-3333-333333333333';
SELECT pg_temp.qassert(
  (SELECT count(*) FROM radcheck
    WHERE username = 'kutus-john' AND source = 'PPPOE') = 0,
  'expired subscription blocks auth rows');

UPDATE subscriptions
   SET status = 'ACTIVE', end_time = end_time + interval '30 days'
 WHERE customer_id = '33333333-3333-3333-3333-333333333333';
SELECT pg_temp.qassert(
  (SELECT count(*) FROM radreply
    WHERE username = 'kutus-john' AND source = 'PPPOE') = 4,
  'renewed subscription restores auth rows');
SELECT pg_temp.qassert(
  (SELECT (r.expires_at = s.end_time) FROM radcheck r, subscriptions s
    WHERE r.username = 'kutus-john' AND r.source = 'PPPOE'
      AND s.customer_id = '33333333-3333-3333-3333-333333333333'),
  'renewal pushes new end_time into radcheck');

-- ---- 6) username rename -----------------------------------------------
UPDATE pppoe_accounts SET username = 'kutus-jane' WHERE username = 'kutus-john';
SELECT pg_temp.qassert(
  (SELECT count(*) FROM radcheck
    WHERE username = 'kutus-john' AND source = 'PPPOE') = 0,
  'old username purged on rename');
SELECT pg_temp.qassert(
  (SELECT count(*) FROM radcheck
    WHERE username = 'kutus-jane' AND source = 'PPPOE') = 1,
  'new username written on rename');
UPDATE pppoe_accounts SET username = 'kutus-john' WHERE username = 'kutus-jane';

-- ---- 7) voucher lifecycle ----------------------------------------------
UPDATE hotspot_vouchers
   SET status = 'USED', expires_at = now() + interval '1 day'
 WHERE code = 'ABCD1234';
SELECT pg_temp.qassert(
  (SELECT count(*) FROM radcheck
    WHERE username = 'ABCD1234' AND source = 'VOUCHER') = 1,
  'USED voucher keeps auth rows (relogins allowed in paid window)');
SELECT pg_temp.qassert(
  (SELECT (r.expires_at = v.expires_at) FROM radcheck r, hotspot_vouchers v
    WHERE r.username = 'ABCD1234' AND v.code = 'ABCD1234'),
  'activation deadline lands in radcheck.expires_at');

UPDATE hotspot_vouchers SET status = 'EXPIRED' WHERE code = 'ABCD1234';
SELECT pg_temp.qassert(
  (SELECT count(*) FROM radcheck WHERE username = 'ABCD1234') = 0,
  'expired voucher purged');
UPDATE hotspot_vouchers
   SET status = 'AVAILABLE', expires_at = NULL WHERE code = 'ABCD1234';
SELECT pg_temp.qassert(
  (SELECT count(*) FROM radcheck
    WHERE username = 'ABCD1234' AND source = 'VOUCHER') = 1,
  're-available voucher restored');

-- ---- 8) plan edits propagate -------------------------------------------
UPDATE plans SET mikrotik_rate_limit = '6M/6M' WHERE service_type = 'PPPOE';
SELECT pg_temp.qassert(
  (SELECT value FROM radreply
    WHERE username = 'kutus-john' AND attribute = 'Mikrotik-Rate-Limit') = '6M/6M',
  'plan rate change propagated to radreply');

-- ---- 9) source scoping: voucher code == pppoe username -----------------
INSERT INTO hotspot_vouchers (organization_id, plan_id, code, status)
VALUES ('11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        'kutus-john', 'AVAILABLE');
SELECT pg_temp.qassert(
  (SELECT count(*) FROM radcheck WHERE username = 'kutus-john') = 2,
  'voucher code and pppoe username coexist');
DELETE FROM hotspot_vouchers WHERE code = 'kutus-john';
SELECT pg_temp.qassert(
  (SELECT count(*) FROM radcheck
    WHERE username = 'kutus-john' AND source = 'PPPOE') = 1,
  'removing voucher leaves pppoe account untouched');

-- ---- 10) RLS: browser roles denied, service_role allowed ---------------
DO $$
BEGIN
  SET ROLE anon;
  PERFORM (SELECT count(*) FROM radcheck);
  RAISE EXCEPTION 'VERIFY FAILED: anon could read radcheck';
EXCEPTION WHEN insufficient_privilege THEN
  -- expected
END $$;
RESET ROLE;

DO $$
BEGIN
  SET ROLE authenticated;
  PERFORM (SELECT count(*) FROM radcheck);
  RAISE EXCEPTION 'VERIFY FAILED: authenticated could read radcheck';
EXCEPTION WHEN insufficient_privilege THEN
  -- expected
END $$;
RESET ROLE;

SET ROLE service_role;
INSERT INTO radcheck (username, attribute, op, value)
VALUES ('svc-probe', 'Cleartext-Password', ':=', 'x');
DELETE FROM radcheck WHERE username = 'svc-probe';
RESET ROLE;

SELECT pg_temp.qassert(
  (SELECT count(*) FROM radcheck) >= 3,
  'owner read works after RLS');

SELECT 'ALL RADIUS SYNC CHECKS PASSED' AS verify_022;
