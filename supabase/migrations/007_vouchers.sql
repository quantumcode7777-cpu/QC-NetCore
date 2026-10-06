-- ====================================================================
-- G-TECH ISP OPERATING SYSTEM
-- Migration 007: Hotspot Vouchers & Batches
-- ====================================================================

CREATE TABLE IF NOT EXISTS voucher_batches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id         UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
    batch_name      VARCHAR(100) NOT NULL,
    quantity        INT NOT NULL CHECK (quantity > 0 AND quantity <= 10000),
    prefix          VARCHAR(20),
    generated_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE voucher_batches IS 'Voucher batch generation records. Tracks who generated what and when.';

CREATE INDEX IF NOT EXISTS idx_voucher_batches_organization_id ON voucher_batches(organization_id);
CREATE INDEX IF NOT EXISTS idx_voucher_batches_plan_id ON voucher_batches(plan_id);

CREATE TABLE IF NOT EXISTS hotspot_vouchers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    batch_id            UUID REFERENCES voucher_batches(id) ON DELETE CASCADE,
    plan_id             UUID NOT NULL REFERENCES plans(id),
    code                VARCHAR(50) UNIQUE NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'
        CHECK (status IN ('AVAILABLE', 'USED', 'EXPIRED', 'DISABLED')),
    first_activated_at  TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,
    used_by_phone       VARCHAR(50),
    used_mac_address    VARCHAR(20),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE hotspot_vouchers IS 'Individual hotspot voucher codes. Status transitions: AVAILABLE → USED / EXPIRED / DISABLED.';

CREATE INDEX IF NOT EXISTS idx_hotspot_vouchers_organization_id ON hotspot_vouchers(organization_id);
CREATE INDEX IF NOT EXISTS idx_hotspot_vouchers_code ON hotspot_vouchers(code);
CREATE INDEX IF NOT EXISTS idx_hotspot_vouchers_batch_id ON hotspot_vouchers(batch_id);
CREATE INDEX IF NOT EXISTS idx_hotspot_vouchers_status ON hotspot_vouchers(status);
