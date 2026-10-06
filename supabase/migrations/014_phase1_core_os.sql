-- ============================================================================
-- Migration 014: Phase 1 Core Operating System
-- Double-Entry Financial Ledger, Payment Reconciliation, Maker-Checker
-- Approvals, Immutable Event Bus, SOC Security Events, and Communications.
-- Strictly additive & idempotent (CREATE TABLE IF NOT EXISTS).
-- ============================================================================

-- 1. Chart of Accounts (Double-Entry Financial Ledger)
CREATE TABLE IF NOT EXISTS ledger_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('DEBIT', 'CREDIT')),
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_ledger_accounts_org ON ledger_accounts(organization_id);

-- 2. Immutable Journal Entries
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_number TEXT NOT NULL,
  reference_type TEXT NOT NULL CHECK (reference_type IN ('INVOICE', 'PAYMENT', 'CREDIT_NOTE', 'REFUND', 'WAIVER', 'ADJUSTMENT', 'REVERSAL')),
  reference_id TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  total_debit NUMERIC(14,2) NOT NULL CHECK (total_debit >= 0),
  total_credit NUMERIC(14,2) NOT NULL CHECK (total_credit >= 0),
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'REVERSED')),
  reversed_by_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
  posted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_journal_balanced CHECK (total_debit = total_credit),
  UNIQUE (organization_id, entry_number)
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_org_posted ON journal_entries(organization_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_customer ON journal_entries(customer_id);

-- 3. Journal Entry Lines
CREATE TABLE IF NOT EXISTS journal_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  debit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_line_non_negative CHECK (debit > 0 OR credit > 0)
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_org_account ON journal_lines(organization_id, account_code);

-- 4. Multi-Channel Payment Reconciliations
CREATE TABLE IF NOT EXISTS payment_reconciliations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  transaction_reference TEXT NOT NULL,
  channel TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  msisdn_phone TEXT,
  account_reference TEXT,
  matched_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  matched_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  match_status TEXT NOT NULL CHECK (match_status IN ('MATCHED', 'PARTIAL', 'OVERPAYMENT', 'UNMATCHED', 'DUPLICATE', 'MANUALLY_RESOLVED')),
  match_confidence INTEGER NOT NULL DEFAULT 100 CHECK (match_confidence BETWEEN 0 AND 100),
  allocated_to_invoice NUMERIC(12,2) NOT NULL DEFAULT 0,
  credited_to_wallet NUMERIC(12,2) NOT NULL DEFAULT 0,
  discrepancy_reason TEXT,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_org_status ON payment_reconciliations(organization_id, match_status);

-- 5. Maker-Checker Approval Requests
CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  request_number TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('REFUND', 'CREDIT_NOTE', 'WAIVER', 'BALANCE_OVERRIDE', 'BULK_DISCONNECT', 'ROUTER_SCRIPT_PUSH')),
  target_entity_type TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  target_label TEXT NOT NULL,
  amount NUMERIC(12,2),
  reason TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
  requested_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  requested_by_name TEXT NOT NULL,
  requested_by_role TEXT NOT NULL,
  decided_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  decided_by_name TEXT,
  decision_note TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_org_status ON approval_requests(organization_id, status);

-- 6. Immutable System Events (Event-Driven Architecture)
CREATE TABLE IF NOT EXISTS system_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('SUBSCRIBER', 'BILLING', 'NETWORK', 'FIELD', 'SECURITY', 'SYSTEM')),
  severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name TEXT,
  entity_type TEXT,
  entity_id TEXT,
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_events_org_created ON system_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_entity ON system_events(organization_id, entity_type, entity_id);

-- 7. Security Operations Center (SOC) Events
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_code TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  actor_email TEXT,
  source_ip TEXT,
  user_agent TEXT,
  description TEXT NOT NULL,
  mitigation_action TEXT,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_org_created ON security_events(organization_id, created_at DESC);

-- 8. Multi-Channel Notification Templates & Delivery Logs
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('SMS', 'WHATSAPP', 'EMAIL', 'IN_APP')),
  trigger_event TEXT NOT NULL,
  subject TEXT,
  body_template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code, channel)
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('SMS', 'WHATSAPP', 'EMAIL', 'IN_APP')),
  recipient TEXT NOT NULL,
  template_code TEXT,
  message_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SENT' CHECK (status IN ('QUEUED', 'SENT', 'DELIVERED', 'FAILED')),
  provider_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_org_created ON notification_logs(organization_id, created_at DESC);

-- 9. Row-Level Security Policies
ALTER TABLE ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ledger_accounts' AND policyname = 'tenant_isolation_ledger_accounts') THEN
    CREATE POLICY tenant_isolation_ledger_accounts ON ledger_accounts FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'journal_entries' AND policyname = 'tenant_isolation_journal_entries') THEN
    CREATE POLICY tenant_isolation_journal_entries ON journal_entries FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'journal_lines' AND policyname = 'tenant_isolation_journal_lines') THEN
    CREATE POLICY tenant_isolation_journal_lines ON journal_lines FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_reconciliations' AND policyname = 'tenant_isolation_payment_reconciliations') THEN
    CREATE POLICY tenant_isolation_payment_reconciliations ON payment_reconciliations FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'approval_requests' AND policyname = 'tenant_isolation_approval_requests') THEN
    CREATE POLICY tenant_isolation_approval_requests ON approval_requests FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_events' AND policyname = 'tenant_isolation_system_events') THEN
    CREATE POLICY tenant_isolation_system_events ON system_events FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'security_events' AND policyname = 'tenant_isolation_security_events') THEN
    CREATE POLICY tenant_isolation_security_events ON security_events FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_templates' AND policyname = 'tenant_isolation_notification_templates') THEN
    CREATE POLICY tenant_isolation_notification_templates ON notification_templates FOR ALL USING (organization_id = auth_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_logs' AND policyname = 'tenant_isolation_notification_logs') THEN
    CREATE POLICY tenant_isolation_notification_logs ON notification_logs FOR ALL USING (organization_id = auth_org_id());
  END IF;
END $$;
