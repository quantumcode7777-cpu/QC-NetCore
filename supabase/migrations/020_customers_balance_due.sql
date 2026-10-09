-- ====================================================================
-- QC NETCORE OPERATING SYSTEM
-- Migration 020: Ensure customers.balance_due column exists safely
-- Backward-compatible schema repair for databases initialized with legacy 001 schema
-- ====================================================================

-- 1. Ensure balance_due exists on customers table with safe numeric precision and default
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS balance_due DECIMAL(12, 2) NOT NULL DEFAULT 0.00;

COMMENT ON COLUMN public.customers.balance_due IS 'Current outstanding balance. DECIMAL(12,2) — never float.';

-- 2. Safely backfill any NULL balances from unpaid invoice aggregations if invoices exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'invoices'
          AND column_name = 'balance_due'
    ) THEN
        UPDATE public.customers c
        SET balance_due = COALESCE(inv_agg.total_due, 0.00)
        FROM (
            SELECT customer_id, SUM(balance_due) AS total_due
            FROM public.invoices
            WHERE status IN ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE')
            GROUP BY customer_id
        ) inv_agg
        WHERE c.id = inv_agg.customer_id
          AND (c.balance_due = 0.00 OR c.balance_due IS NULL);
    END IF;
END $$;
