-- ====================================================================
-- 023 — SaaS owner bills ISPs: revenue-share invoices + SMS delivery log.
-- APPLY in Supabase SQL editor (production), like 021/022.
-- ====================================================================

-- 1. Per-ISP platform fee: percent of the ISP's COMPLETED collections.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS revenue_share_pct NUMERIC(5, 2) NOT NULL DEFAULT 10.00;

-- 2. Platform -> ISP invoices (separate from subscriber `invoices`,
--    which require customer_id).
CREATE TABLE IF NOT EXISTS isp_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  period_year INT NOT NULL,
  period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  -- Snapshot at issue time (org fee may change later).
  share_pct NUMERIC(5, 2) NOT NULL,
  base_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL,
  amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(12, 2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID')),
  due_date DATE NOT NULL,
  notes TEXT,
  payment_reference VARCHAR(100),
  sent_at TIMESTAMPTZ,
  sent_to VARCHAR(50),
  paid_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_isp_invoices_org ON isp_invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_isp_invoices_status ON isp_invoices(status);

-- 3. Lock to service_role (backend writes with the service client, like 022).
ALTER TABLE isp_invoices ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'isp_invoices'
  ) THEN
    CREATE POLICY tenant_isolation_isp_invoices ON isp_invoices
      FOR ALL USING (false);
  END IF;
END $$;
