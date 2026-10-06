-- ============================================================================
-- Migration 015: Phase 2 Network, OLT/ONT Fiber & TR-369 CPE Management
-- Strictly additive & idempotent (CREATE TABLE IF NOT EXISTS) with RLS.
-- ============================================================================

-- 1. Optical Line Terminals (OLTs - Huawei, ZTE, VSOL, Nokia, MikroTik)
CREATE TABLE IF NOT EXISTS olts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  router_id UUID REFERENCES routers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  vendor TEXT NOT NULL CHECK (vendor IN ('HUAWEI', 'ZTE', 'VSOL', 'NOKIA', 'FIBERHOME', 'MIKROTIK')),
  model TEXT NOT NULL,
  management_ip TEXT NOT NULL,
  snmp_port INTEGER NOT NULL DEFAULT 161,
  pon_type TEXT NOT NULL DEFAULT 'GPON' CHECK (pon_type IN ('GPON', 'EPON', 'XGS-PON')),
  total_pon_ports INTEGER NOT NULL DEFAULT 8,
  active_ont_count INTEGER NOT NULL DEFAULT 0,
  cpu_load INTEGER NOT NULL DEFAULT 12,
  temperature_c NUMERIC(5,1) NOT NULL DEFAULT 41.0,
  status TEXT NOT NULL DEFAULT 'ONLINE' CHECK (status IN ('ONLINE', 'DEGRADED', 'OFFLINE')),
  last_polled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_olts_org ON olts(organization_id);

-- 2. PON Ports on OLTs
CREATE TABLE IF NOT EXISTS pon_ports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  olt_id UUID NOT NULL REFERENCES olts(id) ON DELETE CASCADE,
  port_index TEXT NOT NULL, -- e.g. "0/1/0"
  label TEXT NOT NULL,
  tx_power_dbm NUMERIC(5,2) NOT NULL DEFAULT 4.50,
  split_ratio TEXT NOT NULL DEFAULT '1:64',
  registered_onts INTEGER NOT NULL DEFAULT 0,
  online_onts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'UP' CHECK (status IN ('UP', 'DOWN', 'LOS_ALARM')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (olt_id, port_index)
);

-- 3. Optical Network Terminals (ONT / ONU Subscriber Devices)
CREATE TABLE IF NOT EXISTS ont_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  olt_id UUID NOT NULL REFERENCES olts(id) ON DELETE CASCADE,
  pon_port_id UUID REFERENCES pon_ports(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  serial_number TEXT NOT NULL, -- e.g. "HWTC8921A4B2"
  vendor_model TEXT NOT NULL DEFAULT 'Huawei EchoLife HG8546M',
  pon_port_label TEXT NOT NULL, -- e.g. "GPON 0/1/0:12"
  rx_power_dbm NUMERIC(6,2) NOT NULL DEFAULT -19.50,
  tx_power_dbm NUMERIC(6,2) NOT NULL DEFAULT 2.40,
  olt_rx_power_dbm NUMERIC(6,2) NOT NULL DEFAULT -21.20,
  temperature_c NUMERIC(5,1) NOT NULL DEFAULT 44.0,
  voltage_v NUMERIC(4,2) NOT NULL DEFAULT 3.28,
  distance_meters INTEGER NOT NULL DEFAULT 1250,
  service_vlan INTEGER NOT NULL DEFAULT 210,
  status TEXT NOT NULL DEFAULT 'ONLINE' CHECK (status IN ('ONLINE', 'LOS', 'DYING_GASP', 'OFFLINE', 'UNPROVISIONED')),
  firmware_version TEXT NOT NULL DEFAULT 'V5R019C00S125',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, serial_number)
);

CREATE INDEX IF NOT EXISTS idx_ont_devices_org_cust ON ont_devices(organization_id, customer_id);

-- 4. TR-069 / TR-369 (USP) Customer Premises Equipment (CPE)
CREATE TABLE IF NOT EXISTS cpe_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  ont_id UUID REFERENCES ont_devices(id) ON DELETE SET NULL,
  protocol TEXT NOT NULL DEFAULT 'TR-369_USP' CHECK (protocol IN ('TR-069_CWMP', 'TR-369_USP')),
  endpoint_id TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  model TEXT NOT NULL,
  firmware_version TEXT NOT NULL,
  wan_ip TEXT,
  wifi_ssid_2g TEXT,
  wifi_ssid_5g TEXT,
  connected_lan_hosts INTEGER NOT NULL DEFAULT 0,
  uptime_seconds BIGINT NOT NULL DEFAULT 0,
  last_inform_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, endpoint_id)
);

-- 5. Fair-Use Policies (FUP) & Off-Peak Bursting Rules
CREATE TABLE IF NOT EXISTS fair_use_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  monthly_soft_cap_gb INTEGER NOT NULL DEFAULT 500,
  throttled_download_kbps INTEGER NOT NULL DEFAULT 4096,
  throttled_upload_kbps INTEGER NOT NULL DEFAULT 2048,
  night_turbo_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.50,
  night_window_start_hour INTEGER NOT NULL DEFAULT 23,
  night_window_end_hour INTEGER NOT NULL DEFAULT 6,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Row-Level Security
ALTER TABLE olts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pon_ports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ont_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE cpe_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE fair_use_policies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'olts' AND policyname = 'tenant_isolation_olts') THEN
    CREATE POLICY tenant_isolation_olts ON olts FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pon_ports' AND policyname = 'tenant_isolation_pon_ports') THEN
    CREATE POLICY tenant_isolation_pon_ports ON pon_ports FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ont_devices' AND policyname = 'tenant_isolation_ont_devices') THEN
    CREATE POLICY tenant_isolation_ont_devices ON ont_devices FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cpe_devices' AND policyname = 'tenant_isolation_cpe_devices') THEN
    CREATE POLICY tenant_isolation_cpe_devices ON cpe_devices FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fair_use_policies' AND policyname = 'tenant_isolation_fair_use_policies') THEN
    CREATE POLICY tenant_isolation_fair_use_policies ON fair_use_policies FOR ALL USING (organization_id = auth_org_id());
  END IF;
END $$;
