-- ====================================================================
-- QC NETCORE OPERATING SYSTEM
-- Migration 022: RADIUS Sync Writers (radcheck / radreply)
--
-- Keeps FreeRADIUS auth rows in lockstep with the billing domain:
--   hotspot_vouchers, pppoe_accounts, customers, subscriptions, plans
--
-- Design:
--   * rad rows carry `source` ('PPPOE' | 'VOUCHER' | 'MANUAL') so a
--     voucher code and a PPPoE username can never clobber each other.
--   * rad rows carry `expires_at` (wall-clock). FreeRADIUS rejects once
--     it passes — enforced by the authorize_check_query documented in
--     docs/FREERADIUS_RLM_SQL.md. MANUAL rows (radtest seeds) never
--     expire (expires_at NULL).
--   * Triggers are SECURITY DEFINER: staff writes via PostgREST and
--     service_role writes still keep rad tables consistent.
--   * rad tables get RLS with no browser policies: only FreeRADIUS
--     (postgres, table owner) and service_role can touch them.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1) Auth-gating + ownership columns
-- --------------------------------------------------------------------

ALTER TABLE radcheck ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE radreply  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE radcheck ADD COLUMN IF NOT EXISTS source VARCHAR(16) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE radreply  ADD COLUMN IF NOT EXISTS source VARCHAR(16) NOT NULL DEFAULT 'MANUAL';

CREATE INDEX IF NOT EXISTS idx_radcheck_expires_at ON radcheck(expires_at);

-- Post-auth audit log (stock FreeRADIUS postauth_query writes here on
-- every Accept/Reject; a missing table turns Accepts into Rejects).
CREATE TABLE IF NOT EXISTS radpostauth (
    id          BIGSERIAL PRIMARY KEY,
    username    VARCHAR(64) NOT NULL DEFAULT '',
    pass        VARCHAR(64) NOT NULL DEFAULT '',
    reply       VARCHAR(32) NOT NULL DEFAULT '',
    authdate    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_radpostauth_username ON radpostauth(username);

-- --------------------------------------------------------------------
-- 2) Lock rad tables away from browser roles
-- --------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
    END IF;
END $$;

ALTER TABLE radcheck      ENABLE ROW LEVEL SECURITY;
ALTER TABLE radreply      ENABLE ROW LEVEL SECURITY;
ALTER TABLE radusergroup  ENABLE ROW LEVEL SECURITY;
ALTER TABLE radgroupreply ENABLE ROW LEVEL SECURITY;
ALTER TABLE radacct       ENABLE ROW LEVEL SECURITY;
ALTER TABLE radpostauth   ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON radcheck, radreply, radusergroup, radgroupreply, radacct,
    radpostauth
    FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON radcheck, radreply, radusergroup, radgroupreply,
    radpostauth
    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON radacct TO service_role;
GRANT USAGE ON SEQUENCE radcheck_id_seq, radreply_id_seq, radusergroup_id_seq,
    radgroupreply_id_seq, radacct_radacctid_seq, radpostauth_id_seq
    TO service_role;

-- Explicit policy so service_role works even without BYPASSRLS.
DROP POLICY IF EXISTS service_role_all ON radcheck;
DROP POLICY IF EXISTS service_role_all ON radreply;
DROP POLICY IF EXISTS service_role_all ON radusergroup;
DROP POLICY IF EXISTS service_role_all ON radgroupreply;
DROP POLICY IF EXISTS service_role_all ON radacct;
DROP POLICY IF EXISTS service_role_all ON radpostauth;
CREATE POLICY service_role_all ON radcheck      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON radreply      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON radusergroup  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON radgroupreply FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON radacct       FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON radpostauth   FOR ALL TO service_role USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------
-- 3) Reconcilers (SECURITY DEFINER)
-- --------------------------------------------------------------------

