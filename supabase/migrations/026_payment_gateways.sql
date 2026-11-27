-- ====================================================================
-- Migration 026: Real Daraja payment gateway configuration + receipt link
-- Additive and idempotent. Reuses auth_org_id() from migration 012.
-- Secret columns hold AES-256-GCM ciphertext produced by APP_ENCRYPTION_KEY.
-- ====================================================================

-- Keep the M-Pesa receipt as a separate audit field. The unique
-- transaction_reference remains the STK CheckoutRequestID for initiated
-- requests, so Daraja retries cannot create duplicate ledger rows.
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS provider_receipt VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_payments_provider_receipt
    ON payments(organization_id, provider_receipt);

CREATE TABLE IF NOT EXISTS payment_gateways (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider                VARCHAR(40) NOT NULL DEFAULT 'MPESA_DARAJA'
        CHECK (provider = 'MPESA_DARAJA'),
    environment             VARCHAR(20) NOT NULL DEFAULT 'sandbox'
        CHECK (environment IN ('sandbox', 'production')),
    shortcode               VARCHAR(20) NOT NULL,
    passkey_encrypted       TEXT,
    consumer_key_encrypted  TEXT,
    consumer_secret_encrypted TEXT,
    callback_url            TEXT NOT NULL,
    confirmation_url        TEXT NOT NULL,
    validation_url          TEXT NOT NULL,
    is_enabled              BOOLEAN NOT NULL DEFAULT FALSE,
    c2b_registered_at       TIMESTAMPTZ,
    last_tested_at          TIMESTAMPTZ,
    last_error              TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, provider)
);

COMMENT ON TABLE payment_gateways IS 'Per-ISP M-Pesa Daraja credentials. Secret columns are server-side AES-256-GCM ciphertext.';
COMMENT ON COLUMN payments.provider_receipt IS 'M-Pesa receipt number returned by a successful STK/C2B callback.';

CREATE INDEX IF NOT EXISTS idx_payment_gateways_organization_id
    ON payment_gateways(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_gateways_shortcode
    ON payment_gateways(shortcode);

ALTER TABLE payment_gateways ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payment_gateways' AND policyname = 'tenant_isolation_payment_gateways'
  ) THEN
    CREATE POLICY tenant_isolation_payment_gateways ON payment_gateways
      FOR ALL USING (organization_id = auth_org_id());
  END IF;
END $$;
