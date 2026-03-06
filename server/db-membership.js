const { pool } = require('./database');

async function recordMembershipRedemption({ customerMembershipId, invoiceId, amountRedeemed, discountPercent, staffId, staffIncentivePercent = 5 }) {
  const staffIncentiveAmount = staffId ? amountRedeemed * (staffIncentivePercent / 100) : null;
  await pool.query(
    `INSERT INTO membership_redemptions (customer_membership_id, invoice_id, amount_redeemed, discount_percent, staff_id, staff_incentive_amount)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [customerMembershipId, invoiceId, amountRedeemed, discountPercent || 0, staffId || null, staffIncentiveAmount]
  );
  await pool.query(
    `UPDATE customer_memberships SET
       usage_count = COALESCE(usage_count, 0) + 1,
       remaining_balance = GREATEST(0, COALESCE(remaining_balance, 0) - $1),
       status = CASE WHEN COALESCE(remaining_balance, 0) - $1 <= 0 THEN 'expired' ELSE status END
     WHERE id = $2`,
    [amountRedeemed, customerMembershipId]
  );
}

async function getMembershipRedemptions(customerMembershipId, limit = 50) {
  const res = await pool.query(
    `SELECT mr.*, i.invoice_number, i.invoice_date, s.name as staff_name
     FROM membership_redemptions mr
     JOIN invoices i ON mr.invoice_id = i.id
     LEFT JOIN staff s ON mr.staff_id = s.id
     WHERE mr.customer_membership_id = $1
     ORDER BY mr.created_at DESC LIMIT $2`,
    [customerMembershipId, limit]
  );
  return res.rows;
}

async function getMembershipsExpiringSoon(days = 7) {
  const res = await pool.query(
    `SELECT cm.*, mp.name as plan_name, mp.duration_days, c.name as customer_name, c.phone as customer_phone
     FROM customer_memberships cm
     JOIN membership_plans mp ON cm.plan_id = mp.id
     JOIN customers c ON cm.customer_id = c.id
     WHERE cm.status = 'active' AND cm.end_date >= CURRENT_DATE
       AND cm.end_date <= CURRENT_DATE + $1::integer
     ORDER BY cm.end_date`,
    [days]
  );
  return res.rows;
}

async function renewMembership(customerMembershipId, extendDays) {
  const res = await pool.query(
    'SELECT * FROM customer_memberships cm JOIN membership_plans mp ON cm.plan_id = mp.id WHERE cm.id = $1',
    [customerMembershipId]
  );
  const m = res.rows[0];
  if (!m) return null;
  const newEndDate = new Date(Math.max(new Date(m.end_date).getTime(), Date.now()));
  newEndDate.setDate(newEndDate.getDate() + (extendDays || m.duration_days));
  await pool.query(
    'UPDATE customer_memberships SET end_date = $1, status = $2 WHERE id = $3',
    [newEndDate.toISOString().slice(0, 10), 'active', customerMembershipId]
  );
  return pool.query('SELECT cm.*, mp.name as plan_name FROM customer_memberships cm JOIN membership_plans mp ON cm.plan_id = mp.id WHERE cm.id = $1', [customerMembershipId])
    .then((r) => r.rows[0]);
}

async function upgradeMembership(customerMembershipId, newPlanId) {
  const plan = await pool.query('SELECT * FROM membership_plans WHERE id = $1', [newPlanId]).then((r) => r.rows[0]);
  if (!plan) return null;
  const current = await pool.query('SELECT * FROM customer_memberships WHERE id = $1', [customerMembershipId]).then((r) => r.rows[0]);
  if (!current) return null;
  const creditAmount = Number(plan.special_price ?? plan.price) || 0;
  await pool.query('UPDATE customer_memberships SET status = $1 WHERE id = $2', ['upgraded', customerMembershipId]);
  const ins = await pool.query(
    `INSERT INTO customer_memberships (customer_id, plan_id, start_date, end_date, initial_balance, remaining_balance)
     VALUES ($1, $2, CURRENT_DATE, NULL, $3, $3) RETURNING *`,
    [current.customer_id, newPlanId, creditAmount]
  );
  return ins.rows[0];
}

async function topUpMembership(customerMembershipId, amount) {
  const res = await pool.query(
    `UPDATE customer_memberships SET
       remaining_balance = COALESCE(remaining_balance, 0) + $1,
       initial_balance = COALESCE(initial_balance, 0) + $1
     WHERE id = $2 RETURNING *`,
    [amount, amount, customerMembershipId]
  );
  return res.rows[0] || null;
}

async function getReminderSent(customerMembershipId, reminderType) {
  const res = await pool.query(
    'SELECT 1 FROM membership_expiry_reminders WHERE customer_membership_id = $1 AND reminder_type = $2',
    [customerMembershipId, reminderType]
  );
  return res.rows.length > 0;
}

async function markReminderSent(customerMembershipId, reminderType) {
  await pool.query(
    `INSERT INTO membership_expiry_reminders (customer_membership_id, reminder_type)
     VALUES ($1, $2)
     ON CONFLICT (customer_membership_id, reminder_type) DO NOTHING`,
    [customerMembershipId, reminderType]
  );
}

module.exports = {
  recordMembershipRedemption,
  getMembershipRedemptions,
  getMembershipsExpiringSoon,
  renewMembership,
  upgradeMembership,
  topUpMembership,
  getReminderSent,
  markReminderSent,
};
