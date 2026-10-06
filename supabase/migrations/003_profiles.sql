-- ====================================================================
-- G-TECH ISP OPERATING SYSTEM
-- Migration 003: User Profiles (linked to Supabase Auth)
-- Extends auth.users with ISP-domain attributes
-- ====================================================================

CREATE TABLE IF NOT EXISTS profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    full_name       VARCHAR(255) NOT NULL,
    phone_number    VARCHAR(50),
    avatar_url      TEXT,
    role            VARCHAR(50) NOT NULL DEFAULT 'support'
        CHECK (role IN ('super_admin', 'isp_owner', 'isp_admin', 'finance', 'support', 'technician', 'agent', 'customer')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE profiles IS 'ISP operator/staff/customer profiles extending Supabase auth.users. Never stores passwords.';
COMMENT ON COLUMN profiles.id IS 'Directly references auth.users.id — Supabase Auth is the identity provider.';
COMMENT ON COLUMN profiles.role IS 'Application-level role for RBAC. Enforced by RLS policies.';

CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);

-- Auto-create profile stub on new Supabase Auth user (requires trigger below)
-- The application must supply organization_id, full_name, and role on first sign-up.
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Profile creation is handled by the application server after signup.
    -- This trigger is a safety stub only.
    RETURN NEW;
END;
$$;
