-- ====================================================================
-- G-TECH ISP OPERATING SYSTEM
-- Migration 002: Organizations (Multi-Tenant Core)
-- ====================================================================

CREATE TABLE IF NOT EXISTS organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(100) UNIQUE NOT NULL,
    business_number VARCHAR(50),
    email       VARCHAR(255) NOT NULL,
    phone       VARCHAR(50) NOT NULL,
    currency    VARCHAR(10) NOT NULL DEFAULT 'KES',
    logo_url    TEXT,
    timezone    VARCHAR(50) NOT NULL DEFAULT 'Africa/Nairobi',
    billing_cycle_type VARCHAR(20) NOT NULL DEFAULT 'ANNIVERSARY'
        CHECK (billing_cycle_type IN ('CALENDAR_MONTH', 'ANNIVERSARY')),
    grace_period_days INT NOT NULL DEFAULT 2 CHECK (grace_period_days >= 0),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE organizations IS 'ISP tenants. Each ISP operator runs under one organization.';
COMMENT ON COLUMN organizations.slug IS 'URL-safe identifier used in routing and branding.';
COMMENT ON COLUMN organizations.billing_cycle_type IS 'CALENDAR_MONTH: resets on 1st. ANNIVERSARY: resets on subscription start day.';

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON organizations(is_active);
