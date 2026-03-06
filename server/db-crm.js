const { pool } = require('./database');

async function getCustomerPreferences(customerId) {
  const res = await pool.query('SELECT pref_key, pref_value FROM customer_preferences WHERE customer_id = $1', [customerId]);
  return res.rows.reduce((o, r) => ({ ...o, [r.pref_key]: r.pref_value }), {});
}

async function setCustomerPreference(customerId, key, value) {
  await pool.query(
    `INSERT INTO customer_preferences (customer_id, pref_key, pref_value) VALUES ($1, $2, $3)
     ON CONFLICT (customer_id, pref_key) DO UPDATE SET pref_value = EXCLUDED.pref_value`,
    [customerId, key, value]
  );
}

async function getCustomerTags(customerId) {
  const res = await pool.query('SELECT tag FROM customer_tags WHERE customer_id = $1 ORDER BY tag', [customerId]);
  return res.rows.map((r) => r.tag);
}

async function addCustomerTag(customerId, tag) {
  if (!tag?.trim()) return;
  await pool.query(
    'INSERT INTO customer_tags (customer_id, tag) VALUES ($1, $2) ON CONFLICT (customer_id, tag) DO NOTHING',
    [customerId, tag.trim().toLowerCase()]
  );
}

async function removeCustomerTag(customerId, tag) {
  await pool.query('DELETE FROM customer_tags WHERE customer_id = $1 AND tag = $2', [customerId, tag]);
}

async function getCustomerNotes(customerId, limit = 50) {
  const res = await pool.query(
    `SELECT cn.*, s.name as staff_name FROM customer_notes cn
     LEFT JOIN staff s ON cn.staff_id = s.id
     WHERE cn.customer_id = $1 ORDER BY cn.created_at DESC LIMIT $2`,
    [customerId, limit]
  );
  return res.rows;
}

async function addCustomerNote(customerId, note, staffId = null) {
  const res = await pool.query(
    'INSERT INTO customer_notes (customer_id, note, staff_id) VALUES ($1, $2, $3) RETURNING *',
    [customerId, note, staffId]
  );
  return res.rows[0];
}

async function getCustomer360(customerId) {
  const db = require('./database');
  const customer = await db.getCustomerById(customerId);
  if (!customer) return null;

  const [invoices, appointments, preferences, tags, notes] = await Promise.all([
    pool.query(
      `SELECT id, invoice_number, invoice_date, total, status, paid_at FROM invoices WHERE customer_id = $1 ORDER BY invoice_date DESC LIMIT 20`,
      [customerId]
    ),
    pool.query(
      `SELECT id, appointment_date, appointment_time, services, total_amount, status FROM appointments WHERE customer_id = $1 ORDER BY appointment_date DESC LIMIT 20`,
      [customerId]
    ),
    pool.query('SELECT pref_key, pref_value FROM customer_preferences WHERE customer_id = $1', [customerId]),
    pool.query('SELECT tag FROM customer_tags WHERE customer_id = $1', [customerId]),
    pool.query(
      `SELECT cn.*, s.name as staff_name FROM customer_notes cn LEFT JOIN staff s ON cn.staff_id = s.id WHERE cn.customer_id = $1 ORDER BY cn.created_at DESC LIMIT 20`,
      [customerId]
    ),
  ]);

  const paidInvoices = await pool.query(
    'SELECT COALESCE(SUM(total), 0)::numeric as total_spent, COUNT(*)::int as visit_count FROM invoices WHERE customer_id = $1 AND status = $2',
    [customerId, 'paid']
  );
  const lastVisit = await pool.query(
    'SELECT paid_at FROM invoices WHERE customer_id = $1 AND status = $2 ORDER BY paid_at DESC LIMIT 1',
    [customerId, 'paid']
  );

  return {
    customer,
    invoices: invoices.rows,
    appointments: appointments.rows,
    preferences: preferences.rows.reduce((o, r) => ({ ...o, [r.pref_key]: r.pref_value }), {}),
    tags: tags.rows.map((r) => r.tag),
    notes: notes.rows,
    totalSpent: Number(paidInvoices.rows[0]?.total_spent || 0),
    visitCount: paidInvoices.rows[0]?.visit_count || 0,
    lastVisit: lastVisit.rows[0]?.paid_at || null,
  };
}

module.exports = {
  getCustomerPreferences,
  setCustomerPreference,
  getCustomerTags,
  addCustomerTag,
  removeCustomerTag,
  getCustomerNotes,
  addCustomerNote,
  getCustomer360,
};
