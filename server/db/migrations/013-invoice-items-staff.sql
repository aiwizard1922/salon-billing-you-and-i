-- Track which staff performed each service (for staff work tracking, not shown on invoice)
-- Run: psql salon_db < server/db/migrations/013-invoice-items-staff.sql

ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS staff_id INTEGER REFERENCES staff(id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_staff ON invoice_items(staff_id);
COMMENT ON COLUMN invoice_items.staff_id IS 'Staff who performed this service (for tracking, not printed on invoice)';