-- Voucher: auth rows exist while status is AVAILABLE/USED.
-- Wall-clock expiry is carried in expires_at (set at first activation).
CREATE OR REPLACE FUNCTION radius_reconcile_voucher(p_voucher hotspot_vouchers)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plan plans%ROWTYPE;
BEGIN
    DELETE FROM radcheck WHERE username = p_voucher.code AND source = 'VOUCHER';
    DELETE FROM radreply  WHERE username = p_voucher.code AND source = 'VOUCHER';

    IF p_voucher.status NOT IN ('AVAILABLE', 'USED') THEN
        RETURN;
    END IF;

    SELECT * INTO v_plan FROM plans WHERE id = p_voucher.plan_id;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    INSERT INTO radcheck (username, attribute, op, value, source, expires_at)
    VALUES (p_voucher.code, 'Cleartext-Password', ':=', p_voucher.code,
            'VOUCHER', p_voucher.expires_at);

    INSERT INTO radreply (username, attribute, op, value, source, expires_at)
    VALUES (p_voucher.code, 'Mikrotik-Rate-Limit', '=', v_plan.mikrotik_rate_limit,
            'VOUCHER', p_voucher.expires_at),
           (p_voucher.code, 'Port-Limit', '=', '1',
            'VOUCHER', p_voucher.expires_at);

    IF v_plan.data_limit_mb > 0 THEN
        INSERT INTO radreply (username, attribute, op, value, source, expires_at)
        VALUES (p_voucher.code, 'Mikrotik-Total-Limit', '=',
                (v_plan.data_limit_mb * 1048576)::text,
                'VOUCHER', p_voucher.expires_at);
    END IF;
END;
$$;

-- PPPoE: auth rows exist while account is active, customer is ACTIVE,
-- and the service window (latest ACTIVE/GRACE subscription) is open.
-- No subscription at all = onboarding window (expires_at NULL).
CREATE OR REPLACE FUNCTION radius_reconcile_pppoe(p_acct pppoe_accounts)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_customer_status TEXT;
    v_window          TIMESTAMPTZ;
    v_plan            plans%ROWTYPE;
BEGIN
    DELETE FROM radcheck WHERE username = p_acct.username AND source = 'PPPOE';
    DELETE FROM radreply  WHERE username = p_acct.username AND source = 'PPPOE';

    IF NOT p_acct.is_active THEN
        RETURN;
    END IF;

    SELECT status INTO v_customer_status
      FROM customers
     WHERE id = p_acct.customer_id;
    IF NOT FOUND OR v_customer_status <> 'ACTIVE' THEN
        RETURN;
    END IF;

    SELECT CASE
               WHEN s.status = 'ACTIVE' THEN s.end_time
               WHEN s.status = 'GRACE'  THEN COALESCE(s.grace_end_time, s.end_time)
           END
      INTO v_window
      FROM subscriptions s
     WHERE s.customer_id = p_acct.customer_id
     ORDER BY (s.status IN ('ACTIVE', 'GRACE')) DESC, s.end_time DESC
     LIMIT 1;

    IF FOUND AND v_window IS NULL THEN
        -- Latest subscription is SUSPENDED/EXPIRED/CANCELLED → block.
        RETURN;
    END IF;
    IF v_window IS NOT NULL AND v_window <= now() THEN
        -- Service window already over → block.
        RETURN;
    END IF;

    SELECT * INTO v_plan FROM plans WHERE id = p_acct.service_plan_id;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    INSERT INTO radcheck (username, attribute, op, value, source, expires_at)
    VALUES (p_acct.username, 'Cleartext-Password', ':=', p_acct.password_plain,
            'PPPOE', v_window);

    INSERT INTO radreply (username, attribute, op, value, source, expires_at)
    VALUES (p_acct.username, 'Mikrotik-Rate-Limit', '=', v_plan.mikrotik_rate_limit,
            'PPPOE', v_window),
           (p_acct.username, 'Port-Limit', '=',
            v_plan.simultaneous_sessions::text, 'PPPOE', v_window);

    IF p_acct.ip_assignment_type = 'STATIC' AND p_acct.static_ip IS NOT NULL THEN
        INSERT INTO radreply (username, attribute, op, value, source, expires_at)
        VALUES (p_acct.username, 'Framed-IP-Address', '=', p_acct.static_ip,
                'PPPOE', v_window);
    END IF;

    IF v_plan.data_limit_mb > 0 THEN
        INSERT INTO radreply (username, attribute, op, value, source, expires_at)
        VALUES (p_acct.username, 'Mikrotik-Total-Limit', '=',
                (v_plan.data_limit_mb * 1048576)::text, 'PPPOE', v_window);
    END IF;
END;
$$;

