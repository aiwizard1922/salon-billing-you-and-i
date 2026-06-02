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

/** Create or update product when billing a custom retail line (stored as [Product] name on invoice). */
async function upsertProductFromInvoiceLine(serviceName, unitPrice) {
  const raw = String(serviceName || '')
    .trim()
    .replace(/^\[Product\]\s*/i, '')
    .trim();
  if (!raw) return null;
  const price = Number(unitPrice) || 0;
  const found = await pool.query(
    `SELECT id FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND is_active = TRUE LIMIT 1`,
    [raw]
  );
  if (found.rows.length) {
    await pool.query('UPDATE products SET selling_price = $1, updated_at = NOW() WHERE id = $2', [price, found.rows[0].id]);
    return getProductById(found.rows[0].id);
  }
  return createProduct({
    name: raw,
    sku: null,
    category: 'Retail',
    unit: 'pcs',
    costPrice: 0,
    sellingPrice: price,
    quantity: 0,
    lowStockThreshold: 5,
    supplierId: null,
  });
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
  // Editing quantity directly must leave an audit trail (so movements reconcile with quantity).
  const before = Number(p.quantity) || 0;
  const newQ = data.quantity;
  if (newQ != null && newQ !== '' && Number.isFinite(Number(newQ)) && Number(newQ) !== before) {
    const delta = Number(newQ) - before;
    await pool.query(
      `INSERT INTO product_movements (product_id, type, quantity_change, quantity_after, reason, reference_type, reference_id)
       VALUES ($1, 'adjustment', $2, $3, $4, 'product_edit', $5)`,
      [id, delta, Number(newQ), 'Edited via product form', id]
    );
  }
  return getProductById(id);
}

async function adjustProductStock(productId, quantityChange, reason, referenceType, referenceId) {
  const p = await getProductById(productId);
  if (!p) return null;
  const before = Number(p.quantity) || 0;
  const requested = Number(quantityChange) || 0;
  const newQty = Math.max(0, before + requested);
  const applied = newQty - before; // what actually changed (stock cannot go below 0)
  let finalReason = reason || null;
  if (applied !== requested) {
    // Oversell/over-consume: record the shortfall instead of silently losing it.
    finalReason = `${reason || 'Adjustment'} — requested ${requested}, applied ${applied} (stock floored at 0)`;
  }
  await pool.query('UPDATE products SET quantity = $1, updated_at = NOW() WHERE id = $2', [newQty, productId]);
  await pool.query(
    `INSERT INTO product_movements (product_id, type, quantity_change, quantity_after, reason, reference_type, reference_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [productId, applied >= 0 ? 'in' : 'out', applied, newQty, finalReason, referenceType || null, referenceId || null]
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

/** Save products consumed (used, not sold) while delivering services on an invoice. */
async function addConsumedProducts(invoiceId, consumed) {
  if (!Array.isArray(consumed)) return;
  for (const c of consumed) {
    const productId = Number(c.productId ?? c.product_id);
    const qty = Math.round(Number(c.quantity) || 0);
    if (!Number.isFinite(productId) || productId <= 0 || qty <= 0) continue;
    await pool.query(
      `INSERT INTO invoice_consumed_products (invoice_id, product_id, quantity, service_name)
       VALUES ($1, $2, $3, $4)`,
      [invoiceId, productId, qty, c.serviceName || c.service_name || null]
    );
  }
}

async function getConsumedProducts(invoiceId) {
  const res = await pool.query(
    `SELECT icp.*, p.name AS product_name, p.unit
       FROM invoice_consumed_products icp
       JOIN products p ON p.id = icp.product_id
      WHERE icp.invoice_id = $1
      ORDER BY icp.id`,
    [invoiceId]
  );
  return res.rows;
}

/**
 * Deduct stock for a paid invoice: both retail [Product] sale lines and consumed (back-bar) products.
 * Call once, right after the invoice is marked paid (the already-paid guard keeps it idempotent).
 */
async function deductInvoiceStock(invoiceId) {
  // 1) Retail product sale lines: "[Product] <name>" matched to active products by name.
  const saleLines = await pool.query(
    `SELECT TRIM(SUBSTRING(service_name FROM LENGTH('[Product] ') + 1)) AS name,
            SUM(quantity)::int AS qty
       FROM invoice_items
      WHERE invoice_id = $1 AND service_name LIKE '[Product] %'
      GROUP BY 1
      HAVING TRIM(SUBSTRING(service_name FROM LENGTH('[Product] ') + 1)) <> ''`,
    [invoiceId]
  );
  for (const line of saleLines.rows) {
    const found = await pool.query(
      `SELECT id FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND is_active = TRUE LIMIT 1`,
      [line.name]
    );
    if (found.rows.length && line.qty > 0) {
      await adjustProductStock(found.rows[0].id, -line.qty, `Sold on invoice ${invoiceId}`, 'invoice_sale', invoiceId);
    }
  }

  // 2) Consumed (back-bar) products recorded against the invoice.
  const consumed = await pool.query(
    'SELECT product_id, SUM(quantity)::int AS qty FROM invoice_consumed_products WHERE invoice_id = $1 GROUP BY product_id',
    [invoiceId]
  );
  for (const row of consumed.rows) {
    if (row.qty > 0) {
      await adjustProductStock(row.product_id, -row.qty, `Used in service on invoice ${invoiceId}`, 'invoice_consumption', invoiceId);
    }
  }
}

module.exports = {
  getSuppliers,
  createSupplier,
  updateSupplier,
  getProducts,
  getProductById,
  createProduct,
  upsertProductFromInvoiceLine,
  updateProduct,
  adjustProductStock,
  getLowStockProducts,
  getProductMovements,
  addConsumedProducts,
  getConsumedProducts,
  deductInvoiceStock,
};
