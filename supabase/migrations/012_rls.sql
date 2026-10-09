-- ====================================================================
-- QC NETCORE OPERATING SYSTEM
-- Migration 012: Row Level Security (RLS) & Multi-Tenant Core Policies
-- Core security helper functions and baseline tenant isolation policies
-- ====================================================================

-- 1. Helper functions in public schema (SECURITY DEFINER with strict search_path)

CREATE OR REPLACE FUNCTION auth_org_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
    v_org_id UUID;
BEGIN
    -- First check JWT user metadata if present
    SELECT NULLIF(auth.jwt() -> 'user_metadata' ->> 'organization_id', '')::UUID
      INTO v_org_id;
    IF v_org_id IS NOT NULL THEN
        RETURN v_org_id;
    END IF;

    -- Fallback to querying user's active profile in database
    SELECT organization_id INTO v_org_id
      FROM public.profiles
     WHERE id = auth.uid()
       AND is_active = TRUE
     LIMIT 1;

    RETURN v_org_id;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION auth_role()
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
    v_role VARCHAR;
BEGIN
    SELECT role INTO v_role
      FROM public.profiles
     WHERE id = auth.uid()
       AND is_active = TRUE
     LIMIT 1;

    RETURN v_role;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
    v_role VARCHAR;
BEGIN
    SELECT role INTO v_role
      FROM public.profiles
     WHERE id = auth.uid()
       AND is_active = TRUE
     LIMIT 1;

    RETURN v_role IN ('super_admin', 'isp_owner', 'isp_admin');
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
    v_role VARCHAR;
BEGIN
    SELECT role INTO v_role
      FROM public.profiles
     WHERE id = auth.uid()
       AND is_active = TRUE
     LIMIT 1;

    RETURN v_role IN ('super_admin', 'isp_owner', 'isp_admin', 'noc_engineer', 'finance', 'support', 'technician');
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION auth_org_id() IS 'Returns organization ID of the authenticated user from metadata or active profile.';
COMMENT ON FUNCTION auth_role() IS 'Returns active role of authenticated user from profiles.';
COMMENT ON FUNCTION is_admin() IS 'Returns true if authenticated user holds administrative privileges for their tenant.';
COMMENT ON FUNCTION is_staff() IS 'Returns true if authenticated user is any internal staff role.';

-- 2. Enable RLS on core tables (Migrations 002-011)

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE routers ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pppoe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotspot_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- 3. Core Tenant Isolation Policies

-- Organizations: users can only view their own organization
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'tenant_isolation_organizations_select') THEN
        CREATE POLICY tenant_isolation_organizations_select ON organizations
            FOR SELECT USING (id = auth_org_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'tenant_isolation_organizations_update') THEN
        CREATE POLICY tenant_isolation_organizations_update ON organizations
            FOR UPDATE USING (id = auth_org_id() AND is_admin())
            WITH CHECK (id = auth_org_id());
    END IF;
END $$;

-- Profiles: staff can view profiles within own org; users can view & update self
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'tenant_isolation_profiles_select') THEN
        CREATE POLICY tenant_isolation_profiles_select ON profiles
            FOR SELECT USING (organization_id = auth_org_id() OR id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'tenant_isolation_profiles_update') THEN
        CREATE POLICY tenant_isolation_profiles_update ON profiles
            FOR UPDATE USING (id = auth.uid() OR (organization_id = auth_org_id() AND is_admin()))
            WITH CHECK (organization_id = auth_org_id());
    END IF;
END $$;

-- Sites: tenant isolated
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sites' AND policyname = 'tenant_isolation_sites') THEN
        CREATE POLICY tenant_isolation_sites ON sites
            FOR ALL USING (organization_id = auth_org_id());
    END IF;
END $$;

-- Routers: tenant isolated
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'routers' AND policyname = 'tenant_isolation_routers') THEN
        CREATE POLICY tenant_isolation_routers ON routers
            FOR ALL USING (organization_id = auth_org_id());
    END IF;
END $$;

-- Plans: tenant isolated
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plans' AND policyname = 'tenant_isolation_plans') THEN
        CREATE POLICY tenant_isolation_plans ON plans
            FOR ALL USING (organization_id = auth_org_id());
    END IF;
END $$;

-- Customers: tenant isolated
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customers' AND policyname = 'tenant_isolation_customers') THEN
        CREATE POLICY tenant_isolation_customers ON customers
            FOR ALL USING (organization_id = auth_org_id());
    END IF;
END $$;

-- Subscriptions: tenant isolated
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'tenant_isolation_subscriptions') THEN
        CREATE POLICY tenant_isolation_subscriptions ON subscriptions
            FOR ALL USING (organization_id = auth_org_id());
    END IF;
END $$;

-- PPPoE Accounts: tenant isolated
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pppoe_accounts' AND policyname = 'tenant_isolation_pppoe_accounts') THEN
        CREATE POLICY tenant_isolation_pppoe_accounts ON pppoe_accounts
            FOR ALL USING (organization_id = auth_org_id());
    END IF;
END $$;

-- Voucher Batches & Hotspot Vouchers: tenant isolated
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voucher_batches' AND policyname = 'tenant_isolation_voucher_batches') THEN
        CREATE POLICY tenant_isolation_voucher_batches ON voucher_batches
            FOR ALL USING (organization_id = auth_org_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hotspot_vouchers' AND policyname = 'tenant_isolation_hotspot_vouchers') THEN
        CREATE POLICY tenant_isolation_hotspot_vouchers ON hotspot_vouchers
            FOR ALL USING (organization_id = auth_org_id());
    END IF;
END $$;

-- Invoices & Payments: tenant isolated
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'tenant_isolation_invoices') THEN
        CREATE POLICY tenant_isolation_invoices ON invoices
            FOR ALL USING (organization_id = auth_org_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'tenant_isolation_payments') THEN
        CREATE POLICY tenant_isolation_payments ON payments
            FOR ALL USING (organization_id = auth_org_id());
    END IF;
END $$;

-- Work Orders & Network Alerts: tenant isolated
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'work_orders' AND policyname = 'tenant_isolation_work_orders') THEN
        CREATE POLICY tenant_isolation_work_orders ON work_orders
            FOR ALL USING (organization_id = auth_org_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'network_alerts' AND policyname = 'tenant_isolation_network_alerts') THEN
        CREATE POLICY tenant_isolation_network_alerts ON network_alerts
            FOR ALL USING (organization_id = auth_org_id());
    END IF;
END $$;

-- Audit Log: INSERT and SELECT within organization
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_log' AND policyname = 'tenant_isolation_audit_log_select') THEN
        CREATE POLICY tenant_isolation_audit_log_select ON audit_log
            FOR SELECT USING (organization_id = auth_org_id() AND is_admin());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_log' AND policyname = 'tenant_isolation_audit_log_insert') THEN
        CREATE POLICY tenant_isolation_audit_log_insert ON audit_log
            FOR INSERT WITH CHECK (organization_id = auth_org_id() OR organization_id IS NULL);
    END IF;
END $$;
