const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testConnection() {
  try {
    await pool.query('SELECT 1');
    console.log('PostgreSQL connected');
    return true;
  } catch (err) {
    console.error('PostgreSQL error:', err.message);
    return false;
  }
}

async function getCustomers() {
  const res = await pool.query('SELECT id, name, phone, email, gender, notes, created_at FROM customers ORDER BY name');
  return res.rows;
}

async function getCustomersByIds(ids) {
  if (!ids?.length) return [];
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
  const res = await pool.query(
    `SELECT id, name, phone, email FROM customers WHERE id IN (${placeholders})`,
    ids
  );
  return res.rows;
}

async function createCustomer({ name, phone, email, gender, notes }) {
  const res = await pool.query(
    `INSERT INTO customers (name, phone, email, gender, notes) VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, phone, email, gender, notes, created_at`,
    [name, phone || null, email || null, gender || null, notes || null]
  );
  return res.rows[0];
}

async function getCustomerById(id) {
  const res = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
  return res.rows[0] || null;
}

async function getCustomerByPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  if (!last10) return null;
  const res = await pool.query(
    `SELECT * FROM customers WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = $1`,
    [last10]
  );
  return res.rows[0] || null;
}

async function findOrCreateCustomer({ name, phone }) {
  if (!name?.trim() || !phone?.trim()) return null;
  const existing = await getCustomerByPhone(phone);
  if (existing) return existing;
  return createCustomer({ name: name.trim(), phone: phone.trim() });
}

async function updateCustomer(id, { name, phone, email, gender, notes }) {
  await pool.query(
    'UPDATE customers SET name = $1, phone = $2, email = $3, gender = $4, notes = $5, updated_at = NOW() WHERE id = $6',
    [name, phone || null, email || null, gender || null, notes || null, id]
  );
  return getCustomerById(id);
}

async function getAppointments(filters = {}) {
  let query = `
    SELECT a.*, c.name as customer_name, c.phone as customer_phone
    FROM appointments a JOIN customers c ON a.customer_id = c.id WHERE 1=1
  `;
  const params = [];
  let idx = 1;
  if (filters.from) { query += ` AND a.appointment_date >= $${idx}`; params.push(filters.from); idx++; }
  if (filters.to) { query += ` AND a.appointment_date <= $${idx}`; params.push(filters.to); idx++; }
  query += ' ORDER BY a.appointment_date, a.appointment_time';
  const res = await pool.query(query, params);
  return res.rows;
}