-- --------------------------------------------------------------------
-- 4) Triggers
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trg_radius_voucher_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM radcheck WHERE username = OLD.code AND source = 'VOUCHER';
        DELETE FROM radreply  WHERE username = OLD.code AND source = 'VOUCHER';
        RETURN OLD;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.code IS DISTINCT FROM NEW.code THEN
        DELETE FROM radcheck WHERE username = OLD.code AND source = 'VOUCHER';
        DELETE FROM radreply  WHERE username = OLD.code AND source = 'VOUCHER';
    END IF;
    PERFORM radius_reconcile_voucher(NEW);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS radius_sync_voucher ON hotspot_vouchers;
CREATE TRIGGER radius_sync_voucher
AFTER INSERT OR UPDATE OR DELETE ON hotspot_vouchers
FOR EACH ROW EXECUTE FUNCTION trg_radius_voucher_sync();

CREATE OR REPLACE FUNCTION trg_radius_pppoe_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM radcheck WHERE username = OLD.username AND source = 'PPPOE';
        DELETE FROM radreply  WHERE username = OLD.username AND source = 'PPPOE';
        RETURN OLD;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.username IS DISTINCT FROM NEW.username THEN
        DELETE FROM radcheck WHERE username = OLD.username AND source = 'PPPOE';
        DELETE FROM radreply  WHERE username = OLD.username AND source = 'PPPOE';
    END IF;
    PERFORM radius_reconcile_pppoe(NEW);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS radius_sync_pppoe ON pppoe_accounts;
CREATE TRIGGER radius_sync_pppoe
AFTER INSERT OR UPDATE OR DELETE ON pppoe_accounts
FOR EACH ROW EXECUTE FUNCTION trg_radius_pppoe_sync();

CREATE OR REPLACE FUNCTION trg_radius_customer_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT * FROM pppoe_accounts WHERE customer_id = NEW.id LOOP
        PERFORM radius_reconcile_pppoe(r);
    END LOOP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS radius_sync_customer ON customers;
CREATE TRIGGER radius_sync_customer
AFTER UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION trg_radius_customer_sync();

CREATE OR REPLACE FUNCTION trg_radius_subscription_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r     RECORD;
    v_old UUID;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
        FOR r IN SELECT * FROM pppoe_accounts WHERE customer_id = OLD.customer_id LOOP
            PERFORM radius_reconcile_pppoe(r);
        END LOOP;
    END IF;

    IF TG_OP = 'DELETE' THEN
        v_old := OLD.customer_id;
    ELSE
        v_old := NEW.customer_id;
    END IF;

    FOR r IN SELECT * FROM pppoe_accounts WHERE customer_id = v_old LOOP
        PERFORM radius_reconcile_pppoe(r);
    END LOOP;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS radius_sync_subscription ON subscriptions;
CREATE TRIGGER radius_sync_subscription
AFTER INSERT OR UPDATE OR DELETE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION trg_radius_subscription_sync();

CREATE OR REPLACE FUNCTION trg_radius_plan_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT * FROM pppoe_accounts WHERE service_plan_id = NEW.id LOOP
        PERFORM radius_reconcile_pppoe(r);
    END LOOP;
    FOR r IN SELECT * FROM hotspot_vouchers WHERE plan_id = NEW.id LOOP
        PERFORM radius_reconcile_voucher(r);
    END LOOP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS radius_sync_plan ON plans;
CREATE TRIGGER radius_sync_plan
AFTER UPDATE ON plans
FOR EACH ROW EXECUTE FUNCTION trg_radius_plan_sync();

-- --------------------------------------------------------------------
-- 5) Backfill: rebuild every generated rad row from current state.
--    MANUAL rows (radtest seeds, hand-written entries) are untouched.
-- --------------------------------------------------------------------

DO $$
DECLARE
    r RECORD;
BEGIN
    DELETE FROM radcheck WHERE source IN ('PPPOE', 'VOUCHER');
    DELETE FROM radreply  WHERE source IN ('PPPOE', 'VOUCHER');

    FOR r IN SELECT * FROM pppoe_accounts LOOP
        PERFORM radius_reconcile_pppoe(r);
    END LOOP;

    FOR r IN SELECT * FROM hotspot_vouchers LOOP
        PERFORM radius_reconcile_voucher(r);
    END LOOP;
END $$;
