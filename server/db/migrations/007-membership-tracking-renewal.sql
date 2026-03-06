-- Membership: redemptions, balance tracking, staff incentives, expiry notifications
-- Run: psql salon_db < server/db/migrations/007-membership-tracking-renewal.sql

-- Value-based membership: initial_balance = total credit, remaining_balance = what's left
ALTER TABLE customer_memberships ADD COLUMN IF NOT EXISTS initial_balance DECIMAL(10,2);
ALTER TABLE customer_memberships ADD COLUMN IF NOT EXISTS remaining_balance DECIMAL(10,2);
COMMENT ON COLUMN customer_memberships.initial_balance IS 'For value-based plans: total credit when assigned';
COMMENT ON COLUMN customer_memberships.remaining_balance IS 'For value-based plans: credit left after redemptions';

-- Membership redemptions: each use of membership benefit (discount applied at checkout)
CREATE TABLE IF NOT EXISTS membership_redemptions (
  id SERIAL PRIMARY KEY,
  customer_membership_id INTEGER NOT NULL REFERENCES customer_memberships(id) ON DELETE CASCADE,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount_redeemed DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  staff_id INTEGER REFERENCES staff(id),
  staff_incentive_amount DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_redemptions_membership ON membership_redemptions(customer_membership_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_invoice ON membership_redemptions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_staff ON membership_redemptions(staff_id);

-- Expiry reminder log (avoid duplicate notifications)
CREATE TABLE IF NOT EXISTS membership_expiry_reminders (
  id SERIAL PRIMARY KEY,
  customer_membership_id INTEGER NOT NULL REFERENCES customer_memberships(id) ON DELETE CASCADE,
  reminder_type VARCHAR(20) NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  channel VARCHAR(20) DEFAULT 'whatsapp'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_expiry_reminder_once ON membership_expiry_reminders(customer_membership_id, reminder_type);

-- Staff commission % for membership redemptions
ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS staff_commission_percent DECIMAL(5,2) DEFAULT 5;
