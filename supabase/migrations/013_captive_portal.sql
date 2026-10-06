-- ====================================================================
-- QC NetCore
-- Migration 013: Captive Portal Customizer (multi-tenant)
--
-- * One row per configuration VERSION per organization (tenant).
-- * Lifecycle: DRAFT -> PUBLISHED -> ARCHIVED. Nothing is ever deleted,
--   so previous published designs can always be restored.
-- * At most ONE draft and ONE published row per organization (partial
--   unique indexes) -> publishing is a single atomic transaction.
-- * Tenancy reuses the existing auth_org_id() / is_admin() helpers from
--   migration 012. No second tenant system is introduced.
-- * The public captive portal NEVER reads this table directly: it goes
--   through a server route using the service role and only receives the
--   PUBLISHED config of the resolved organization.
-- ====================================================================

CREATE TABLE IF NOT EXISTS captive_portal_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    version         INT  NOT NULL CHECK (version > 0),
    status          VARCHAR(12) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    config          JSONB NOT NULL,
    -- Reserved for future custom-domain tenant resolution (e.g. wifi.exampleisp.co.ke).
    -- Not exposed to tenants yet; set by platform operators via service role.
    custom_domain   VARCHAR(253),
    created_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at    TIMESTAMPTZ,
    CONSTRAINT captive_portal_configs_org_version_key UNIQUE (organization_id, version),
    CONSTRAINT captive_portal_configs_size_chk CHECK (pg_column_size(config) < 65536)
);

COMMENT ON TABLE captive_portal_configs IS 'Versioned per-ISP captive portal design. Draft/Published/Archived lifecycle.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_captive_one_draft_per_org
    ON captive_portal_configs (organization_id) WHERE status = 'DRAFT';
CREATE UNIQUE INDEX IF NOT EXISTS uq_captive_one_published_per_org
    ON captive_portal_configs (organization_id) WHERE status = 'PUBLISHED';
CREATE UNIQUE INDEX IF NOT EXISTS uq_captive_published_domain
    ON captive_portal_configs (lower(custom_domain)) WHERE status = 'PUBLISHED' AND custom_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_captive_org_status ON captive_portal_configs (organization_id, status);

ALTER TABLE captive_portal_configs ENABLE ROW LEVEL SECURITY;

-- Admins of the organization only. Other tenants see nothing.
CREATE POLICY "captive_configs_admin_select"
    ON captive_portal_configs FOR SELECT
    USING (organization_id = auth_org_id() AND is_admin());

CREATE POLICY "captive_configs_admin_insert"
    ON captive_portal_configs FOR INSERT
    WITH CHECK (organization_id = auth_org_id() AND is_admin());

CREATE POLICY "captive_configs_admin_update"
    ON captive_portal_configs FOR UPDATE
    USING (organization_id = auth_org_id() AND is_admin())
    WITH CHECK (organization_id = auth_org_id());

-- No DELETE policy: configurations are never deleted (versioning / recovery).

-- ----------------------------------------------------------------
-- Lifecycle functions (SECURITY INVOKER => RLS above always applies)
-- The organization is ALWAYS derived from the session, never a parameter.
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION captive_save_draft(p_config JSONB)
RETURNS captive_portal_configs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_org   UUID := auth_org_id();
    v_row   captive_portal_configs;
    v_next  INT;
BEGIN
    IF v_org IS NULL OR NOT is_admin() THEN
        RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;

    UPDATE captive_portal_configs
       SET config = p_config, updated_at = now(), created_by = auth.uid()
     WHERE organization_id = v_org AND status = 'DRAFT'
     RETURNING * INTO v_row;

    IF NOT FOUND THEN
        SELECT COALESCE(MAX(version), 0) + 1 INTO v_next
          FROM captive_portal_configs WHERE organization_id = v_org;
        INSERT INTO captive_portal_configs (organization_id, version, status, config, created_by)
        VALUES (v_org, v_next, 'DRAFT', p_config, auth.uid())
        RETURNING * INTO v_row;
    END IF;
    RETURN v_row;
END;
$$;

-- Atomically: archive the live version, promote the draft. All-or-nothing.
CREATE OR REPLACE FUNCTION captive_publish()
RETURNS captive_portal_configs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_org UUID := auth_org_id();
    v_row captive_portal_configs;
BEGIN
    IF v_org IS NULL OR NOT is_admin() THEN
        RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;

    PERFORM 1 FROM captive_portal_configs
      WHERE organization_id = v_org AND status = 'DRAFT' FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'no draft to publish' USING ERRCODE = 'P0002';
    END IF;

    UPDATE captive_portal_configs
       SET status = 'ARCHIVED', updated_at = now()
     WHERE organization_id = v_org AND status = 'PUBLISHED';

    UPDATE captive_portal_configs
       SET status = 'PUBLISHED', published_at = now(), updated_at = now()
     WHERE organization_id = v_org AND status = 'DRAFT'
     RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

-- Copy any previous version back into the (single) draft. The admin can then
-- preview and publish it again — nothing live changes until they do.
CREATE OR REPLACE FUNCTION captive_restore_as_draft(p_version INT)
RETURNS captive_portal_configs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_org UUID := auth_org_id();
    v_cfg JSONB;
BEGIN
    IF v_org IS NULL OR NOT is_admin() THEN
        RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
    END IF;

    SELECT config INTO v_cfg FROM captive_portal_configs
     WHERE organization_id = v_org AND version = p_version;
    IF v_cfg IS NULL THEN
        RAISE EXCEPTION 'version not found' USING ERRCODE = 'P0002';
    END IF;

    RETURN captive_save_draft(v_cfg);
END;
$$;

REVOKE ALL ON FUNCTION captive_save_draft(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION captive_publish() FROM PUBLIC;
REVOKE ALL ON FUNCTION captive_restore_as_draft(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION captive_save_draft(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION captive_publish() TO authenticated;
GRANT EXECUTE ON FUNCTION captive_restore_as_draft(INT) TO authenticated;

-- ----------------------------------------------------------------
-- Storage: branding assets. Public-read bucket (logos/backgrounds are shown
-- on a public page anyway); WRITES restricted to the tenant's own folder:
--   portal-assets/<organization_id>/<file>
-- ----------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'portal-assets', 'portal-assets', TRUE, 1572864,
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "portal_assets_org_insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'portal-assets'
        AND (storage.foldername(name))[1] = auth_org_id()::text
        AND is_admin()
    );

CREATE POLICY "portal_assets_org_update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'portal-assets'
        AND (storage.foldername(name))[1] = auth_org_id()::text
        AND is_admin()
    );

CREATE POLICY "portal_assets_org_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'portal-assets'
        AND (storage.foldername(name))[1] = auth_org_id()::text
        AND is_admin()
    );

-- Listing/metadata reads are limited to the tenant's own folder as well.
CREATE POLICY "portal_assets_org_select"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'portal-assets'
        AND (storage.foldername(name))[1] = auth_org_id()::text
    );
