const { pool } = require('./database');
const { mapRowDates, mapRowsDates } = require('./date-utils');
const SEED_SERVICES = require('./data/services');

function serviceDedupeKey(s) {
  return `${String(s.name || '').trim().toLowerCase()}::${String(s.category || '').trim().toLowerCase()}`;
}

/** Merge DB catalog rows with built-in defaults so Quick Sales always lists both; DB wins on (name, category). */
function mergeServicesWithSeedForQuickPick(dbRows) {
  const rows = Array.isArray(dbRows) ? [...dbRows] : [];
  const seenKeys = new Set(rows.map(serviceDedupeKey));
  const usedIds = new Set(rows.map((r) => String(r.id)));
  let seedCounter = 0;
  for (const d of SEED_SERVICES) {
    if (seenKeys.has(serviceDedupeKey(d))) continue;
    seenKeys.add(serviceDedupeKey(d));
    let id = d.id;
    while (usedIds.has(String(id))) {
      seedCounter += 1;
      id = `seed-${seedCounter}`;
    }
    usedIds.add(String(id));
    rows.push({
      id,
      name: d.name,
      category: d.category,
      price: d.price,
      duration_mins: 30,
      description: null,
      is_active: true,
      sort_order: 0,
      created_at: null,
      updated_at: null,
    });
  }
  rows.sort((a, b) => {
    const so = (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
    if (so !== 0) return so;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
  return rows;
}

async function getServices(filters = {}) {
  let query = 'SELECT * FROM services WHERE 1=1';
  const params = [];
  let idx = 1;
  if (filters.category) { query += ` AND category = $${idx}`; params.push(filters.category); idx++; }
  if (filters.active !== 'false') { query += ` AND is_active = TRUE`; }
  query += ` AND NOT (TRIM(name) = 'Other (Custom)' AND category = 'Other')`;
  query += ' ORDER BY sort_order, name';
  const res = await pool.query(query, params);
  return res.rows;
}

async function getServiceById(id) {
  const res = await pool.query('SELECT * FROM services WHERE id = $1', [id]);
  return res.rows[0] || null;
}

async function createService({ name, category, price, durationMins, description }) {
  const res = await pool.query(
    `INSERT INTO services (name, category, price, duration_mins, description)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name || '', category || 'General', price ?? 0, durationMins ?? 30, description || null]
  );
  return res.rows[0];
}

async function updateService(id, data) {
  await pool.query(
    `UPDATE services SET name = COALESCE($1, name), category = COALESCE($2, category),
     price = COALESCE($3, price), duration_mins = COALESCE($4, duration_mins),
     description = COALESCE($5, description), is_active = COALESCE($6, is_active),
     updated_at = NOW() WHERE id = $7`,
    [data.name, data.category, data.price, data.durationMins, data.description, data.isActive, id]
  );
  return getServiceById(id);
}

async function getServiceCategories() {
  const res = await pool.query('SELECT DISTINCT category FROM services ORDER BY category');
  return res.rows.map((r) => r.category);
}

/** Create or update service when billing a custom / combo / package line so it appears in catalog next time. */
async function upsertServiceFromInvoiceLine({ name, price, category }) {
  const n = (name || '').trim();
  if (!n || n.startsWith('[')) return null;
  const p = Number(price) || 0;
  const cat = category || 'General';
  const res = await pool.query(
    `SELECT id FROM services WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND category = $2 AND is_active = TRUE LIMIT 1`,
    [n, cat]
  );
  if (res.rows.length) {
    await pool.query('UPDATE services SET price = $1, updated_at = NOW() WHERE id = $2', [p, res.rows[0].id]);
    return getServiceById(res.rows[0].id);
  }
  return createService({
    name: n,
    category: cat,
    price: p,
    durationMins: 30,
    description: null,
  });
}

async function getPromotions(filters = {}) {
  let query = 'SELECT * FROM catalog_promotions WHERE 1=1';
  const params = [];
  let idx = 1;
  if (filters.active !== 'false') {
    query += ` AND is_active = TRUE AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE`;
  }
  query += ' ORDER BY end_date';
  const res = await pool.query(query, params);
  return mapRowsDates(res.rows, ['start_date', 'end_date']);
}

async function createPromotion({ name, description, discountType, discountValue, minPurchase, startDate, endDate }) {
  const res = await pool.query(
    `INSERT INTO catalog_promotions (name, description, discount_type, discount_value, min_purchase, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [name || '', description || null, discountType || 'percent', discountValue ?? 0, minPurchase ?? 0, startDate, endDate]
  );
  return mapRowDates(res.rows[0], ['start_date', 'end_date']);
}

async function updatePromotion(id, data) {
  await pool.query(
    `UPDATE catalog_promotions SET name = COALESCE($1, name), description = COALESCE($2, description),
     discount_type = COALESCE($3, discount_type), discount_value = COALESCE($4, discount_value),
     min_purchase = COALESCE($5, min_purchase), start_date = COALESCE($6, start_date),
     end_date = COALESCE($7, end_date), is_active = COALESCE($8, is_active)
     WHERE id = $9`,
    [data.name, data.description, data.discountType, data.discountValue, data.minPurchase, data.startDate, data.endDate, data.isActive, id]
  );
  const res = await pool.query('SELECT * FROM catalog_promotions WHERE id = $1', [id]);
  return mapRowDates(res.rows[0] || null, ['start_date', 'end_date']);
}

module.exports = {
  getServices,
  getServiceById,
  createService,
  updateService,
  upsertServiceFromInvoiceLine,
  mergeServicesWithSeedForQuickPick,
  getServiceCategories,
  getPromotions,
  createPromotion,
  updatePromotion,
};
