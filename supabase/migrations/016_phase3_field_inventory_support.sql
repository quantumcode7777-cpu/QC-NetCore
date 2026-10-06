-- ============================================================================
-- Migration 016: Phase 3 Field Dispatch, Inventory & SLA Support Ticketing
-- Strictly additive & idempotent (CREATE TABLE IF NOT EXISTS) with RLS.
-- ============================================================================

-- 1. Warehouse & Van Inventory Items
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('ONU_ONT', 'CPE_ROUTER', 'FIBER_CABLE', 'SPLITTER_NAP', 'SFP_OPTICS', 'CONSUMABLE')),
  unit_of_measure TEXT NOT NULL DEFAULT 'UNIT', -- 'UNIT' or 'METERS'
  quantity_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  reorder_threshold INTEGER NOT NULL DEFAULT 5,
  unit_cost_kes NUMERIC(12,2) NOT NULL DEFAULT 0,
  warehouse_location TEXT NOT NULL DEFAULT 'Main Central Store',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_org ON inventory_items(organization_id);

-- 2. Serialized Hardware Assets (ONTs, Routers, SFPs)
CREATE TABLE IF NOT EXISTS serialized_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  serial_number TEXT NOT NULL,
  mac_address TEXT,
  status TEXT NOT NULL DEFAULT 'IN_WAREHOUSE' CHECK (status IN ('IN_WAREHOUSE', 'ON_TECH_VAN', 'ASSIGNED_SUBSCRIBER', 'FAULTY_RMA')),
  assigned_technician_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  assigned_work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, serial_number)
);

-- 3. Field Proof-of-Installation Records
CREATE TABLE IF NOT EXISTS installation_proofs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  technician_name TEXT NOT NULL,
  onu_serial_number TEXT NOT NULL,
  measured_rx_dbm NUMERIC(6,2) NOT NULL,
  drop_cable_meters INTEGER NOT NULL DEFAULT 50,
  nap_box_code TEXT,
  nap_port_number INTEGER,
  gps_coordinates TEXT NOT NULL,
  customer_signoff_name TEXT NOT NULL,
  notes TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Omnichannel SLA Support Tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_number TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  account_number TEXT,
  channel TEXT NOT NULL DEFAULT 'PORTAL' CHECK (channel IN ('PORTAL', 'WHATSAPP', 'PHONE', 'NOC_AUTO')),
  category TEXT NOT NULL CHECK (category IN ('NO_INTERNET', 'SLOW_SPEED', 'LOS_RED_LIGHT', 'BILLING_QUERY', 'ROUTER_WIFI', 'RELOCATION')),
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'ESCALATED_FIELD', 'RESOLVED', 'CLOSED')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  linked_outage_id TEXT,
  sla_due_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, ticket_number)
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_org_status ON support_tickets(organization_id, status);

-- 5. Row-Level Security
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE serialized_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE installation_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_items' AND policyname = 'tenant_isolation_inventory_items') THEN
    CREATE POLICY tenant_isolation_inventory_items ON inventory_items FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'serialized_assets' AND policyname = 'tenant_isolation_serialized_assets') THEN
    CREATE POLICY tenant_isolation_serialized_assets ON serialized_assets FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'installation_proofs' AND policyname = 'tenant_isolation_installation_proofs') THEN
    CREATE POLICY tenant_isolation_installation_proofs ON installation_proofs FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'tenant_isolation_support_tickets') THEN
    CREATE POLICY tenant_isolation_support_tickets ON support_tickets FOR ALL USING (organization_id = auth_org_id());
  END IF;
END $$;
