const { Pool } = require('pg');

/** Parse split tender amounts from notes (PAY_SPLIT_JSON:{"upi":1000,"cash":208}). */
function parsePaymentSplitFromNotes(notes) {
  if (notes == null || typeof notes !== 'string') return null;
  const idx = notes.lastIndexOf('PAY_SPLIT_JSON:');
  if (idx === -1) return null;
  const jsonPart = notes.slice(idx + 'PAY_SPLIT_JSON:'.length).trim();
  try {
    const o = JSON.parse(jsonPart);
    if (!o || typeof o !== 'object') return null;
    const out = {};
    for (const [k, v] of Object.entries(o)) {
      const key = String(k).toLowerCase().trim();
      if (['cash', 'upi', 'card'].includes(key)) out[key] = Number(v) || 0;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

/** Revenue attributed to cash / upi / card (split stored in notes as PAY_SPLIT_JSON; membership uses amount_from_membership). */
function sqlPaymentMethodAmount(method, tableAlias = '') {
  const p = tableAlias ? `${tableAlias}.` : '';
  const singleMethodTotal =
    method === 'cash'
      ? `LOWER(COALESCE(${p}payment_method, 'cash')) = 'cash'`
      : `LOWER(TRIM(COALESCE(${p}payment_method, ''))) = '${method}'`;
  const splitExtract = `(COALESCE(
    NULLIF(TRIM(BOTH FROM (regexp_match(COALESCE(${p}notes, '')::text, 'PAY_SPLIT_JSON:\\s*(\\{.*\\})\\s*$'))[1]), ''),
    '{}'
  )::jsonb)->>'${method}'`;
  return `(
    CASE
      WHEN COALESCE(${p}notes, '')::text ~ 'PAY_SPLIT_JSON:'
           AND COALESCE(${p}amount_from_membership, 0) = 0
           AND LOWER(COALESCE(${p}payment_method, '')) NOT LIKE 'membership%' THEN
        COALESCE(NULLIF(${splitExtract}, '')::numeric, 0)
      WHEN LOWER(COALESCE(${p}payment_method, '')) LIKE 'membership%' AND LOWER(TRIM(COALESCE(${p}secondary_payment_method, ''))) = '${method}' THEN
        ${p}total::numeric - COALESCE(${p}amount_from_membership, 0)
      WHEN ${singleMethodTotal} AND ${p}secondary_payment_method IS NULL THEN ${p}total
      WHEN LOWER(TRIM(COALESCE(${p}secondary_payment_method, ''))) = '${method}' THEN ${p}total::numeric - COALESCE(${p}amount_from_membership, 0)
      ELSE 0
    END
  )`;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Use IST (India) for all date/timestamp operations
pool.on('connect', (client) => {
  client.query("SET timezone = 'Asia/Kolkata'");
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
  const normalized = normalizePhone(phone) || phone?.trim() || null;
  const res = await pool.query(
    `INSERT INTO customers (name, phone, email, gender, notes) VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, phone, email, gender, notes, created_at`,
    [name, normalized, email || null, gender || null, notes || null]
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

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits || null;
}

async function findOrCreateCustomer({ name, phone, gender, email, notes }) {
  if (!name?.trim() || !phone?.trim()) return null;
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const existing = await getCustomerByPhone(normalized);
  if (existing) return existing;
  return createCustomer({ name: name.trim(), phone: normalized, gender: gender || null, email: email || null, notes: notes || null });
}

async function updateCustomer(id, { name, phone, email, gender, notes }) {
  await pool.query(
    'UPDATE customers SET name = $1, phone = $2, email = $3, gender = $4, notes = $5, updated_at = NOW() WHERE id = $6',
    [name, phone || null, email || null, gender || null, notes || null, id]
  );
  return getCustomerById(id);
}

async function getStaffNameMap(ids) {
  const uniq = [
    ...new Set(
      (ids || [])
        .map((id) => Number(id))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];
  if (!uniq.length) return {};
  const ph = uniq.map((_, i) => `$${i + 1}`).join(', ');
  const res = await pool.query(`SELECT id, name FROM staff WHERE id IN (${ph})`, uniq);
  return Object.fromEntries(res.rows.map((r) => [Number(r.id), r.name]));
}

function normalizeAppointmentServiceLines(serviceLines, services, staffId) {
  if (Array.isArray(serviceLines) && serviceLines.length > 0) {
    return serviceLines
      .map((L) => ({
        name: String(L.name || '').trim(),
        staffId:
          L.staffId != null && L.staffId !== '' && Number.isFinite(Number(L.staffId))
            ? Number(L.staffId)
            : null,
      }))
      .filter((L) => L.name);
  }
  const sid =
    staffId != null && staffId !== '' && Number.isFinite(Number(staffId)) ? Number(staffId) : null;
  if (Array.isArray(services)) {
    return services
      .map((name) => ({ name: String(name || '').trim(), staffId: sid }))
      .filter((L) => L.name);
  }
  return [];
}

async function enrichAppointmentRowsWithServiceLines(rows) {
  if (!rows?.length) return rows || [];
  const staffRes = await pool.query('SELECT id, name FROM staff');
  const smap = Object.fromEntries(staffRes.rows.map((r) => [Number(r.id), r.name]));
  return rows.map((r) => {
    const raw = r.service_lines;
    const hasJson = Array.isArray(raw) && raw.length > 0;
    const serviceLines = hasJson
      ? raw.map((L) => ({
          name: L.name,
          staffId: L.staffId != null && L.staffId !== '' ? Number(L.staffId) : null,
          staffName:
            L.staffId != null && L.staffId !== ''
              ? smap[Number(L.staffId)] ?? null
              : null,
        }))
      : (r.services || []).map((name) => ({
          name,
          staffId: r.staff_id != null ? Number(r.staff_id) : null,
          staffName: r.staff_name || null,
        }));
    return { ...r, serviceLines };
  });
}

async function getAppointments(filters = {}) {
  let query = `
    SELECT a.*, c.name as customer_name, c.phone as customer_phone,
           s.name AS staff_name
    FROM appointments a
    JOIN customers c ON a.customer_id = c.id
    LEFT JOIN staff s ON s.id = a.staff_id
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;
  if (filters.from) { query += ` AND a.appointment_date >= $${idx}`; params.push(filters.from); idx++; }
  if (filters.to) { query += ` AND a.appointment_date <= $${idx}`; params.push(filters.to); idx++; }
  query += ' ORDER BY a.appointment_date, a.appointment_time';
  const res = await pool.query(query, params);
  return enrichAppointmentRowsWithServiceLines(res.rows);
}

async function createAppointment({
  customerId,
  appointmentDate,
  appointmentTime,
  services,
  serviceLines,
  totalAmount,
  notes,
  staffId,
}) {
  const linesNorm = normalizeAppointmentServiceLines(serviceLines, services, staffId);
  const nameList = linesNorm.map((L) => L.name);
  const staffIdVal = linesNorm.find((L) => L.staffId != null)?.staffId ?? null;
  const res = await pool.query(
    `INSERT INTO appointments (customer_id, appointment_date, appointment_time, services, service_lines, total_amount, notes, staff_id)
     VALUES ($1, $2, $3, $4::text[], $5::jsonb, $6, $7, $8) RETURNING *`,
    [customerId, appointmentDate, appointmentTime, nameList, JSON.stringify(linesNorm), totalAmount || 0, notes || null, staffIdVal]
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
  let items;
  try {
    items = await pool.query(
      `SELECT ii.*, p.name as product_name
       FROM invoice_items ii
       LEFT JOIN products p ON ii.product_id = p.id
       WHERE ii.invoice_id = $1`,
      [id]
    );
  } catch {
    items = await pool.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [id]);
  }
  invoice.items = items.rows.map((row) => ({
    ...row,
    description: row.service_name || row.product_name || '—',
  }));
  invoice.payment_split = parsePaymentSplitFromNotes(invoice.notes);
  return invoice;
}

async function getNextInvoiceNumber() {
  const res = await pool.query('SELECT invoice_number FROM invoices ORDER BY id DESC LIMIT 1');
  if (res.rows.length === 0) return 'INV-001';
  const num = parseInt(res.rows[0].invoice_number.replace(/\D/g, ''), 10) || 0;
  return `INV-${String(num + 1).padStart(3, '0')}`;
}

async function createInvoice({
  customerId,
  items,
  taxPercent = 5,
  cgstPercent,
  sgstPercent,
  igstPercent,
  serviceTaxPercent,
  discountPercent = 0,
  discountType = 'percent',
  discountFixed = 0,
  appointmentId,
  notes,
  staffId,
}) {
  const invoiceNumber = await getNextInvoiceNumber();
  const subtotal = items.reduce((s, i) => s + Number(i.unit_price) * (i.quantity || 1), 0);

  const cGst = cgstPercent != null && cgstPercent !== '' ? Number(cgstPercent) : null;
  const sGst = sgstPercent != null && sgstPercent !== '' ? Number(sgstPercent) : null;
  const iGst = igstPercent != null && igstPercent !== '' ? Number(igstPercent) : null;
  const svcTax = serviceTaxPercent != null && serviceTaxPercent !== '' ? Number(serviceTaxPercent) : null;
  const hasComponentRates = [cGst, sGst, iGst, svcTax].some((x) => x != null && !Number.isNaN(x));
  let effectiveTaxPercent = Number(taxPercent) || 5;
  let cgstP = null;
  let sgstP = null;
  let igstP = null;
  let serviceP = null;
  if (hasComponentRates) {
    cgstP = Math.max(0, Number.isFinite(cGst) ? cGst : 0);
    sgstP = Math.max(0, Number.isFinite(sGst) ? sGst : 0);
    igstP = Math.max(0, Number.isFinite(iGst) ? iGst : 0);
    serviceP = Math.max(0, Number.isFinite(svcTax) ? svcTax : 0);
    effectiveTaxPercent = cgstP + sgstP + igstP + serviceP;
  }

  const taxAmount = (subtotal * effectiveTaxPercent) / 100;
  const totalBeforeDiscount = subtotal + taxAmount;
  let discountPct = 0;
  let discountAmount = 0;
  if (discountType === 'fixed') {
    const fixed = Math.max(0, Number(discountFixed) || 0);
    discountAmount = Math.min(fixed, totalBeforeDiscount);
    discountPct = 0;
  } else {
    discountPct = Math.max(0, Math.min(100, Number(discountPercent) || 0));
    discountAmount = (totalBeforeDiscount * discountPct) / 100;
  }
  const total = Math.round(Math.max(0, totalBeforeDiscount - discountAmount) * 100) / 100;

  const inv = await pool.query(
    `INSERT INTO invoices (customer_id, invoice_number, subtotal, tax_percent, tax_amount, discount_percent, discount_amount, total, appointment_id, notes, staff_id,
      cgst_percent, sgst_percent, igst_percent, service_tax_percent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
    [
      customerId,
      invoiceNumber,
      subtotal,
      effectiveTaxPercent,
      taxAmount,
      discountPct,
      discountAmount,
      total,
      appointmentId || null,
      notes || null,
      staffId || null,
      hasComponentRates ? cgstP : null,
      hasComponentRates ? sgstP : null,
      hasComponentRates ? igstP : null,
      hasComponentRates ? serviceP : null,
    ]
  );

  for (const item of items) {
    const qty = item.quantity || 1;
    const itemStaffId = item.staff_id ? Number(item.staff_id) : null;
    await pool.query(
      'INSERT INTO invoice_items (invoice_id, service_name, quantity, unit_price, total, staff_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [inv.rows[0].id, item.service_name, qty, item.unit_price, Number(item.unit_price) * qty, itemStaffId]
    );
  }
  return getInvoiceById(inv.rows[0].id);
}

async function markInvoicePaid(
  id,
  paymentMethod,
  {
    amountFromMembership = 0,
    secondaryPaymentMethod = null,
    paymentSplitByMethod = null,
  } = {}
) {
  let notesAppend = null;
  if (
    paymentSplitByMethod &&
    typeof paymentSplitByMethod === 'object' &&
    !Array.isArray(paymentSplitByMethod)
  ) {
    const ordered = {};
    for (const k of Object.keys(paymentSplitByMethod).sort()) {
      ordered[k] = Math.round(Number(paymentSplitByMethod[k]) * 100) / 100;
    }
    notesAppend = `PAY_SPLIT_JSON:${JSON.stringify(ordered)}`;
  }
  await pool.query(
    `UPDATE invoices SET status = 'paid', payment_method = $1, paid_at = NOW(),
     amount_from_membership = $2,
     secondary_payment_method = $3,
     notes = CASE
       WHEN $4::text IS NOT NULL AND trim($4::text) <> ''
       THEN trim(both E'\\n' from concat_ws(E'\\n', nullif(trim(both from coalesce(notes, '')), ''), trim($4::text)))
       ELSE notes
     END
     WHERE id = $5`,
    [paymentMethod || 'cash', amountFromMembership ?? 0, secondaryPaymentMethod || null, notesAppend, id]
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
       COALESCE(SUM(${sqlPaymentMethodAmount('cash')}), 0)::numeric as cash,
       COALESCE(SUM(${sqlPaymentMethodAmount('upi')}), 0)::numeric as upi,
       COALESCE(SUM(${sqlPaymentMethodAmount('card')}), 0)::numeric as card
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
       COALESCE(SUM(${sqlPaymentMethodAmount('cash')}), 0)::numeric as cash,
       COALESCE(SUM(${sqlPaymentMethodAmount('upi')}), 0)::numeric as upi,
       COALESCE(SUM(${sqlPaymentMethodAmount('card')}), 0)::numeric as card
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

/**
 * Daily report for a specific date: revenue by payment method.
 * Uses IST (Asia/Kolkata) for date matching. Expenses added in API.
 * Returns: { date, cash, upi, card, membership, revenue }
 */
async function getDailyReport(dateStr) {
  const date = dateStr || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const res = await pool.query(
    `SELECT
       COALESCE(SUM(${sqlPaymentMethodAmount('cash')}), 0)::numeric as cash,
       COALESCE(SUM(${sqlPaymentMethodAmount('upi')}), 0)::numeric as upi,
       COALESCE(SUM(${sqlPaymentMethodAmount('card')}), 0)::numeric as card,
       COALESCE(SUM(COALESCE(amount_from_membership, 0)), 0)::numeric as membership,
       COALESCE(SUM(total), 0)::numeric as revenue
     FROM invoices
     WHERE status = 'paid' AND DATE(paid_at) = $1::date`,
    [date]
  );
  const row = res.rows[0] || {};
  return {
    date,
    cash: Number(row.cash || 0),
    upi: Number(row.upi || 0),
    card: Number(row.card || 0),
    membership: Number(row.membership || 0),
    revenue: Number(row.revenue || 0),
  };
}

/**
 * Daily reports for last N days: each day's revenue by method + expenses + net.
 * Returns array of { date, cash, upi, card, membership, revenue, expenses, net }
 * Includes all days in range (zeros for days with no sales).
 */
async function getDailyReports(days = 14) {
  const revRes = await pool.query(
    `SELECT d::date::text as date,
       COALESCE(SUM(${sqlPaymentMethodAmount('cash', 'i')}), 0)::numeric as cash,
       COALESCE(SUM(${sqlPaymentMethodAmount('upi', 'i')}), 0)::numeric as upi,
       COALESCE(SUM(${sqlPaymentMethodAmount('card', 'i')}), 0)::numeric as card,
       COALESCE(SUM(COALESCE(i.amount_from_membership, 0)), 0)::numeric as membership,
       COALESCE(SUM(i.total), 0)::numeric as revenue
     FROM (
       SELECT generate_series(CURRENT_DATE - ($1 || ' days')::interval, CURRENT_DATE, '1 day'::interval)::date as d
     ) dates
     LEFT JOIN invoices i ON DATE(i.paid_at) = dates.d AND i.status = 'paid'
     GROUP BY d
     ORDER BY d DESC`,
    [days]
  );
  const expRes = await pool.query(
    `SELECT expense_date::text as date, COALESCE(SUM(amount), 0)::numeric as expenses
     FROM expenses
     WHERE expense_date >= CURRENT_DATE - INTERVAL '1 day' * $1
     GROUP BY expense_date`,
    [days]
  );
  const expMap = Object.fromEntries(expRes.rows.map((r) => [r.date, Number(r.expenses || 0)]));
  return revRes.rows.map((r) => {
    const revenue = Number(r.cash || 0) + Number(r.upi || 0) + Number(r.card || 0) + Number(r.membership || 0);
    const expenses = expMap[r.date] ?? 0;
    return {
      date: r.date,
      cash: Number(r.cash || 0),
      upi: Number(r.upi || 0),
      card: Number(r.card || 0),
      membership: Number(r.membership || 0),
      revenue,
      expenses,
      net: Math.round((revenue - expenses) * 100) / 100,
    };
  });
}

async function logWhatsApp(toPhone, messageType, status, errorMessage) {
  await pool.query(
    'INSERT INTO whatsapp_logs (to_phone, message_type, status, error_message) VALUES ($1, $2, $3, $4)',
    [toPhone, messageType, status, errorMessage || null]
  );
}

async function getWhatsAppLogs(limit = 20) {
  const res = await pool.query(
    'SELECT * FROM whatsapp_logs ORDER BY created_at DESC LIMIT $1',
    [limit]
  );
  return res.rows;
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

async function getStaffWorkHistory(filters = {}) {
  let query = `
    SELECT ii.id, ii.invoice_id as invoice_id, i.id as invoice_id, ii.service_name, ii.quantity, ii.unit_price, ii.total, ii.staff_id,
           s.name as staff_name, i.invoice_number, i.invoice_date, i.status,
           c.name as customer_name
    FROM invoice_items ii
    JOIN invoices i ON ii.invoice_id = i.id
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN staff s ON ii.staff_id = s.id
    WHERE ii.staff_id IS NOT NULL
  `;
  const params = [];
  let idx = 1;
  if (filters.staffId) { query += ` AND ii.staff_id = $${idx}`; params.push(filters.staffId); idx++; }
  if (filters.from) { query += ` AND i.invoice_date >= $${idx}`; params.push(filters.from); idx++; }
  if (filters.to) { query += ` AND i.invoice_date <= $${idx}`; params.push(filters.to); idx++; }
  query += ' ORDER BY i.invoice_date DESC, ii.id DESC';
  const res = await pool.query(query, params);
  return res.rows;
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
    SELECT cm.*, mp.name as plan_name, mp.duration_days, mp.price as plan_price, mp.special_price, c.name as customer_name, c.phone as customer_phone
    FROM customer_memberships cm
    JOIN membership_plans mp ON cm.plan_id = mp.id
    JOIN customers c ON cm.customer_id = c.id
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;
  if (customerId) { query += ` AND cm.customer_id = $${idx}`; params.push(customerId); idx++; }
  if (status) { query += ` AND cm.status = $${idx}`; params.push(status); idx++; }
  else { query += ` AND cm.status != 'upgraded'`; }
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
// Based on INVOICE DATE (invoice_date) - the business date on the invoice. Matches user expectation ("invoices in Feb").
function getISTMonth() {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' });
  const parts = f.formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year').value;
  const m = parts.find((p) => p.type === 'month').value;
  return `${y}-${m}`;
}

/**
 * Last calendar day of month YYYY-MM as YYYY-MM-DD.
 * Avoids `new Date('YYYY-MM-01')` (parsed as UTC → wrong getMonth() in western zones) and
 * avoids `toISOString().slice(0, 10)` (UTC can shift the calendar day vs local).
 */
function lastDayOfMonthYmd(targetMonth) {
  const [ys, ms] = String(targetMonth).split('-');
  const y = parseInt(ys, 10);
  const m = parseInt(ms, 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  const d = new Date(y, m, 0);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function getClientAnalytics(month = null) {
  const targetMonth = month || getISTMonth();
  const startDate = `${targetMonth}-01`;
  const endDate = lastDayOfMonthYmd(targetMonth);
  if (!endDate) {
    throw new Error(`Invalid month: ${targetMonth}`);
  }

  // Use invoice_date (business date). Include invoices where EITHER invoice_date OR created_at falls in month.
  // Handles both: timestamps stored as UTC or as local (IST).
  const invDateCol = 'invoice_date';
  const createdIstDate = `(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date`;
  const createdLocalDate = `(created_at AT TIME ZONE 'Asia/Kolkata')::date`;

  // Unique customers with at least one invoice in this month (invoice_date OR created_at in range)
  const visitedRes = await pool.query(
    `SELECT DISTINCT customer_id FROM invoices
     WHERE (${invDateCol} >= $1 AND ${invDateCol} <= $2)
        OR (${createdIstDate} >= $1 AND ${createdIstDate} <= $2)
        OR (${createdLocalDate} >= $1 AND ${createdLocalDate} <= $2)`,
    [startDate, endDate]
  );
  const visitedIds = visitedRes.rows.map((r) => r.customer_id);
  const totalVisited = visitedIds.length;

  if (totalVisited === 0) {
    // Help user find data: return date range and sample of invoice dates for debugging
    const rangeRes = await pool.query(
      `SELECT MIN(invoice_date) as min_date, MAX(invoice_date) as max_date, COUNT(*)::int as total FROM invoices`
    );
    const sampleRes = await pool.query(
      `SELECT id, invoice_number, invoice_date, created_at,
        (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date as created_ist,
        (created_at AT TIME ZONE 'Asia/Kolkata')::date as created_local
       FROM invoices ORDER BY id DESC LIMIT 5`
    );
    const r = rangeRes.rows[0];
    return {
      month: targetMonth,
      totalVisited: 0,
      newClients: 0,
      returningClients: 0,
      dailyStats: [],
      male: 0,
      female: 0,
      other: 0,
      unknownGender: 0,
      invoiceDateRange: r?.total > 0 ? { min: r.min_date, max: r.max_date, totalInvoices: r.total } : null,
      _debug: { startDate, endDate, sampleInvoices: sampleRes.rows },
    };
  }

  // Daily breakdown: for each day, new count + returning count
  const dailyRes = await pool.query(
    `WITH first_inv AS (
       SELECT customer_id, MIN(${invDateCol}) as first_date
       FROM invoices GROUP BY customer_id
     ),
     daily_invoices AS (
       SELECT customer_id, ${invDateCol} as inv_date
       FROM invoices
       WHERE ${invDateCol} >= $1 AND ${invDateCol} <= $2
     )
     SELECT d.inv_date as date,
       COUNT(DISTINCT CASE WHEN f.first_date = d.inv_date THEN d.customer_id END)::int as new_count,
       COUNT(DISTINCT CASE WHEN f.first_date < d.inv_date THEN d.customer_id END)::int as returning_count
     FROM daily_invoices d
     JOIN first_inv f ON f.customer_id = d.customer_id
     GROUP BY d.inv_date
     ORDER BY d.inv_date`,
    [startDate, endDate]
  );

  const dailyStats = dailyRes.rows.map((r) => ({
    date: r.date,
    newCount: Number(r.new_count) || 0,
    returningCount: Number(r.returning_count) || 0,
    total: (Number(r.new_count) || 0) + (Number(r.returning_count) || 0),
  }));

  // New = first invoice ever was this month; Returning = had invoice before this month
  const newClientsRes = await pool.query(
    `WITH first_inv AS (
       SELECT customer_id, MIN(${invDateCol}) as first_date
       FROM invoices GROUP BY customer_id
     )
     SELECT customer_id FROM first_inv
     WHERE first_date >= $1 AND first_date <= $2 AND customer_id = ANY($3::int[])`,
    [startDate, endDate, visitedIds]
  );
  const newCount = newClientsRes.rows.length;
  const returningCount = totalVisited - newCount;

  // Gender: from customer profile (customers.gender). Set when creating/editing customers.
  let genderMap = { male: 0, female: 0, other: 0, unknown: 0 };
  if (visitedIds.length > 0) {
    const placeholders = visitedIds.map((_, i) => `$${i + 1}`).join(', ');
    const genderRes = await pool.query(
      `SELECT COALESCE(LOWER(TRIM(gender)), 'unknown') as gender, COUNT(*)::int as cnt
       FROM customers WHERE id IN (${placeholders})
       GROUP BY COALESCE(LOWER(TRIM(gender)), 'unknown')`,
      visitedIds
    );
    for (const row of genderRes.rows) {
      const g = (row.gender || 'unknown').toLowerCase();
      if (g === 'male') genderMap.male = row.cnt;
      else if (g === 'female') genderMap.female = row.cnt;
      else if (g === 'other') genderMap.other = row.cnt;
      else genderMap.unknown += row.cnt;
    }
  }

  return {
    month: targetMonth,
    totalVisited,
    newClients: newCount,
    returningClients: returningCount,
    dailyStats,
    male: genderMap.male,
    female: genderMap.female,
    other: genderMap.other,
    unknownGender: genderMap.unknown,
  };
}

/**
 * Client counts for an inclusive date range (YYYY-MM-DD). Uses the same "visited" rule as
 * getClientAnalytics: invoice_date in range OR created_at interpreted as IST calendar date in range.
 * New = first-ever invoice_date (globally) falls in this range; returning = visited minus new.
 */
async function getClientInsightForPeriod(startDate, endDate) {
  const invDateCol = 'invoice_date';
  const createdIstDate = `(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date`;
  const createdLocalDate = `(created_at AT TIME ZONE 'Asia/Kolkata')::date`;

  const { rows } = await pool.query(
    `WITH visited AS (
       SELECT DISTINCT customer_id
       FROM invoices
       WHERE (${invDateCol} >= $1 AND ${invDateCol} <= $2)
          OR (${createdIstDate} >= $1 AND ${createdIstDate} <= $2)
          OR (${createdLocalDate} >= $1 AND ${createdLocalDate} <= $2)
     ),
     first_inv AS (
       SELECT customer_id, MIN(${invDateCol}) AS first_date
       FROM invoices GROUP BY customer_id
     )
     SELECT
       COUNT(DISTINCT v.customer_id)::int AS total_visited,
       COUNT(DISTINCT CASE
         WHEN fi.first_date >= $1 AND fi.first_date <= $2 THEN v.customer_id
       END)::int AS new_clients,
       COUNT(DISTINCT CASE
         WHEN LOWER(TRIM(COALESCE(c.gender, ''))) = 'male' THEN v.customer_id
       END)::int AS male,
       COUNT(DISTINCT CASE
         WHEN LOWER(TRIM(COALESCE(c.gender, ''))) = 'female' THEN v.customer_id
       END)::int AS female,
       COUNT(DISTINCT CASE
         WHEN LOWER(TRIM(COALESCE(c.gender, ''))) = 'other' THEN v.customer_id
       END)::int AS other,
       COUNT(DISTINCT CASE
         WHEN TRIM(COALESCE(c.gender, '')) = ''
           OR LOWER(TRIM(COALESCE(c.gender, ''))) NOT IN ('male', 'female', 'other')
         THEN v.customer_id
       END)::int AS unknown_gender
     FROM visited v
     LEFT JOIN customers c ON c.id = v.customer_id
     JOIN first_inv fi ON fi.customer_id = v.customer_id`,
    [startDate, endDate]
  );

  const r = rows[0] || {};
  const total = Number(r.total_visited) || 0;
  const newC = Number(r.new_clients) || 0;
  return {
    startDate,
    endDate,
    totalVisited: total,
    newClients: newC,
    returningClients: Math.max(0, total - newC),
    male: Number(r.male) || 0,
    female: Number(r.female) || 0,
    other: Number(r.other) || 0,
    unknownGender: Number(r.unknown_gender) || 0,
  };
}

/** Quick snapshot windows using DB session date (expect Asia/Kolkata on the pool). */
async function getClientInsightsSummary() {
  const { rows } = await pool.query(`
    SELECT
      CURRENT_DATE::text AS today,
      (CURRENT_DATE - INTERVAL '1 day')::date::text AS yesterday,
      (CURRENT_DATE - INTERVAL '6 days')::date::text AS week_start,
      (CURRENT_DATE - INTERVAL '29 days')::date::text AS month30_start,
      date_trunc('month', CURRENT_DATE)::date::text AS mtd_start
  `);
  const b = rows[0];
  const end = b.today;
  const [todayP, yesterdayP, last7, last30, mtd] = await Promise.all([
    getClientInsightForPeriod(b.today, b.today),
    getClientInsightForPeriod(b.yesterday, b.yesterday),
    getClientInsightForPeriod(b.week_start, end),
    getClientInsightForPeriod(b.month30_start, end),
    getClientInsightForPeriod(b.mtd_start, end),
  ]);

  return {
    calendarDate: b.today,
    today: todayP,
    yesterday: yesterdayP,
    last7Days: last7,
    last30Days: last30,
    monthToDate: mtd,
  };
}

/**
 * Aggregates invoice line items for generated bills (paid or pending).
 * Products are lines whose service_name starts with "[Product] " (Quick Sales).
 * Membership plan lines "[Membership] " are excluded from both buckets.
 * Rows are filtered by business date: COALESCE(paid_at::date, invoice_date).
 */
async function getPaidInvoiceLineItemAggregates(days = 90, limit = 7) {
  const d = Math.min(730, Math.max(1, parseInt(String(days), 10) || 90));
  const lim = Math.min(50, Math.max(1, parseInt(String(limit), 10) || 7));

  const svcRes = await pool.query(
    `SELECT TRIM(ii.service_name) AS name,
            SUM(ii.quantity::numeric) AS qty,
            SUM(ii.total::numeric) AS revenue,
            COUNT(*)::int AS line_count
     FROM invoice_items ii
     INNER JOIN invoices i ON i.id = ii.invoice_id
     WHERE i.status IN ('paid', 'pending')
       AND COALESCE(i.paid_at::date, i.invoice_date) >= CURRENT_DATE - ($1::int - 1)
       AND COALESCE(i.paid_at::date, i.invoice_date) <= CURRENT_DATE
       AND ii.service_name NOT LIKE '[Product] %'
       AND ii.service_name NOT LIKE '[Membership] %'
     GROUP BY TRIM(ii.service_name)
     ORDER BY revenue DESC NULLS LAST
     LIMIT $2`,
    [d, lim]
  );

  const prodRes = await pool.query(
    `SELECT TRIM(SUBSTRING(ii.service_name FROM LENGTH('[Product] ') + 1)) AS name,
            SUM(ii.quantity::numeric) AS qty,
            SUM(ii.total::numeric) AS revenue,
            COUNT(*)::int AS line_count
     FROM invoice_items ii
     INNER JOIN invoices i ON i.id = ii.invoice_id
     WHERE i.status IN ('paid', 'pending')
       AND COALESCE(i.paid_at::date, i.invoice_date) >= CURRENT_DATE - ($1::int - 1)
       AND COALESCE(i.paid_at::date, i.invoice_date) <= CURRENT_DATE
       AND ii.service_name LIKE '[Product] %'
     GROUP BY TRIM(SUBSTRING(ii.service_name FROM LENGTH('[Product] ') + 1))
     HAVING TRIM(SUBSTRING(ii.service_name FROM LENGTH('[Product] ') + 1)) != ''
     ORDER BY revenue DESC NULLS LAST
     LIMIT $2`,
    [d, lim]
  );

  const mapRow = (r) => ({
    name: r.name,
    qty: Number(r.qty) || 0,
    revenue: Number(r.revenue) || 0,
    lineCount: Number(r.line_count) || 0,
  });

  return {
    services: svcRes.rows.map(mapRow),
    products: prodRes.rows.map(mapRow),
    days: d,
  };
}

/** Generated invoices (paid or pending); business date = paid day or invoice date. */
const INVOICE_LINE_IN_RANGE = `
  i.status IN ('paid', 'pending')
  AND COALESCE(i.paid_at::date, i.invoice_date) >= $1::date
  AND COALESCE(i.paid_at::date, i.invoice_date) <= $2::date
`;

/**
 * Full-category revenue totals for the date range (not limited to top-N names).
 * Buckets match staff sales: service = neither [Product] nor [Membership]; NULL lines count as service.
 */
async function getLineItemRevenueTotalsByDateRange(fromDate, toDate) {
  const res = await pool.query(
    `SELECT
       COALESCE(SUM(CASE
         WHEN ii.service_name LIKE '[Product] %' OR ii.service_name LIKE '[Membership] %' THEN 0
         ELSE COALESCE(ii.total::numeric, 0) END), 0) AS service_revenue,
       COALESCE(SUM(CASE WHEN ii.service_name LIKE '[Product] %' THEN ii.total::numeric ELSE 0 END), 0) AS product_revenue,
       COALESCE(SUM(CASE WHEN ii.service_name LIKE '[Membership] %' THEN ii.total::numeric ELSE 0 END), 0) AS membership_revenue,
       (COUNT(*)::int
         - COUNT(*) FILTER (WHERE ii.service_name LIKE '[Product] %')
         - COUNT(*) FILTER (WHERE ii.service_name LIKE '[Membership] %')) AS service_line_count,
       COUNT(*) FILTER (WHERE ii.service_name LIKE '[Product] %')::int AS product_line_count
     FROM invoice_items ii
     INNER JOIN invoices i ON i.id = ii.invoice_id
     WHERE ${INVOICE_LINE_IN_RANGE}`,
    [fromDate, toDate]
  );
  const r = res.rows[0] || {};
  return {
    serviceRevenue: Number(r.service_revenue) || 0,
    productRevenue: Number(r.product_revenue) || 0,
    membershipRevenue: Number(r.membership_revenue) || 0,
    serviceLineCount: Number(r.service_line_count) || 0,
    productLineCount: Number(r.product_line_count) || 0,
  };
}

/**
 * Service & product aggregates for an explicit calendar range (inclusive dates YYYY-MM-DD).
 */
async function getPaidLineItemAggregatesByDateRange(fromDate, toDate, limit = 40) {
  const lim = Math.min(80, Math.max(1, parseInt(String(limit), 10) || 40));

  const svcRes = await pool.query(
    `SELECT TRIM(ii.service_name) AS name,
            SUM(ii.quantity::numeric) AS qty,
            SUM(ii.total::numeric) AS revenue,
            COUNT(*)::int AS line_count
     FROM invoice_items ii
     INNER JOIN invoices i ON i.id = ii.invoice_id
     WHERE ${INVOICE_LINE_IN_RANGE}
       AND ii.service_name NOT LIKE '[Product] %'
       AND ii.service_name NOT LIKE '[Membership] %'
     GROUP BY TRIM(ii.service_name)
     ORDER BY revenue DESC NULLS LAST
     LIMIT $3`,
    [fromDate, toDate, lim]
  );

  const prodRes = await pool.query(
    `SELECT TRIM(SUBSTRING(ii.service_name FROM LENGTH('[Product] ') + 1)) AS name,
            SUM(ii.quantity::numeric) AS qty,
            SUM(ii.total::numeric) AS revenue,
            COUNT(*)::int AS line_count
     FROM invoice_items ii
     INNER JOIN invoices i ON i.id = ii.invoice_id
     WHERE ${INVOICE_LINE_IN_RANGE}
       AND ii.service_name LIKE '[Product] %'
     GROUP BY TRIM(SUBSTRING(ii.service_name FROM LENGTH('[Product] ') + 1))
     HAVING TRIM(SUBSTRING(ii.service_name FROM LENGTH('[Product] ') + 1)) != ''
     ORDER BY revenue DESC NULLS LAST
     LIMIT $3`,
    [fromDate, toDate, lim]
  );

  const mapRow = (r) => ({
    name: r.name,
    qty: Number(r.qty) || 0,
    revenue: Number(r.revenue) || 0,
    lineCount: Number(r.line_count) || 0,
  });

  return {
    services: svcRes.rows.map(mapRow),
    products: prodRes.rows.map(mapRow),
  };
}

/**
 * Per-staff sales from attributed line items. Splits: services (everything that is not
 * [Product] / [Membership] prefix, including NULL service_name), retail products, membership lines.
 * Using explicit product/membership branches + ELSE for service avoids PostgreSQL treating
 * NULL NOT LIKE ... as unknown so those lines were excluded from all buckets but still in total_sales.
 */
async function getStaffSalesByDateRange(fromDate, toDate) {
  const staffList = await pool.query('SELECT id, name FROM staff WHERE is_active = TRUE ORDER BY name');
  const aggRes = await pool.query(
    `SELECT ii.staff_id,
            COALESCE(s.name, '') AS staff_name,
            SUM(CASE WHEN ii.service_name LIKE '[Product] %' THEN ii.total::numeric ELSE 0 END) AS product_sales,
            SUM(CASE WHEN ii.service_name LIKE '[Membership] %' THEN ii.total::numeric ELSE 0 END) AS membership_sales,
            SUM(CASE
                  WHEN ii.service_name LIKE '[Product] %' OR ii.service_name LIKE '[Membership] %' THEN 0
                  ELSE COALESCE(ii.total::numeric, 0) END) AS service_sales,
            SUM(ii.total::numeric) AS total_sales,
            COUNT(*)::int AS line_count
     FROM invoice_items ii
     INNER JOIN invoices i ON i.id = ii.invoice_id
     LEFT JOIN staff s ON s.id = ii.staff_id
     WHERE ${INVOICE_LINE_IN_RANGE}
       AND ii.staff_id IS NOT NULL
     GROUP BY ii.staff_id, s.name`,
    [fromDate, toDate]
  );

  const byId = new Map(
    aggRes.rows.map((r) => [
      Number(r.staff_id),
      {
        staffId: Number(r.staff_id),
        staffName: r.staff_name || 'Staff',
        productSales: Number(r.product_sales) || 0,
        membershipSales: Number(r.membership_sales) || 0,
        serviceSales: Number(r.service_sales) || 0,
        totalSales: Number(r.total_sales) || 0,
        lineCount: Number(r.line_count) || 0,
      },
    ])
  );

  return staffList.rows.map((row) => {
    const a = byId.get(row.id);
    if (a) return { ...a, staffName: row.name || a.staffName };
    return {
      staffId: row.id,
      staffName: row.name,
      productSales: 0,
      membershipSales: 0,
      serviceSales: 0,
      totalSales: 0,
      lineCount: 0,
    };
  });
}

async function getStaffAttendanceSummaryByDateRange(fromDate, toDate) {
  const res = await pool.query(
    `SELECT staff_id,
            COUNT(*) FILTER (WHERE status = 'present')::int AS present_days,
            COUNT(*) FILTER (WHERE status = 'absent')::int AS absent_days,
            COUNT(*) FILTER (WHERE status = 'leave')::int AS leave_days,
            COUNT(*) FILTER (WHERE status = 'half-day')::int AS half_days,
            COUNT(*)::int AS entries
     FROM staff_attendance
     WHERE attendance_date >= $1::date AND attendance_date <= $2::date
     GROUP BY staff_id`,
    [fromDate, toDate]
  );
  return res.rows.map((r) => ({
    staffId: Number(r.staff_id),
    presentDays: Number(r.present_days) || 0,
    absentDays: Number(r.absent_days) || 0,
    leaveDays: Number(r.leave_days) || 0,
    halfDays: Number(r.half_days) || 0,
    entries: Number(r.entries) || 0,
  }));
}

module.exports = {
  pool,
  testConnection,
  getAdminByUsername,
  ensureDefaultAdmin,
  getCustomers,
  getCustomersByIds,
  getDailySales,
  getDailyReport,
  getDailyReports,
  getPaidInvoiceLineItemAggregates,
  getPaidLineItemAggregatesByDateRange,
  getLineItemRevenueTotalsByDateRange,
  getStaffSalesByDateRange,
  getStaffAttendanceSummaryByDateRange,
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
  getStaffWorkHistory,
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
  getClientInsightsSummary,
  lastDayOfMonthYmd,
  getStaffNameMap,
  enrichAppointmentRowsWithServiceLines,
  getAppointments,
  createAppointment,
  getInvoices,
  getInvoiceById,
  createInvoice,
  markInvoicePaid,
  parsePaymentSplitFromNotes,
  logWhatsApp,
  getWhatsAppLogs,
};
