-- Membership: auto-apply at checkout, package benefits
-- Run: psql salon_db < server/db/migrations/006-membership-enhancements.sql

-- Extend membership_plans
ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) DEFAULT 0;
ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS apply_at_checkout BOOLEAN DEFAULT TRUE;
ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS special_price DECIMAL(10,2);
COMMENT ON COLUMN membership_plans.discount_percent IS 'Auto-apply this % off at checkout when customer has active membership';
COMMENT ON COLUMN membership_plans.apply_at_checkout IS 'Whether to auto-apply benefit when creating invoice';
COMMENT ON COLUMN membership_plans.special_price IS 'Special offer price (if different from main price)';

-- Track membership usage
ALTER TABLE customer_memberships ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
