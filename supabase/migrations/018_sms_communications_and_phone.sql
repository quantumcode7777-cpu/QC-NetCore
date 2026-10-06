-- ============================================================================
-- Migration 018: SMS Communication & Customer Phone Number Management
-- Strictly additive & idempotent. Preserves all existing data and RLS policies.
-- ============================================================================

-- 1. Extend profiles with normalized phone & verification columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT '+254';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS normalized_phone_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_org_phone ON profiles(organization_id, normalized_phone_number);

-- 2. Extend customers with normalized phone & SMS communication preferences
ALTER TABLE customers ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT '+254';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS normalized_phone_number TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sms_transactional_opt_in BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sms_marketing_opt_in BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sms_opted_out_at TIMESTAMPTZ;

-- Safely backfill normalized_phone_number for existing Kenyan customer numbers without overwriting phone_number
UPDATE customers
SET normalized_phone_number = CASE
  WHEN phone_number ~ '^\+[0-9]{9,15}$' THEN phone_number
  WHEN phone_number ~ '^254[0-9]{9}$' THEN '+' || phone_number
  WHEN phone_number ~ '^0[71][0-9]{8}$' THEN '+254' || SUBSTRING(phone_number FROM 2)
  ELSE NULL
END
WHERE normalized_phone_number IS NULL AND phone_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_org_normalized_phone ON customers(organization_id, normalized_phone_number);

-- 3. Tenant-Isolated SMS Provider Configurations (Server-Side Secrets)
CREATE TABLE IF NOT EXISTS sms_provider_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('AFRICAS_TALKING', 'TWILIO', 'GENERIC_HTTP')),
  sender_id TEXT NOT NULL DEFAULT 'QCNetCore',
  username TEXT,
  account_sid TEXT,
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  webhook_secret_encrypted TEXT,
  webhook_url TEXT,
  environment TEXT NOT NULL DEFAULT 'PRODUCTION' CHECK (environment IN ('SANDBOX', 'PRODUCTION')),
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  cost_per_segment NUMERIC(10,4),
  currency TEXT NOT NULL DEFAULT 'KES',
  cached_balance NUMERIC(12,2),
  cached_credits INTEGER,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_provider_configs_org ON sms_provider_configs(organization_id);

-- 4. Tenant-Isolated SMS Templates
CREATE TABLE IF NOT EXISTS sms_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'TRANSACTIONAL' CHECK (category IN ('TRANSACTIONAL', 'MARKETING', 'OPERATIONAL')),
  trigger_event TEXT NOT NULL,
  body_template TEXT NOT NULL,
  required_variables TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_sms_templates_org ON sms_templates(organization_id);

-- 5. Tenant-Isolated SMS Campaigns (Bulk & Targeted Dispatch)
CREATE TABLE IF NOT EXISTS sms_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_name TEXT NOT NULL,
  recipient_mode TEXT NOT NULL,
  target_filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  template_code TEXT,
  message_template TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'TRANSACTIONAL' CHECK (category IN ('TRANSACTIONAL', 'MARKETING', 'OPERATIONAL')),
  total_recipients INTEGER NOT NULL DEFAULT 0,
  valid_recipients INTEGER NOT NULL DEFAULT 0,
  skipped_opt_out INTEGER NOT NULL DEFAULT 0,
  skipped_invalid INTEGER NOT NULL DEFAULT 0,
  estimated_segments INTEGER NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'KES',
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('DRAFT', 'SCHEDULED', 'PROCESSING', 'COMPLETED', 'PARTIAL_FAILURE', 'FAILED')),
  scheduled_at TIMESTAMPTZ,
  sent_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sent_by_name TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_sms_campaigns_org_created ON sms_campaigns(organization_id, created_at DESC);

-- 6. Tenant-Isolated SMS Messages & Delivery Tracking
CREATE TABLE IF NOT EXISTS sms_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES sms_campaigns(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  account_number TEXT,
  recipient_phone TEXT NOT NULL,
  normalized_phone TEXT NOT NULL,
  message_type TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'TRANSACTIONAL' CHECK (category IN ('TRANSACTIONAL', 'MARKETING', 'OPERATIONAL')),
  message_body TEXT NOT NULL,
  character_count INTEGER NOT NULL DEFAULT 0,
  segment_count INTEGER NOT NULL DEFAULT 1,
  provider TEXT NOT NULL,
  sender_id TEXT,
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'REJECTED', 'UNKNOWN')),
  failure_reason TEXT,
  cost NUMERIC(10,4),
  currency TEXT NOT NULL DEFAULT 'KES',
  sent_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sent_by_name TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_messages_org_created ON sms_messages(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_messages_customer ON sms_messages(organization_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_provider_id ON sms_messages(provider_message_id);

-- 7. Immutable SMS Audit Log (No Provider Secrets)
CREATE TABLE IF NOT EXISTS sms_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  campaign_id UUID REFERENCES sms_campaigns(id) ON DELETE SET NULL,
  message_id UUID REFERENCES sms_messages(id) ON DELETE SET NULL,
  recipient_count INTEGER NOT NULL DEFAULT 1,
  message_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_reference TEXT,
  delivery_state TEXT NOT NULL,
  failure_reason TEXT,
  segments_used INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_audit_logs_org_created ON sms_audit_logs(organization_id, created_at DESC);

-- 8. Phone Verification OTPs
CREATE TABLE IF NOT EXISTS phone_verification_otps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  normalized_phone TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_verification_otps_user ON phone_verification_otps(user_id, created_at DESC);

-- 9. Row-Level Security Policies (Strict Multi-Tenant Isolation)
ALTER TABLE sms_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_verification_otps ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sms_provider_configs' AND policyname = 'tenant_isolation_sms_provider_configs') THEN
    CREATE POLICY tenant_isolation_sms_provider_configs ON sms_provider_configs FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sms_templates' AND policyname = 'tenant_isolation_sms_templates') THEN
    CREATE POLICY tenant_isolation_sms_templates ON sms_templates FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sms_campaigns' AND policyname = 'tenant_isolation_sms_campaigns') THEN
    CREATE POLICY tenant_isolation_sms_campaigns ON sms_campaigns FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sms_messages' AND policyname = 'tenant_isolation_sms_messages') THEN
    CREATE POLICY tenant_isolation_sms_messages ON sms_messages FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sms_audit_logs' AND policyname = 'tenant_isolation_sms_audit_logs') THEN
    CREATE POLICY tenant_isolation_sms_audit_logs ON sms_audit_logs FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'phone_verification_otps' AND policyname = 'tenant_isolation_phone_verification_otps') THEN
    CREATE POLICY tenant_isolation_phone_verification_otps ON phone_verification_otps FOR ALL USING (organization_id = auth_org_id());
  END IF;
END $$;
