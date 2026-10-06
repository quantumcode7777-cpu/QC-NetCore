# Database Architecture & Domain Model

## 1. Relational Schema Architecture

The database model is built on PostgreSQL 16+ utilizing UUID primary keys, normalized entity relationships, audit timestamps, and strict Row-Level Security (RLS) policies.

```
                               +-------------------+
                               |   organizations   |
                               +---------+---------+
                                         |
     +-------------------+---------------+-------------------+-------------------+
     |                   |                                   |                   |
     v                   v                                   v                   v
+----+----+      +-------+-------+                   +-------+-------+   +-------+-------+
|  users  |      |     sites     |                   |     plans     |   | payment_gate- |
+----+----+      +-------+-------+                   +-------+-------+   |     ways      |
     |                   |                                   |           +-------+-------+
     v                   v                                   v                   |
+----+----+      +-------+-------+                   +-------+-------+           v
|technici-|      |    routers    |                   | subscriptions |<----+ +---+-----------+
|  ans    |      +-------+-------+                   +-------+-------+     | |  payments /   |
+----+----+              |                                   |             | | transactions  |
     |                   v                                   v             | +---------------+
     |           +-------+-------+                   +-------+-------+     |
     +---------->|  work_orders  |                   |   customers   +-----+
                 +---------------+                   +-------+-------+
                                                             |
                                         +-------------------+-------------------+
                                         |                                       |
                                         v                                       v
                                 +-------+-------+                       +-------+-------+
                                 | pppoe_accounts|                       |hotspot_vouche-|
                                 +---------------+                       |      rs       |
                                                                         +---------------+
```

---

## 2. Core Tables & DDL Specification

### 2.1. Organization & Multi-Tenancy

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Organizations (Tenants)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    business_number VARCHAR(50), -- Registration / Tax ID
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    currency VARCHAR(10) DEFAULT 'KES',
    logo_url TEXT,
    timezone VARCHAR(50) DEFAULT 'Africa/Nairobi',
    billing_cycle_type VARCHAR(20) DEFAULT 'ANNIVERSARY', -- 'CALENDAR_MONTH' or 'ANNIVERSARY'
    grace_period_days INT DEFAULT 2,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Organization Members / Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(50),
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'isp_owner', 'isp_admin', 'finance', 'support', 'technician', 'agent', 'customer')),
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
```

### 2.2. Network Infrastructure & Routers

```sql
-- Network Sites / POPs (Point of Presence)
CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    location_description TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    power_backup_type VARCHAR(100), -- 'SOLAR', 'UPS', 'GENERATOR', 'GRID'
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sites_org ON sites(organization_id);

-- MikroTik Routers
CREATE TABLE routers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    management_ip VARCHAR(45) NOT NULL,
    api_port INT DEFAULT 8728,
    api_ssl_port INT DEFAULT 8729,
    username VARCHAR(100) NOT NULL,
    password_encrypted TEXT NOT NULL, -- AES-256-GCM encrypted
    routeros_version VARCHAR(50),
    board_model VARCHAR(100),
    cpu_load INT DEFAULT 0,
    free_memory_mb INT DEFAULT 0,
    uptime VARCHAR(100),
    connection_type VARCHAR(50) DEFAULT 'WIREGUARD' CHECK (connection_type IN ('DIRECT_PUBLIC', 'WIREGUARD', 'VPN_SSTP')),
    wireguard_public_key TEXT,
    wireguard_tunnel_ip VARCHAR(45),
    radius_secret_encrypted TEXT,
    status VARCHAR(30) DEFAULT 'OFFLINE' CHECK (status IN ('ONLINE', 'OFFLINE', 'DEGRADED', 'UNREACHABLE')),
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_routers_org ON routers(organization_id);
CREATE INDEX idx_routers_status ON routers(status);