async function createAppointment({ customerId, appointmentDate, appointmentTime, services, totalAmount, notes }) {
  const res = await pool.query(
    `INSERT INTO appointments (customer_id, appointment_date, appointment_time, services, total_amount, notes)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [customerId, appointmentDate, appointmentTime, services || [], totalAmount || 0, notes || null]
  );
  return res.rows[0];
}

async function getInvoices(filters = {}) {
  let query = `
    SELECT i.*, c.name as customer_name, c.phone as customer_phone
    FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE 1=1
  `;
  const params = [];
  let idx = 1;
  if (filters.status) { query += ` AND i.status = $${idx}`; params.push(filters.status); idx++; }
  if (filters.membershipOnly) {
    query += ` AND (LOWER(COALESCE(i.payment_method, '')) LIKE 'membership%' OR COALESCE(i.amount_from_membership, 0) > 0)`;
  }
  query += ' ORDER BY i.id DESC';
  const res = await pool.query(query, params);
  return res.rows;
}

async function getInvoiceById(id) {
  const inv = await pool.query(
    `SELECT i.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
     FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE i.id = $1`,
    [id]
  );
  const invoice = inv.rows[0];
  if (!invoice) return null;
  const items = await pool.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [id]);
  invoice.items = items.rows;
  return invoice;
}

async function getNextInvoiceNumber() {
  const res = await pool.query('SELECT invoice_number FROM invoices ORDER BY id DESC LIMIT 1');
  if (res.rows.length === 0) return 'INV-001';
  const num = parseInt(res.rows[0].invoice_number.replace(/\D/g, ''), 10) || 0;
  return `INV-${String(num + 1).padStart(3, '0')}`;
}

async function createInvoice({ customerId, items, taxPercent = 5, appointmentId, notes, staffId }) {
  const invoiceNumber = await getNextInvoiceNumber();
  const subtotal = items.reduce((s, i) => s + Number(i.unit_price) * (i.quantity || 1), 0);
  const taxAmount = (subtotal * taxPercent) / 100;
  const total = subtotal + taxAmount;

  const inv = await pool.query(
    `INSERT INTO invoices (customer_id, invoice_number, subtotal, tax_percent, tax_amount, total, appointment_id, notes, staff_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [customerId, invoiceNumber, subtotal, taxPercent, taxAmount, total, appointmentId || null, notes || null, staffId || null]
  );

  for (const item of items) {
    const qty = item.quantity || 1;
    await pool.query(
      'INSERT INTO invoice_items (invoice_id, service_name, quantity, unit_price, total) VALUES ($1, $2, $3, $4, $5)',
      [inv.rows[0].id, item.service_name, qty, item.unit_price, Number(item.unit_price) * qty]
    );
  }
  return getInvoiceById(inv.rows[0].id);
}

async function markInvoicePaid(id, paymentMethod, { amountFromMembership = null, secondaryPaymentMethod = null } = {}) {
  await pool.query(
    `UPDATE invoices SET status = 'paid', payment_method = $1, paid_at = NOW(),
     amount_from_membership = COALESCE($2, amount_from_membership),
     secondary_payment_method = $3
     WHERE id = $4`,
    [paymentMethod || 'cash', amountFromMembership, secondaryPaymentMethod, id]
  );
  return getInvoiceById(id);
}

async function getAdminByUsername(username) {
  const res = await pool.query('SELECT id, username, password_hash FROM admins WHERE username = $1', [username]);
  return res.rows[0] || null;
}

async function ensureDefaultAdmin() {
  const res = await pool.query('SELECT id FROM admins LIMIT 1');
  if (res.rows.length === 0) {
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query('INSERT INTO admins (username, password_hash) VALUES ($1, $2)', ['admin', hash]);
    console.log('Default admin created: username=admin, password=admin123');
  }
}

async function getDailySales(days = 30) {
  const res = await pool.query(
    `SELECT DATE(paid_at) as date, SUM(total)::numeric as revenue
     FROM invoices
     WHERE status = 'paid' AND paid_at >= CURRENT_DATE - INTERVAL '1 day' * $1
     GROUP BY DATE(paid_at)
     ORDER BY date`,
    [days]
  );
  return res.rows;
}

async function getMonthlySales(months = 12) {
  const res = await pool.query(
    `SELECT TO_CHAR(paid_at, 'YYYY-MM') as month, SUM(total)::numeric as revenue
     FROM invoices
     WHERE status = 'paid' AND paid_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' * $1
     GROUP BY TO_CHAR(paid_at, 'YYYY-MM')
     ORDER BY month`,
    [months]
  );
  return res.rows;
}

async function getDailySalesByMethod(days = 30) {
  const res = await pool.query(
    `SELECT DATE(paid_at) as date,
       COALESCE(SUM(CASE
         WHEN LOWER(COALESCE(payment_method, 'cash')) = 'cash' AND secondary_payment_method IS NULL THEN total
         WHEN LOWER(COALESCE(secondary_payment_method, '')) = 'cash' THEN total - COALESCE(amount_from_membership, 0)
         ELSE 0 END
       ), 0)::numeric as cash,
       COALESCE(SUM(CASE
         WHEN LOWER(COALESCE(payment_method, '')) = 'upi' AND secondary_payment_method IS NULL THEN total
         WHEN LOWER(COALESCE(secondary_payment_method, '')) = 'upi' THEN total - COALESCE(amount_from_membership, 0)
         ELSE 0 END
       ), 0)::numeric as upi,
       COALESCE(SUM(CASE
         WHEN LOWER(COALESCE(payment_method, '')) = 'card' AND secondary_payment_method IS NULL THEN total
         WHEN LOWER(COALESCE(secondary_payment_method, '')) = 'card' THEN total - COALESCE(amount_from_membership, 0)
         ELSE 0 END
       ), 0)::numeric as card
     FROM invoices
     WHERE status = 'paid' AND paid_at >= CURRENT_DATE - INTERVAL '1 day' * $1
     GROUP BY DATE(paid_at)
     ORDER BY date`,
    [days]
  );
  return res.rows.map((r) => ({
    ...r,
    cash: Number(r.cash),
    upi: Number(r.upi),
    card: Number(r.card),
    total: Number(r.cash) + Number(r.upi) + Number(r.card),
  }));
}

async function getMonthlySalesByMethod(months = 12) {
  const res = await pool.query(
    `SELECT TO_CHAR(paid_at, 'YYYY-MM') as month,
       COALESCE(SUM(CASE
         WHEN LOWER(COALESCE(payment_method, 'cash')) = 'cash' AND secondary_payment_method IS NULL THEN total
         WHEN LOWER(COALESCE(secondary_payment_method, '')) = 'cash' THEN total - COALESCE(amount_from_membership, 0)
         ELSE 0 END
       ), 0)::numeric as cash,
       COALESCE(SUM(CASE
         WHEN LOWER(COALESCE(payment_method, '')) = 'upi' AND secondary_payment_method IS NULL THEN total
         WHEN LOWER(COALESCE(secondary_payment_method, '')) = 'upi' THEN total - COALESCE(amount_from_membership, 0)
         ELSE 0 END
       ), 0)::numeric as upi,
       COALESCE(SUM(CASE
         WHEN LOWER(COALESCE(payment_method, '')) = 'card' AND secondary_payment_method IS NULL THEN total
         WHEN LOWER(COALESCE(secondary_payment_method, '')) = 'card' THEN total - COALESCE(amount_from_membership, 0)
         ELSE 0 END
       ), 0)::numeric as card
     FROM invoices
     WHERE status = 'paid' AND paid_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' * $1
     GROUP BY TO_CHAR(paid_at, 'YYYY-MM')
     ORDER BY month`,
    [months]
  );
  return res.rows.map((r) => ({
    ...r,
    cash: Number(r.cash),
    upi: Number(r.upi),
    card: Number(r.card),
    total: Number(r.cash) + Number(r.upi) + Number(r.card),
  }));
}

async function logWhatsApp(toPhone, messageType, status, errorMessage) {
  await pool.query(
    'INSERT INTO whatsapp_logs (to_phone, message_type, status, error_message) VALUES ($1, $2, $3, $4)',
    [toPhone, messageType, status, errorMessage || null]
  );
}

// --- Staff ---
async function getStaff(activeOnly = true) {
  let query = 'SELECT * FROM staff ORDER BY name';
  if (activeOnly) query = 'SELECT * FROM staff WHERE is_active = TRUE ORDER BY name';
  const res = await pool.query(query);
  return res.rows;
}

async function getStaffById(id) {
  const res = await pool.query('SELECT * FROM staff WHERE id = $1', [id]);
  return res.rows[0] || null;
}

async function createStaff({ name, phone, email, role, joinDate, notes }) {
  const res = await pool.query(
    `INSERT INTO staff (name, phone, email, role, join_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name || '', phone || null, email || null, role || null, joinDate || null, notes || null]
  );
  return res.rows[0];
}

async function updateStaff(id, { name, phone, email, role, joinDate, notes, isActive }) {
  await pool.query(
    `UPDATE staff SET name = $1, phone = $2, email = $3, role = $4, join_date = $5, notes = $6, is_active = COALESCE($7, is_active), updated_at = NOW() WHERE id = $8`,
    [name, phone || null, email || null, role || null, joinDate || null, notes || null, isActive, id]
  );
  return getStaffById(id);
}

// --- Membership plans ---
async function getMembershipPlans(activeOnly = true) {
  let query = 'SELECT * FROM membership_plans ORDER BY name';
  if (activeOnly) query = 'SELECT * FROM membership_plans WHERE is_active = TRUE ORDER BY name';
  const res = await pool.query(query);
  return res.rows;
}

async function getMembershipPlanById(id) {
  const res = await pool.query('SELECT * FROM membership_plans WHERE id = $1', [id]);
  return res.rows[0] || null;
}

async function createMembershipPlan({ name, durationDays, price, benefits, discountPercent, applyAtCheckout, specialPrice }) {
  const res = await pool.query(
    `INSERT INTO membership_plans (name, duration_days, price, benefits, discount_percent, apply_at_checkout, special_price)
     VALUES ($1, $2, $3, $4, COALESCE($5, 0), COALESCE($6, TRUE), $7) RETURNING *`,
    [name || '', durationDays ?? null, price ?? 0, benefits || null, discountPercent ?? 0, applyAtCheckout ?? true, specialPrice || null]
  );
  return res.rows[0];
}

async function updateMembershipPlan(id, { name, durationDays, price, benefits, isActive, discountPercent, applyAtCheckout, specialPrice }) {
  await pool.query(
    `UPDATE membership_plans SET name = COALESCE($1, name), duration_days = COALESCE($2, duration_days),
     price = COALESCE($3, price), benefits = COALESCE($4, benefits), is_active = COALESCE($5, is_active),
     discount_percent = COALESCE($6, discount_percent), apply_at_checkout = COALESCE($7, apply_at_checkout),
     special_price = COALESCE($8, special_price), updated_at = NOW() WHERE id = $9`,
    [name, durationDays, price, benefits, isActive, discountPercent, applyAtCheckout, specialPrice, id]
  );
  return getMembershipPlanById(id);
}

// --- Customer memberships ---
async function getCustomerMemberships(customerId = null, status = null) {
  let query = `
    SELECT cm.*, mp.name as plan_name, mp.duration_days, mp.price as plan_price, c.name as customer_name, c.phone as customer_phone
    FROM customer_memberships cm
    JOIN membership_plans mp ON cm.plan_id = mp.id
    JOIN customers c ON cm.customer_id = c.id
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;
  if (customerId) { query += ` AND cm.customer_id = $${idx}`; params.push(customerId); idx++; }
  if (status) { query += ` AND cm.status = $${idx}`; params.push(status); idx++; }
  query += ' ORDER BY cm.id DESC';
  const res = await pool.query(query, params);
  return res.rows;
}

async function assignMembershipToCustomer({ customerId, planId, startDate, endDate, notes, creditAmount }) {
  // Value-based: creditAmount = plan price (what they pay = credit they get)
  // Use CURRENT_DATE for dates when null (works even if migration 008 not run - columns may still be NOT NULL)
  const start = startDate || new Date().toISOString().slice(0, 10);
  const end = endDate || start; // placeholder; validity is based on remaining_balance only
  const credit = Number(creditAmount) || 0;
  const res = await pool.query(
    `INSERT INTO customer_memberships (customer_id, plan_id, start_date, end_date, initial_balance, remaining_balance, status, notes)
     VALUES ($1, $2, $3, $4, $5, $5, 'active', $6) RETURNING *`,
    [customerId, planId, start, end, credit, notes || null]
  );
  return res.rows[0];
}

async function getActiveMembershipForCustomer(customerId) {
  const res = await pool.query(
    `SELECT cm.*, mp.name as plan_name, mp.discount_percent, mp.apply_at_checkout, mp.price as plan_price, mp.staff_commission_percent, c.phone as customer_phone
     FROM customer_memberships cm
     JOIN membership_plans mp ON cm.plan_id = mp.id
     JOIN customers c ON cm.customer_id = c.id
     WHERE cm.customer_id = $1 AND cm.status = 'active' AND COALESCE(cm.remaining_balance, 0) > 0
     ORDER BY cm.id DESC LIMIT 1`,
    [customerId]
  );
  return res.rows[0] || null;
}

async function getMembershipByIdAndCustomer(membershipId, customerId) {
  const res = await pool.query(
    `SELECT cm.*, mp.name as plan_name, mp.staff_commission_percent, mp.price as plan_price, mp.special_price, c.phone as customer_phone
     FROM customer_memberships cm
     JOIN membership_plans mp ON cm.plan_id = mp.id
     JOIN customers c ON cm.customer_id = c.id
     WHERE cm.id = $1 AND cm.customer_id = $2 AND COALESCE(cm.remaining_balance, 0) > 0`,
    [membershipId, customerId]
  );
  return res.rows[0] || null;
}

async function getMembershipByIdAndCustomerAllowZeroBalance(membershipId, customerId) {
  const res = await pool.query(
    `SELECT cm.*, mp.name as plan_name, mp.staff_commission_percent, mp.price as plan_price, mp.special_price, c.phone as customer_phone
     FROM customer_memberships cm
     JOIN membership_plans mp ON cm.plan_id = mp.id
     JOIN customers c ON cm.customer_id = c.id
     WHERE cm.id = $1 AND cm.customer_id = $2`,
    [membershipId, customerId]
  );
  return res.rows[0] || null;
}

async function repairMembershipBalanceIfNeeded(membership) {
  if (!membership) return null;
  const usageCount = Number(membership.usage_count) || 0;
  const balance = Number(membership.remaining_balance) ?? Number(membership.initial_balance);
  if (usageCount !== 0 || (balance != null && balance > 0)) return membership;
  const creditAmount = Number(membership.special_price ?? membership.plan_price) || 0;
  if (creditAmount <= 0) return null;
  await pool.query(
    `UPDATE customer_memberships SET initial_balance = $1, remaining_balance = $1 WHERE id = $2`,
    [creditAmount, membership.id]
  );
  return { ...membership, remaining_balance: creditAmount, initial_balance: creditAmount };
}

async function getLatestMembershipForCustomer(customerId) {
  const res = await pool.query(
    `SELECT cm.*, mp.name as plan_name, mp.price as plan_price, mp.special_price, c.phone as customer_phone
     FROM customer_memberships cm
     JOIN membership_plans mp ON cm.plan_id = mp.id
     JOIN customers c ON cm.customer_id = c.id
     WHERE cm.customer_id = $1
     ORDER BY cm.id DESC LIMIT 1`,
    [customerId]
  );
  return res.rows[0] || null;
}

// --- Client analytics (visits, new vs returning, gender breakdown) ---
async function getClientAnalytics(month = null) {
  const targetMonth = month || new Date().toISOString().slice(0, 7); // YYYY-MM
  const startDate = `${targetMonth}-01`;
  const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  // Unique clients who had at least one PAID invoice this month
  const visitedRes = await pool.query(
    `SELECT DISTINCT customer_id FROM invoices
     WHERE status = 'paid' AND paid_at::date >= $1 AND paid_at::date <= $2`,
    [startDate, endDate]
  );
  const visitedIds = visitedRes.rows.map((r) => r.customer_id);
  const totalVisited = visitedIds.length;

  if (totalVisited === 0) {
    return {
      month: targetMonth,
      totalVisited: 0,
      newClients: 0,
      returningClients: 0,
      male: 0,
      female: 0,
      other: 0,
      unknownGender: 0,
    };
  }

  // New = first paid invoice ever was this month; Returning = had paid invoice before this month
  const newClientsRes = await pool.query(
    `WITH first_paid AS (
       SELECT customer_id, MIN(DATE(paid_at)) as first_paid
       FROM invoices WHERE status = 'paid' GROUP BY customer_id
     )
     SELECT customer_id FROM first_paid
     WHERE first_paid >= $1 AND first_paid <= $2 AND customer_id = ANY($3::int[])`,
    [startDate, endDate, visitedIds]
  );
  const newCount = newClientsRes.rows.length;
  const returningCount = totalVisited - newCount;

  // Gender breakdown for visited clients
  const placeholders = visitedIds.map((_, i) => `$${i + 2}`).join(', ');
  const genderRes = await pool.query(
    `SELECT COALESCE(gender, 'unknown') as gender, COUNT(*)::int as cnt
     FROM customers WHERE id IN (${placeholders})
     GROUP BY COALESCE(gender, 'unknown')`,
    visitedIds
  );
  const genderMap = { male: 0, female: 0, other: 0, unknown: 0 };
  for (const row of genderRes.rows) {
    const g = (row.gender || 'unknown').toLowerCase();
    if (g === 'male') genderMap.male = row.cnt;
    else if (g === 'female') genderMap.female = row.cnt;
    else if (g === 'other') genderMap.other = row.cnt;
    else genderMap.unknown += row.cnt;
  }

  return {
    month: targetMonth,
    totalVisited,
    newClients: newCount,
    returningClients: returningCount,
    male: genderMap.male,
    female: genderMap.female,
    other: genderMap.other,
    unknownGender: genderMap.unknown,
  };
}

module.exports = {
  pool,
  testConnection,
  getAdminByUsername,
  ensureDefaultAdmin,
  getCustomers,
  getCustomersByIds,
  getDailySales,
  getMonthlySales,
  getDailySalesByMethod,
  getMonthlySalesByMethod,
  getCustomerByPhone,
  findOrCreateCustomer,
  createCustomer,
  getCustomerById,
  updateCustomer,
  getStaff,
  getStaffById,
  createStaff,
  updateStaff,
  getMembershipPlans,
  getMembershipPlanById,
  createMembershipPlan,
  updateMembershipPlan,
  getCustomerMemberships,
  assignMembershipToCustomer,
  getActiveMembershipForCustomer,
  getMembershipByIdAndCustomer,
  getMembershipByIdAndCustomerAllowZeroBalance,
  repairMembershipBalanceIfNeeded,
  getLatestMembershipForCustomer,
  getClientAnalytics,
  getAppointments,
  createAppointment,
  getInvoices,
  getInvoiceById,
  createInvoice,
  markInvoicePaid,
  logWhatsApp,
};
