-- ====================================================================
-- G-TECH ISP OPERATING SYSTEM
-- Migration 011: Audit Log
-- Immutable audit trail for all critical administrative actions.
-- ====================================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    actor_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_email     VARCHAR(255),
    action          VARCHAR(100) NOT NULL,
    resource_type   VARCHAR(100),
    resource_id     UUID,
    old_data        JSONB,
    new_data        JSONB,
    ip_address      INET,
    user_agent      TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE audit_log IS 'Immutable audit trail. Rows must never be updated or deleted. INSERT only.';
COMMENT ON COLUMN audit_log.action IS 'Examples: user.login, customer.suspend, plan.modify, payment.refund, router.provision.';
COMMENT ON COLUMN audit_log.old_data IS 'Pre-change snapshot for update/delete events.';
COMMENT ON COLUMN audit_log.new_data IS 'Post-change snapshot.';

CREATE INDEX IF NOT EXISTS idx_audit_log_organization_id ON audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource_type ON audit_log(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
