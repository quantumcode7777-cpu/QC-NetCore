-- ====================================================================
-- G-TECH ISP OPERATING SYSTEM
-- Migration 006: Customers, PPPoE Accounts & Subscriptions
-- ====================================================================

-- Customers (ISP Subscriber Records)
CREATE TABLE IF NOT EXISTS customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    auth_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    account_number  VARCHAR(50) UNIQUE NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    phone_number    VARCHAR(50) NOT NULL,
    alt_phone_number VARCHAR(50),
    email           VARCHAR(255),
    national_id     VARCHAR(50),
    physical_address TEXT,
    site_id         UUID REFERENCES sites(id) ON DELETE SET NULL,
    gps_coordinates VARCHAR(100),
    status          VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('LEAD', 'PENDING_INSTALLATION', 'ACTIVE', 'SUSPENDED', 'TERMINATED')),
    balance_due     DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE customers IS 'ISP subscriber records. Sensitive PII — protected by RLS.';
COMMENT ON COLUMN customers.auth_user_id IS 'Links to Supabase Auth if customer has a self-care login. Nullable for offline-only customers.';
COMMENT ON COLUMN customers.balance_due IS 'Current outstanding balance. DECIMAL — never float.';

CREATE INDEX IF NOT EXISTS idx_customers_organization_id ON customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_account_number ON customers(account_number);
CREATE INDEX IF NOT EXISTS idx_customers_phone_number ON customers(phone_number);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_site_id ON customers(site_id);
CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id ON customers(auth_user_id);

-- PPPoE Accounts
-- SECURITY: PPPoE passwords are required by FreeRADIUS (Cleartext-Password attribute).
-- They MUST be stored server-side only and NEVER returned to browser JS.
-- password_plain is excluded from all client-facing RLS SELECT policies.
CREATE TABLE IF NOT EXISTS pppoe_accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    router_id           UUID REFERENCES routers(id) ON DELETE SET NULL,
    username            VARCHAR(100) UNIQUE NOT NULL,
    -- password_plain: Required by FreeRADIUS rlm_sql Cleartext-Password attribute.
    -- This column is accessible ONLY via server-side service-role operations.
    -- RLS ensures NO authenticated client can SELECT this column.
    password_plain      VARCHAR(100) NOT NULL,
    service_plan_id     UUID NOT NULL REFERENCES plans(id),
    ip_assignment_type  VARCHAR(20) NOT NULL DEFAULT 'POOL'
        CHECK (ip_assignment_type IN ('POOL', 'STATIC')),
    static_ip           VARCHAR(45),
    mac_address         VARCHAR(20),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE pppoe_accounts IS 'PPPoE subscriber accounts. password_plain is required for FreeRADIUS. Server-side only via service_role.';
COMMENT ON COLUMN pppoe_accounts.password_plain IS 'Cleartext required by FreeRADIUS rlm_sql. NEVER exposed to browser. RLS blocks client SELECT.';

CREATE INDEX IF NOT EXISTS idx_pppoe_organization_id ON pppoe_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_pppoe_customer_id ON pppoe_accounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_pppoe_username ON pppoe_accounts(username);
CREATE INDEX IF NOT EXISTS idx_pppoe_is_active ON pppoe_accounts(is_active);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    plan_id         UUID NOT NULL REFERENCES plans(id),
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    grace_end_time  TIMESTAMPTZ,
    status          VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'GRACE', 'SUSPENDED', 'EXPIRED', 'CANCELLED')),
    auto_renew      BOOLEAN NOT NULL DEFAULT TRUE,
    last_renewed_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_subscription_dates CHECK (end_time > start_time)
);

COMMENT ON TABLE subscriptions IS 'Active and historical service subscriptions per customer.';

CREATE INDEX IF NOT EXISTS idx_subscriptions_organization_id ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_time ON subscriptions(end_time);