-- IP Pools
CREATE TABLE ip_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    router_id UUID REFERENCES routers(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    subnet_cidr VARCHAR(50) NOT NULL, -- e.g. 10.10.0.0/22
    gateway VARCHAR(45) NOT NULL,
    dns_primary VARCHAR(45) DEFAULT '1.1.1.1',
    dns_secondary VARCHAR(45) DEFAULT '8.8.8.8',
    type VARCHAR(30) DEFAULT 'PPPOE' CHECK (type IN ('PPPOE', 'HOTSPOT', 'STATIC_MGMT')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### 2.3. Products & Internet Service Plans

```sql
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    service_type VARCHAR(30) NOT NULL CHECK (service_type IN ('PPPOE', 'HOTSPOT')),
    download_speed_kbps INT NOT NULL, -- e.g. 10240 for 10Mbps
    upload_speed_kbps INT NOT NULL,   -- e.g. 5120 for 5Mbps
    burst_download_kbps INT DEFAULT 0,
    burst_upload_kbps INT DEFAULT 0,
    burst_threshold_kbps INT DEFAULT 0,
    burst_time_seconds INT DEFAULT 0,
    priority INT DEFAULT 8,
    validity_duration_seconds INT NOT NULL, -- 3600 (1hr), 86400 (1d), 2592000 (30d)
    data_limit_mb BIGINT DEFAULT 0, -- 0 = Unlimited
    price DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'KES',
    simultaneous_sessions INT DEFAULT 1,
    mikrotik_rate_limit VARCHAR(255) NOT NULL, -- Formatted string for RADIUS / Queue
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_plans_org ON plans(organization_id);
CREATE INDEX idx_plans_service ON plans(service_type);
```

### 2.4. Subscribers, Subscriptions & Accounts

```sql
-- Customers / Subscribers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    account_number VARCHAR(50) UNIQUE NOT NULL, -- E.g. GT-8921
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    alt_phone_number VARCHAR(50),
    email VARCHAR(255),
    national_id VARCHAR(50),
    physical_address TEXT,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    gps_coordinates VARCHAR(100),
    lead_source VARCHAR(100),
    status VARCHAR(30) DEFAULT 'ACTIVE' CHECK (status IN ('LEAD', 'PENDING_INSTALLATION', 'ACTIVE', 'SUSPENDED', 'TERMINATED')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_org ON customers(organization_id);
CREATE INDEX idx_customers_phone ON customers(phone_number);
CREATE INDEX idx_customers_account ON customers(account_number);

-- PPPoE User Credentials
CREATE TABLE pppoe_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    router_id UUID REFERENCES routers(id) ON DELETE SET NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_plain VARCHAR(100) NOT NULL,
    service_plan_id UUID NOT NULL REFERENCES plans(id),
    ip_assignment_type VARCHAR(20) DEFAULT 'POOL' CHECK (ip_assignment_type IN ('POOL', 'STATIC')),
    static_ip VARCHAR(45),
    mac_address VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pppoe_username ON pppoe_accounts(username);
CREATE INDEX idx_pppoe_customer ON pppoe_accounts(customer_id);

-- Subscriptions Lifecycles
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    grace_end_time TIMESTAMPTZ,
    status VARCHAR(30) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'GRACE', 'SUSPENDED', 'EXPIRED', 'CANCELLED')),
    auto_renew BOOLEAN DEFAULT TRUE,
    last_renewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_end_time ON subscriptions(end_time);
```

### 2.5. Hotspot & Voucher Engine

```sql
CREATE TABLE voucher_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
    batch_name VARCHAR(100) NOT NULL,
    quantity INT NOT NULL,
    prefix VARCHAR(20),
    generated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE hotspot_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES voucher_batches(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),
    code VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(30) DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'USED', 'EXPIRED', 'DISABLED')),
    first_activated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    used_by_phone VARCHAR(50),
    used_mac_address VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vouchers_org ON hotspot_vouchers(organization_id);
CREATE INDEX idx_vouchers_code ON hotspot_vouchers(code);
CREATE INDEX idx_vouchers_status ON hotspot_vouchers(status);
```

### 2.6. Invoicing, Payments & Ledgers

```sql
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    tax_amount DECIMAL(12, 2) DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL,
    amount_paid DECIMAL(12, 2) DEFAULT 0.00,
    balance_due DECIMAL(12, 2) NOT NULL,
    status VARCHAR(30) DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID', 'WRITTEN_OFF')),
    due_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('MPESA_EXPRESS', 'MPESA_C2B', 'AIRTEL_MONEY', 'CASH', 'BANK_TRANSFER')),
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'KES',
    transaction_reference VARCHAR(100) UNIQUE NOT NULL, -- e.g. Safaricom M-Pesa Receipt Number 'RKF389HJ87'
    msisdn_phone VARCHAR(50) NOT NULL,
    sender_name VARCHAR(255),
    status VARCHAR(30) DEFAULT 'PENDING' CHECK (status IN ('INITIATED', 'PENDING', 'COMPLETED', 'FAILED', 'REVERSED')),
    raw_payload JSONB,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_org ON payments(organization_id);
CREATE INDEX idx_payments_reference ON payments(transaction_reference);
CREATE INDEX idx_payments_status ON payments(status);
```

### 2.7. FreeRADIUS Integration Tables (rlm_sql schema)

```sql
-- Standard FreeRADIUS check attributes table
CREATE TABLE radcheck (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL DEFAULT '',
    attribute VARCHAR(64) NOT NULL DEFAULT '',
    op CHAR(2) NOT NULL DEFAULT '==',
    value VARCHAR(253) NOT NULL DEFAULT ''
);
CREATE INDEX idx_radcheck_username ON radcheck(username);

-- Standard FreeRADIUS reply attributes table
CREATE TABLE radreply (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL DEFAULT '',
    attribute VARCHAR(64) NOT NULL DEFAULT '',
    op CHAR(2) NOT NULL DEFAULT '=',
    value VARCHAR(253) NOT NULL DEFAULT ''
);
CREATE INDEX idx_radreply_username ON radreply(username);

-- FreeRADIUS user-to-group mappings
CREATE TABLE radusergroup (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL DEFAULT '',
    groupname VARCHAR(64) NOT NULL DEFAULT '',
    priority INT NOT NULL DEFAULT 1
);
CREATE INDEX idx_radusergroup_username ON radusergroup(username);

-- FreeRADIUS group reply attributes
CREATE TABLE radgroupreply (
    id SERIAL PRIMARY KEY,
    groupname VARCHAR(64) NOT NULL DEFAULT '',
    attribute VARCHAR(64) NOT NULL DEFAULT '',
    op CHAR(2) NOT NULL DEFAULT '=',
    value VARCHAR(253) NOT NULL DEFAULT '',
    prio INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_radgroupreply_groupname ON radgroupreply(groupname);

-- FreeRADIUS Session Accounting Table
CREATE TABLE radacct (
    radacctid BIGSERIAL PRIMARY KEY,
    acctsessionid VARCHAR(64) NOT NULL DEFAULT '',
    acctuniqueid VARCHAR(32) NOT NULL DEFAULT '',
    username VARCHAR(64) NOT NULL DEFAULT '',
    realm VARCHAR(64) DEFAULT '',
    nasipaddress INET NOT NULL,
    nasportid VARCHAR(32) DEFAULT NULL,
    nasporttype VARCHAR(32) DEFAULT NULL,
    acctstarttime TIMESTAMPTZ NULL,
    acctupdatetime TIMESTAMPTZ NULL,
    acctstoptime TIMESTAMPTZ NULL,
    acctinterval INT DEFAULT NULL,
    acctsessiontime BIGINT DEFAULT NULL,
    acctauthentic VARCHAR(32) DEFAULT NULL,
    connectinfo_start VARCHAR(50) DEFAULT NULL,
    connectinfo_stop VARCHAR(50) DEFAULT NULL,
    acctinputoctets BIGINT DEFAULT NULL,
    acctoutputoctets BIGINT DEFAULT NULL,
    calledstationid VARCHAR(50) NOT NULL DEFAULT '',
    callingstationid VARCHAR(50) NOT NULL DEFAULT '',
    acctterminatecause VARCHAR(32) NOT NULL DEFAULT '',
    servicetype VARCHAR(32) DEFAULT NULL,
    framedprotocol VARCHAR(32) DEFAULT NULL,
    framedipaddress INET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_radacct_username ON radacct(username);
CREATE INDEX idx_radacct_sessionid ON radacct(acctsessionid);
CREATE INDEX idx_radacct_starttime ON radacct(acctstarttime);
CREATE INDEX idx_radacct_stoptime ON radacct(acctstoptime);
CREATE INDEX idx_radacct_active ON radacct(nasipaddress, acctstoptime) WHERE acctstoptime IS NULL;
```

---

## 3. PostgreSQL Row-Level Security (RLS) Policies

All tables containing `organization_id` strictly activate PostgreSQL RLS:

```sql
-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE routers ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotspot_vouchers ENABLE ROW LEVEL SECURITY;

-- Helper to retrieve caller's organization_id from JWT or Session claim
CREATE OR REPLACE FUNCTION current_user_org_id() 
RETURNS UUID AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.organization_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

-- RLS Policy Example: Customers Table
CREATE POLICY tenant_isolation_customers ON customers
    FOR ALL
    USING (organization_id = current_user_org_id())
    WITH CHECK (organization_id = current_user_org_id());

-- RLS Policy Example: Payments Table
CREATE POLICY tenant_isolation_payments ON payments
    FOR ALL
    USING (organization_id = current_user_org_id())
    WITH CHECK (organization_id = current_user_org_id());
```
