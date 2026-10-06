-- ====================================================================
-- G-TECH ISP OPERATING SYSTEM
-- Migration 005: Service Plans (PPPoE & Hotspot)
-- ====================================================================

CREATE TABLE IF NOT EXISTS plans (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                    VARCHAR(255) NOT NULL,
    service_type            VARCHAR(20) NOT NULL
        CHECK (service_type IN ('PPPOE', 'HOTSPOT')),
    download_speed_kbps     INT NOT NULL CHECK (download_speed_kbps > 0),
    upload_speed_kbps       INT NOT NULL CHECK (upload_speed_kbps > 0),
    burst_download_kbps     INT DEFAULT 0,
    burst_upload_kbps       INT DEFAULT 0,
    burst_threshold_kbps    INT DEFAULT 0,
    burst_time_seconds      INT DEFAULT 0,
    priority                INT NOT NULL DEFAULT 8 CHECK (priority >= 1 AND priority <= 8),
    validity_duration_seconds BIGINT NOT NULL CHECK (validity_duration_seconds > 0),
    data_limit_mb           BIGINT NOT NULL DEFAULT 0 CHECK (data_limit_mb >= 0),
    -- Use DECIMAL for monetary values — never FLOAT or DOUBLE
    price                   DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
    currency                VARCHAR(10) NOT NULL DEFAULT 'KES',
    simultaneous_sessions   INT NOT NULL DEFAULT 1 CHECK (simultaneous_sessions >= 1),
    mikrotik_rate_limit     VARCHAR(255) NOT NULL,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE plans IS 'Normalized service plans. Each subscriber references this — never duplicates plan data.';
COMMENT ON COLUMN plans.data_limit_mb IS '0 = unlimited data.';
COMMENT ON COLUMN plans.validity_duration_seconds IS 'e.g. 3600=1hr, 86400=1d, 2592000=30d.';
COMMENT ON COLUMN plans.price IS 'Stored as DECIMAL(12,2) — never floating point.';

CREATE INDEX IF NOT EXISTS idx_plans_organization_id ON plans(organization_id);
CREATE INDEX IF NOT EXISTS idx_plans_service_type ON plans(service_type);
CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active);
-- ====================================================================
-- G-TECH ISP OPERATING SYSTEM
-- Migration 005: Service Plans (PPPoE & Hotspot)
-- ====================================================================

CREATE TABLE IF NOT EXISTS plans (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                    VARCHAR(255) NOT NULL,
    service_type            VARCHAR(20) NOT NULL
        CHECK (service_type IN ('PPPOE', 'HOTSPOT')),
    download_speed_kbps     INT NOT NULL CHECK (download_speed_kbps > 0),
    upload_speed_kbps       INT NOT NULL CHECK (upload_speed_kbps > 0),
    burst_download_kbps     INT DEFAULT 0,
    burst_upload_kbps       INT DEFAULT 0,
    burst_threshold_kbps    INT DEFAULT 0,
    burst_time_seconds      INT DEFAULT 0,
    priority                INT NOT NULL DEFAULT 8 CHECK (priority >= 1 AND priority <= 8),
    validity_duration_seconds BIGINT NOT NULL CHECK (validity_duration_seconds > 0),
    data_limit_mb           BIGINT NOT NULL DEFAULT 0 CHECK (data_limit_mb >= 0),
    -- Use DECIMAL for monetary values — never FLOAT or DOUBLE
    price                   DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
    currency                VARCHAR(10) NOT NULL DEFAULT 'KES',
    simultaneous_sessions   INT NOT NULL DEFAULT 1 CHECK (simultaneous_sessions >= 1),
    mikrotik_rate_limit     VARCHAR(255) NOT NULL,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE plans IS 'Normalized service plans. Each subscriber references this — never duplicates plan data.';
COMMENT ON COLUMN plans.data_limit_mb IS '0 = unlimited data.';
COMMENT ON COLUMN plans.validity_duration_seconds IS 'e.g. 3600=1hr, 86400=1d, 2592000=30d.';
COMMENT ON COLUMN plans.price IS 'Stored as DECIMAL(12,2) — never floating point.';

CREATE INDEX IF NOT EXISTS idx_plans_organization_id ON plans(organization_id);
CREATE INDEX IF NOT EXISTS idx_plans_service_type ON plans(service_type);
CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active);
