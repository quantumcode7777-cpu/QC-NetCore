-- ====================================================================
-- G-TECH ISP OPERATING SYSTEM
-- Migration 004: Network Sites & MikroTik Routers
-- ====================================================================

-- Sites / Points of Presence
CREATE TABLE IF NOT EXISTS sites (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    location_description TEXT,
    latitude            DECIMAL(10, 8),
    longitude           DECIMAL(11, 8),
    power_backup_type   VARCHAR(20)
        CHECK (power_backup_type IN ('UPS', 'SOLAR', 'GENERATOR', 'GRID')),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE sites IS 'Physical network sites / Points of Presence (POPs) per organization.';

CREATE INDEX IF NOT EXISTS idx_sites_organization_id ON sites(organization_id);

-- MikroTik Routers
-- SECURITY: router credentials (password, radius_secret) are encrypted at application level.
-- They are NEVER exposed to the browser. Provisioning happens server-side only.
CREATE TABLE IF NOT EXISTS routers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    site_id                 UUID REFERENCES sites(id) ON DELETE SET NULL,
    name                    VARCHAR(255) NOT NULL,
    management_ip           VARCHAR(45) NOT NULL,
    api_port                INT NOT NULL DEFAULT 8728,
    api_ssl_port            INT NOT NULL DEFAULT 8729,
    username                VARCHAR(100) NOT NULL,
    -- password_encrypted: AES-256-GCM encrypted via APP_ENCRYPTION_KEY, never stored plaintext
    password_encrypted      TEXT NOT NULL,
    routeros_version        VARCHAR(50) DEFAULT 'v7',
    board_model             VARCHAR(100),
    cpu_load                INT DEFAULT 0 CHECK (cpu_load >= 0 AND cpu_load <= 100),
    free_memory_mb          INT DEFAULT 0,
    uptime                  VARCHAR(100),
    connection_type         VARCHAR(30) NOT NULL DEFAULT 'WIREGUARD'
        CHECK (connection_type IN ('DIRECT_PUBLIC', 'WIREGUARD', 'VPN_SSTP')),
    wireguard_public_key    TEXT,
    wireguard_tunnel_ip     VARCHAR(45),
    radius_secret_encrypted TEXT,
    status                  VARCHAR(30) NOT NULL DEFAULT 'ONLINE'
        CHECK (status IN ('ONLINE', 'OFFLINE', 'DEGRADED', 'UNREACHABLE')),
    last_seen_at            TIMESTAMPTZ DEFAULT now(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE routers IS 'MikroTik router fleet. All credentials stored encrypted. Never exposed to browser.';
COMMENT ON COLUMN routers.password_encrypted IS 'AES-256-GCM ciphertext of router API password. Decrypted server-side only.';
COMMENT ON COLUMN routers.radius_secret_encrypted IS 'Encrypted FreeRADIUS shared secret. Server-side only.';

CREATE INDEX IF NOT EXISTS idx_routers_organization_id ON routers(organization_id);
CREATE INDEX IF NOT EXISTS idx_routers_site_id ON routers(site_id);
CREATE INDEX IF NOT EXISTS idx_routers_status ON routers(status);
