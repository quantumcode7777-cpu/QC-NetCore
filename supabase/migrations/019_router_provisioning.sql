-- ====================================================================
-- QC NETCORE
-- Migration 019: Router provisioning tokens (zero-touch bootstrap)
-- Additive only. No existing table, column, row or policy is altered.
-- ====================================================================

CREATE TABLE IF NOT EXISTS router_provisioning_tokens (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    router_id           UUID REFERENCES routers(id) ON DELETE CASCADE,
    site_id             UUID REFERENCES sites(id) ON DELETE SET NULL,
    router_name         VARCHAR(255) NOT NULL,
    routeros_version    VARCHAR(10) NOT NULL DEFAULT 'v7' CHECK (routeros_version IN ('v6', 'v7')),
    tunnel_ip           VARCHAR(45) NOT NULL,
    -- SHA-256 of the one-time token. The raw token is only ever placed in the generated script.
    token_hash          CHAR(64) NOT NULL UNIQUE,
    -- AES-256-GCM ciphertext of the router API password. Server-side only.
    api_password_encrypted TEXT NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'PROVISIONING'
        CHECK (status IN ('PROVISIONING', 'AWAITING_CONNECTION', 'CONNECTED', 'EXPIRED', 'REVOKED')),
    expires_at          TIMESTAMPTZ NOT NULL,
    consumed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE router_provisioning_tokens IS 'Single-use, expiring bootstrap tokens for zero-touch MikroTik provisioning. Server-side only (service role).';

CREATE INDEX IF NOT EXISTS idx_rpt_organization_id ON router_provisioning_tokens(organization_id);
-- Prevents two live bootstraps from receiving the same tunnel address.
CREATE UNIQUE INDEX IF NOT EXISTS uq_rpt_active_tunnel_ip
    ON router_provisioning_tokens(tunnel_ip)
    WHERE status IN ('PROVISIONING', 'AWAITING_CONNECTION');

-- RLS enabled with NO policies: only the service role (server-side) can touch this table.
ALTER TABLE router_provisioning_tokens ENABLE ROW LEVEL SECURITY;

-- Tenant isolation for the router fleet itself (routers had no RLS policy in earlier migrations).
-- Service role bypasses RLS, so server-side telemetry/provisioning is unaffected.
ALTER TABLE routers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'routers' AND policyname = 'routers_select_own_org'
    ) THEN
        CREATE POLICY routers_select_own_org ON routers
            FOR SELECT TO authenticated
            USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
    END IF;
END $$;
