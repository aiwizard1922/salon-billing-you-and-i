-- Track amounts per method for split tender (e.g. cash + UPI on one invoice).
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS primary_payment_amount DECIMAL(10,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS secondary_payment_amount DECIMAL(10,2);
