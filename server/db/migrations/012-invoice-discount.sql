-- Invoice discount: % off total (incl. GST)
-- Run: psql salon_db < server/db/migrations/012-invoice-discount.sql

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;

COMMENT ON COLUMN invoices.discount_percent IS 'Discount % applied to total (subtotal + GST)';
COMMENT ON COLUMN invoices.discount_amount IS 'Discount amount deducted from total';
