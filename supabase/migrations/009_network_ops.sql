-- ====================================================================
-- G-TECH ISP OPERATING SYSTEM
-- Migration 009: Network Operations — Work Orders & Alerts
-- ====================================================================

-- Field Operations / Work Orders
CREATE TABLE IF NOT EXISTS work_orders (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ticket_number           VARCHAR(50) UNIQUE NOT NULL,
    customer_id             UUID REFERENCES customers(id) ON DELETE SET NULL,
    assigned_technician_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    title                   VARCHAR(255) NOT NULL,
    description             TEXT NOT NULL,
    order_type              VARCHAR(30) NOT NULL DEFAULT 'INSTALLATION'
        CHECK (order_type IN ('INSTALLATION', 'REPAIR', 'SITE_MAINTENANCE', 'REMOVAL')),
    priority                VARCHAR(20) NOT NULL DEFAULT 'NORMAL'
        CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
    status                  VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    scheduled_date          DATE,
    completed_at            TIMESTAMPTZ,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE work_orders IS 'Field operations work orders for installations, repairs, and maintenance.';

CREATE INDEX IF NOT EXISTS idx_work_orders_organization_id ON work_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_customer_id ON work_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_technician_id ON work_orders(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_scheduled_date ON work_orders(scheduled_date);

-- Network Alerts
CREATE TABLE IF NOT EXISTS network_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    router_id       UUID REFERENCES routers(id) ON DELETE SET NULL,
    severity        VARCHAR(20) NOT NULL DEFAULT 'INFO'
        CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    title           VARCHAR(255) NOT NULL,
    message         TEXT NOT NULL,
    is_resolved     BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at     TIMESTAMPTZ,
    resolved_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE network_alerts IS 'Router and network event alerts. Feed for NOC dashboard.';

CREATE INDEX IF NOT EXISTS idx_network_alerts_organization_id ON network_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_network_alerts_router_id ON network_alerts(router_id);
CREATE INDEX IF NOT EXISTS idx_network_alerts_severity ON network_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_network_alerts_is_resolved ON network_alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_network_alerts_created_at ON network_alerts(created_at DESC);
