-- ====================================================================
-- 024 — ISP invoices follow the public pricing page:
--   HOTSPOT  = hotspot_share_pct % of hotspot revenue (attributed payments
--              + redeemed voucher face value in the month)
--   PPPOE    = pppoe users x pppoe_rate_usd x fx_rate (KES per USD)
--   CUSTOM   = manual line (Enterprise / adjustments)
-- RUN AFTER 023 in Supabase SQL editor (production).
-- ====================================================================

-- Platform default is 3% (was a 10% placeholder); untouched customs kept.
ALTER TABLE organizations ALTER COLUMN revenue_share_pct SET DEFAULT 3.00;
UPDATE organizations SET revenue_share_pct = 3.00 WHERE revenue_share_pct = 10.00;

-- Line-item inputs (snapshotted per invoice) + computed components.
ALTER TABLE isp_invoices
  ADD COLUMN IF NOT EXISTS hotspot_payments NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voucher_face_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pppoe_users INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pppoe_rate_usd NUMERIC(10, 4) NOT NULL DEFAULT 0.25,
  ADD COLUMN IF NOT EXISTS fx_rate NUMERIC(12, 4) NOT NULL DEFAULT 129.00,
  ADD COLUMN IF NOT EXISTS custom_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custom_label VARCHAR(100);
