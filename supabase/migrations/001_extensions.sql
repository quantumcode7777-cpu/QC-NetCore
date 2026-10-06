-- ====================================================================
-- G-TECH ISP OPERATING SYSTEM
-- Migration 001: PostgreSQL Extensions
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
