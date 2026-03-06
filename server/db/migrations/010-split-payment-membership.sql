-- Split payment: when membership balance < invoice total, use membership first and pay remainder via cash/UPI/card
-- Run: psql salon_db < server/db/migrations/010-split-payment-membership.sql
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_from_membership DECIMAL(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS secondary_payment_method VARCHAR(50);
