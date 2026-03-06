-- Membership: value-based only (no duration, pay from balance)
-- Run: psql salon_db < server/db/migrations/008-value-based-membership.sql
-- Memberships are active when remaining_balance > 0. No date-based expiry.

-- Make duration optional (legacy, not used for validity)
ALTER TABLE membership_plans ALTER COLUMN duration_days DROP NOT NULL;
ALTER TABLE membership_plans ALTER COLUMN duration_days SET DEFAULT NULL;

-- Make end_date optional for value-based memberships
ALTER TABLE customer_memberships ALTER COLUMN end_date DROP NOT NULL;
ALTER TABLE customer_memberships ALTER COLUMN start_date DROP NOT NULL;

COMMENT ON COLUMN membership_plans.duration_days IS 'Legacy: not used. Memberships are value-based only.';
COMMENT ON COLUMN customer_memberships.remaining_balance IS 'Credit balance. Active when remaining_balance > 0. Deducted when customer pays from membership.';
