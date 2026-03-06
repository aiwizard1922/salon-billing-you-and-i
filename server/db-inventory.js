const { pool } = require('./database');

async function getSuppliers() {
  const res = await pool.query('SELECT * FROM suppliers ORDER BY name');
  return res.rows;
}

async function createSupplier({ name, contact, email, phone, address, notes }) {
  const res = await pool.query(
    `INSERT INTO suppliers (name, contact, email, phone, address, notes)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name || '', contact || null, email || null, phone || null, address || null, notes || null]
  );
  return res.rows[0];
}

async function updateSupplier(id, data) {
  await pool.query(
    `UPDATE suppliers SET name = COALESCE($1, name), contact = COALESCE($2, contact),
     email = COALESCE($3, email), phone = COALESCE($4, phone), address = COALESCE($5, address),
     notes = COALESCE($6, notes), updated_at = NOW() WHERE id = $7`,
    [data.name, data.contact, data.email, data.phone, data.address, data.notes, id]
  );
  const res = await pool.query('SELECT * FROM suppliers WHERE id = $1', [id]);
  return res.rows[0] || null;
}

async function getProducts(filters = {}) {
  let query = 'SELECT p.*, s.name as supplier_name FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE 1=1';
  const params = [];
  let idx = 1;
  if (filters.category) { query += ` AND p.category = $${idx}`; params.push(filters.category); idx++; }
  if (filters.lowStock === 'true') { query += ` AND p.quantity <= p.low_stock_threshold`; }
  if (filters.active !== 'false') { query += ` AND p.is_active = TRUE`; }
  if (filters.search) { query += ` AND (p.name ILIKE $${idx} OR p.sku ILIKE $${idx})`; params.push(`%${filters.search}%`); idx++; }
  query += ' ORDER BY p.name';
  const res = await pool.query(query, params);
  return res.rows;
}

async function getProductById(id) {
  const res = await pool.query('SELECT p.*, s.name as supplier_name FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.id = $1', [id]);
  return res.rows[0] || null;
}

async function createProduct({ name, sku, category, unit, costPrice, sellingPrice, quantity, lowStockThreshold, supplierId }) {
  const res = await pool.query(
    `INSERT INTO products (name, sku, category, unit, cost_price, selling_price, quantity, low_stock_threshold, supplier_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [name || '', sku || null, category || null, unit || 'pcs', costPrice ?? 0, sellingPrice ?? 0, quantity ?? 0, lowStockThreshold ?? 5, supplierId || null]
  );
  return res.rows[0];
}

async function updateProduct(id, data) {
  const p = await getProductById(id);
  if (!p) return null;
  await pool.query(
    `UPDATE products SET name = COALESCE($1, name), sku = COALESCE($2, sku), category = COALESCE($3, category),
     unit = COALESCE($4, unit), cost_price = COALESCE($5, cost_price), selling_price = COALESCE($6, selling_price),
     quantity = COALESCE($7, quantity), low_stock_threshold = COALESCE($8, low_stock_threshold),
     supplier_id = COALESCE($9, supplier_id), is_active = COALESCE($10, is_active), updated_at = NOW() WHERE id = $11`,
    [data.name, data.sku, data.category, data.unit, data.costPrice, data.sellingPrice, data.quantity, data.lowStockThreshold, data.supplierId, data.isActive, id]
  );
  return getProductById(id);
}

async function adjustProductStock(productId, quantityChange, reason, referenceType, referenceId) {
  const p = await getProductById(productId);
  if (!p) return null;
  const newQty = Math.max(0, (p.quantity || 0) + quantityChange);
  await pool.query('UPDATE products SET quantity = $1, updated_at = NOW() WHERE id = $2', [newQty, productId]);
  await pool.query(
    `INSERT INTO product_movements (product_id, type, quantity_change, quantity_after, reason, reference_type, reference_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [productId, quantityChange >= 0 ? 'in' : 'out', quantityChange, newQty, reason || null, referenceType || null, referenceId || null]
  );
  return getProductById(productId);
}

async function getLowStockProducts() {
  const res = await pool.query(
    'SELECT * FROM products WHERE is_active = TRUE AND quantity <= low_stock_threshold ORDER BY quantity'
  );
  return res.rows;
}

async function getProductMovements(productId, limit = 50) {
  const res = await pool.query(
    'SELECT * FROM product_movements WHERE product_id = $1 ORDER BY created_at DESC LIMIT $2',
    [productId, limit]
  );
  return res.rows;
}

module.exports = {
  getSuppliers,
  createSupplier,
  updateSupplier,
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  adjustProductStock,
  getLowStockProducts,
  getProductMovements,
};
