-- ====================================================================
-- Migration 025: Access Point inventory for Sites / Network Map
-- Additive and idempotent. Reuses auth_org_id() from migration 012.
-- ====================================================================

CREATE TABLE IF NOT EXISTS access_points (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    site_id             UUID REFERENCES sites(id) ON DELETE SET NULL,
    router_id           UUID REFERENCES routers(id) ON DELETE SET NULL,
    name                VARCHAR(255) NOT NULL,
    model               VARCHAR(120),
    mac_address         VARCHAR(32),
    ssid                VARCHAR(120),
    channel             VARCHAR(20),
    signal_dbm          INTEGER,
    status              VARCHAR(30) NOT NULL DEFAULT 'ONLINE'
        CHECK (status IN ('ONLINE', 'OFFLINE', 'DEGRADED', 'UNREACHABLE')),
    latitude            DECIMAL(10, 8),
    longitude           DECIMAL(11, 8),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE access_points IS 'Wireless access points grouped by network site and optional upstream MikroTik router.';

CREATE INDEX IF NOT EXISTS idx_access_points_organization_id ON access_points(organization_id);
CREATE INDEX IF NOT EXISTS idx_access_points_site_id ON access_points(site_id);
CREATE INDEX IF NOT EXISTS idx_access_points_router_id ON access_points(router_id);

ALTER TABLE access_points ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'access_points' AND policyname = 'tenant_isolation_access_points'
  ) THEN
    CREATE POLICY tenant_isolation_access_points ON access_points
      FOR ALL USING (organization_id = auth_org_id());
  END IF;
END $$;
