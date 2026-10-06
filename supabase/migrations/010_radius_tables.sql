-- ====================================================================
-- G-TECH ISP OPERATING SYSTEM
-- Migration 010: FreeRADIUS rlm_sql Compatibility Tables
-- Standard FreeRADIUS schema for PostgreSQL rlm_sql module.
-- These tables are written to by FreeRADIUS and the provisioning service.
-- They should NOT be directly accessible to browser clients.
-- ====================================================================

CREATE TABLE IF NOT EXISTS radcheck (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(64) NOT NULL DEFAULT '',
    attribute   VARCHAR(64) NOT NULL DEFAULT '',
    op          CHAR(2) NOT NULL DEFAULT '==',
    value       VARCHAR(253) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_radcheck_username ON radcheck(username);

CREATE TABLE IF NOT EXISTS radreply (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(64) NOT NULL DEFAULT '',
    attribute   VARCHAR(64) NOT NULL DEFAULT '',
    op          CHAR(2) NOT NULL DEFAULT '=',
    value       VARCHAR(253) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_radreply_username ON radreply(username);

CREATE TABLE IF NOT EXISTS radusergroup (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(64) NOT NULL DEFAULT '',
    groupname   VARCHAR(64) NOT NULL DEFAULT '',
    priority    INT NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_radusergroup_username ON radusergroup(username);

CREATE TABLE IF NOT EXISTS radgroupreply (
    id          SERIAL PRIMARY KEY,
    groupname   VARCHAR(64) NOT NULL DEFAULT '',
    attribute   VARCHAR(64) NOT NULL DEFAULT '',
    op          CHAR(2) NOT NULL DEFAULT '=',
    value       VARCHAR(253) NOT NULL DEFAULT '',
    prio        INT NOT NULL DEFAULT 0
);

-- radacct: FreeRADIUS accounting (session logs)
-- Partitioned by organization_id for multi-tenant isolation
CREATE TABLE IF NOT EXISTS radacct (
    radacctid           BIGSERIAL PRIMARY KEY,
    acctsessionid       VARCHAR(64) NOT NULL DEFAULT '',
    acctuniqueid        VARCHAR(32) UNIQUE NOT NULL DEFAULT '',
    username            VARCHAR(64) NOT NULL DEFAULT '',
    realm               VARCHAR(64) DEFAULT '',
    nasipaddress        INET NOT NULL,
    nasportid           VARCHAR(32),
    nasporttype         VARCHAR(32),
    acctstarttime       TIMESTAMPTZ,
    acctupdatetime      TIMESTAMPTZ,
    acctstoptime        TIMESTAMPTZ,
    acctinterval        INT,
    acctsessiontime     BIGINT,
    acctauthentic       VARCHAR(32),
    connectinfo_start   VARCHAR(50),
    connectinfo_stop    VARCHAR(50),
    acctinputoctets     BIGINT,
    acctoutputoctets    BIGINT,
    calledstationid     VARCHAR(50) NOT NULL DEFAULT '',
    callingstationid    VARCHAR(50) NOT NULL DEFAULT '',
    acctterminatecause  VARCHAR(32) NOT NULL DEFAULT '',
    servicetype         VARCHAR(32),
    framedprotocol      VARCHAR(32),
    framedipaddress     INET,
    organization_id     UUID REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_radacct_username ON radacct(username);
CREATE INDEX IF NOT EXISTS idx_radacct_acctstarttime ON radacct(acctstarttime);
CREATE INDEX IF NOT EXISTS idx_radacct_nasipaddress ON radacct(nasipaddress);
CREATE INDEX IF NOT EXISTS idx_radacct_organization_id ON radacct(organization_id);
