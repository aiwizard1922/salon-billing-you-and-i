const { pool } = require('./database');

async function getServices(filters = {}) {
  let query = 'SELECT * FROM services WHERE 1=1';
  const params = [];
  let idx = 1;
  if (filters.category) { query += ` AND category = $${idx}`; params.push(filters.category); idx++; }
  if (filters.active !== 'false') { query += ` AND is_active = TRUE`; }
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

async function getPromotions(filters = {}) {
  let query = 'SELECT * FROM catalog_promotions WHERE 1=1';
  const params = [];
  let idx = 1;
  if (filters.active !== 'false') {
    query += ` AND is_active = TRUE AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE`;
  }
  query += ' ORDER BY end_date';
  const res = await pool.query(query, params);
  return res.rows;
}

async function createPromotion({ name, description, discountType, discountValue, minPurchase, startDate, endDate }) {
  const res = await pool.query(
    `INSERT INTO catalog_promotions (name, description, discount_type, discount_value, min_purchase, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [name || '', description || null, discountType || 'percent', discountValue ?? 0, minPurchase ?? 0, startDate, endDate]
  );
  return res.rows[0];
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
  return res.rows[0] || null;
}

module.exports = {
  getServices,
  getServiceById,
  createService,
  updateService,
  getServiceCategories,
  getPromotions,
  createPromotion,
  updatePromotion,
};
