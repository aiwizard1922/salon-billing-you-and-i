-- Fix memberships that have 0 balance but 0 uses (never used - balance was never set)
-- Run: psql salon_db < server/db/migrations/009-fix-membership-balance-backfill.sql
-- For memberships with usage_count = 0 and balance 0/null, set balance from plan price

UPDATE customer_memberships cm
SET
  initial_balance = COALESCE(mp.special_price, mp.price, 0),
  remaining_balance = COALESCE(mp.special_price, mp.price, 0),
  status = 'active'
FROM membership_plans mp
WHERE cm.plan_id = mp.id
  AND (cm.remaining_balance IS NULL OR cm.remaining_balance = 0)
  AND COALESCE(cm.usage_count, 0) = 0
  AND COALESCE(mp.special_price, mp.price, 0) > 0;
