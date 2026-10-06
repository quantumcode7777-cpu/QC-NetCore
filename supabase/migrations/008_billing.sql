-- ====================================================================
-- G-TECH ISP OPERATING SYSTEM
-- Migration 008: Billing — Invoices & Payments
-- All monetary values stored as DECIMAL(12,2) — never floating point.
-- ====================================================================

CREATE TABLE IF NOT EXISTS invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    invoice_number  VARCHAR(100) UNIQUE NOT NULL,
    subtotal        DECIMAL(12, 2) NOT NULL CHECK (subtotal >= 0),
    tax_amount      DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    total_amount    DECIMAL(12, 2) NOT NULL CHECK (total_amount >= 0),
    amount_paid     DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
    balance_due     DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    status          VARCHAR(30) NOT NULL DEFAULT 'UNPAID'
        CHECK (status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID')),
    due_date        DATE NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_invoice_total CHECK (total_amount = subtotal + tax_amount)
);

COMMENT ON TABLE invoices IS 'Immutable invoice records. Use VOID status rather than deletion.';

CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

CREATE TABLE IF NOT EXISTS payments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id             UUID REFERENCES customers(id) ON DELETE SET NULL,
    invoice_id              UUID REFERENCES invoices(id) ON DELETE SET NULL,
    payment_method          VARCHAR(50) NOT NULL
        CHECK (payment_method IN ('MPESA_EXPRESS', 'MPESA_C2B', 'AIRTEL_MONEY', 'CASH', 'BANK_TRANSFER')),
    amount                  DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    currency                VARCHAR(10) NOT NULL DEFAULT 'KES',
    transaction_reference   VARCHAR(100) UNIQUE NOT NULL,
    msisdn_phone            VARCHAR(50) NOT NULL,
    sender_name             VARCHAR(255),
    status                  VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('INITIATED', 'PENDING', 'COMPLETED', 'FAILED', 'REVERSED')),
    -- raw_payload: Safaricom Daraja callback JSON. JSONB for flexible provider metadata.
    raw_payload             JSONB,
    processed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE payments IS 'Immutable payment transaction ledger. Records must not be deleted. Reverse via REVERSED status.';
COMMENT ON COLUMN payments.raw_payload IS 'Raw Daraja/payment provider callback payload stored for audit/reconciliation.';
COMMENT ON COLUMN payments.transaction_reference IS 'M-Pesa receipt number or payment provider ref. Unique constraint enforces idempotency.';

CREATE INDEX IF NOT EXISTS idx_payments_organization_id ON payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_reference ON payments(transaction_reference);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_msisdn_phone ON payments(msisdn_phone);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
