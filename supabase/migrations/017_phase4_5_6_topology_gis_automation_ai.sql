-- ============================================================================
-- Migration 017: Phases 4, 5 & 6 — NOC Topology, Outage Correlation,
-- GIS Fiber/NAP Registry, Automation Rules, White-Label SaaS, Signed Webhooks,
-- and AI Operations Copilot Audit Logs.
-- Strictly additive & idempotent (CREATE TABLE IF NOT EXISTS) with RLS.
-- ============================================================================

-- 1. Network Topology Nodes & Links
CREATE TABLE IF NOT EXISTS topology_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  node_code TEXT NOT NULL,
  name TEXT NOT NULL,
  node_type TEXT NOT NULL CHECK (node_type IN ('UPSTREAM_TRANSIT', 'CORE_ROUTER', 'OLT', 'POP_SECTOR', 'NAP_SPLITTER', 'SUBSCRIBER_ONT')),
  parent_node_id UUID REFERENCES topology_nodes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ONLINE' CHECK (status IN ('ONLINE', 'DEGRADED', 'OFFLINE')),
  subscriber_count INTEGER NOT NULL DEFAULT 0,
  latency_ms NUMERIC(6,2) NOT NULL DEFAULT 4.0,
  utilization_percent INTEGER NOT NULL DEFAULT 30,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, node_code)
);

-- 2. GIS Fiber & NAP/FAT Coverage Registry
CREATE TABLE IF NOT EXISTS gis_fiber_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  code TEXT NOT NULL, -- e.g. "NAP-KIL-04"
  name TEXT NOT NULL,
  node_kind TEXT NOT NULL CHECK (node_kind IN ('POP_TOWER', 'FDC_CABINET', 'NAP_FAT_BOX', 'SPLICE_CLOSURE')),
  latitude NUMERIC(10,6) NOT NULL,
  longitude NUMERIC(10,6) NOT NULL,
  total_ports INTEGER NOT NULL DEFAULT 16,
  occupied_ports INTEGER NOT NULL DEFAULT 0 CHECK (occupied_ports >= 0),
  feeder_cable_code TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FULL', 'MAINTENANCE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

-- 3. IF-THIS-THEN-THAT Event-Driven Automation Rules
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  condition_expression TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('AUTO_RECONNECT', 'SEND_WHATSAPP_ADVISORY', 'CREATE_FIELD_TICKET', 'THROTTLE_FUP', 'REQUIRE_APPROVAL')),
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  execution_count INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. White-Label Tenant Branding & Signed Outbound Webhooks
CREATE TABLE IF NOT EXISTS tenant_branding (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  custom_domain TEXT,
  portal_Accent_color TEXT NOT NULL DEFAULT '#1f5fd1',
  invoice_footer_note TEXT NOT NULL DEFAULT 'Thank you for choosing QC NetCore High-Speed Fiber.',
  whatsapp_sender_id TEXT,
  sms_sender_id TEXT NOT NULL DEFAULT 'QCNETCORE',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_url TEXT NOT NULL,
  signing_secret_prefix TEXT NOT NULL,
  subscribed_events TEXT[] NOT NULL DEFAULT ARRAY['payment.completed', 'subscriber.suspended', 'network.outage_detected'],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_delivery_status INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. AI ISP Operations Copilot Audit Log
CREATE TABLE IF NOT EXISTS copilot_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL,
  prompt TEXT NOT NULL,
  intent TEXT NOT NULL,
  response_summary TEXT NOT NULL,
  proposed_action TEXT,
  action_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Row-Level Security
ALTER TABLE topology_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gis_fiber_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'topology_nodes' AND policyname = 'tenant_isolation_topology_nodes') THEN
    CREATE POLICY tenant_isolation_topology_nodes ON topology_nodes FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gis_fiber_nodes' AND policyname = 'tenant_isolation_gis_fiber_nodes') THEN
    CREATE POLICY tenant_isolation_gis_fiber_nodes ON gis_fiber_nodes FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'automation_rules' AND policyname = 'tenant_isolation_automation_rules') THEN
    CREATE POLICY tenant_isolation_automation_rules ON automation_rules FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tenant_branding' AND policyname = 'tenant_isolation_tenant_branding') THEN
    CREATE POLICY tenant_isolation_tenant_branding ON tenant_branding FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'webhook_endpoints' AND policyname = 'tenant_isolation_webhook_endpoints') THEN
    CREATE POLICY tenant_isolation_webhook_endpoints ON webhook_endpoints FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'copilot_audit_logs' AND policyname = 'tenant_isolation_copilot_audit_logs') THEN
    CREATE POLICY tenant_isolation_copilot_audit_logs ON copilot_audit_logs FOR ALL USING (organization_id = auth_org_id());
  END IF;
END $$;
