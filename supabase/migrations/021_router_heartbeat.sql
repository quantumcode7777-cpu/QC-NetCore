-- ====================================================================
-- QC NETCORE
-- Migration 021: Router heartbeat tokens (presence without polling)
-- Additive only. A long-lived per-router token lets the router report
-- telemetry every 2 minutes over plain HTTPS; the platform derives
-- ONLINE/OFFLINE from last_seen_at instead of polling RouterOS.
-- Raw tokens live only in generated scripts; only SHA-256 hashes here.
-- ====================================================================

ALTER TABLE router_provisioning_tokens
    ADD COLUMN IF NOT EXISTS heartbeat_token_hash CHAR(64);

ALTER TABLE routers
    ADD COLUMN IF NOT EXISTS heartbeat_token_hash CHAR(64);

-- NULLs are distinct: pre-heartbeat rows stay NULL without conflicting.
CREATE UNIQUE INDEX IF NOT EXISTS uq_routers_heartbeat_token
    ON routers(heartbeat_token_hash);

COMMENT ON COLUMN router_provisioning_tokens.heartbeat_token_hash IS 'SHA-256 of the long-lived heartbeat token embedded in the bootstrap script. Copied to routers on registration.';
COMMENT ON COLUMN routers.heartbeat_token_hash IS 'SHA-256 of the routers heartbeat token. Heartbeat endpoint looks the router up by this hash.';
