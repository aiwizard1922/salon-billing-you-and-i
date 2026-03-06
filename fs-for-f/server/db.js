import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/gemglow'
});

// Convert row to MongoDB-like format for frontend compatibility
const toMongo = (row) => row ? { ...row, _id: String(row.id) } : null;

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        category VARCHAR(100) DEFAULT 'service',
        image TEXT,
        stock INT DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS carts (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id)
      );
      CREATE TABLE IF NOT EXISTS cart_items (
        id SERIAL PRIMARY KEY,
        cart_id INT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
        product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity INT NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id),
        total_amount DECIMAL(10,2) NOT NULL,
        payment_id VARCHAR(255),
        payment_status VARCHAR(50) DEFAULT 'pending',
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INT,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        quantity INT NOT NULL
      );
    `);
  } finally {
    client.release();
  }
}

// Users
export async function createUser(name, email, password) {
  const hash = await bcrypt.hash(password, 10);
  const r = await pool.query(
    'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *',
    [name, email, hash]
  );
  return toMongo(r.rows[0]);
}

export async function findUserByEmail(email) {
  const r = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return r.rows[0];
}

export async function findUserById(id) {
  const r = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [id]);
  return toMongo(r.rows[0]);
}

export async function comparePassword(user, password) {
  const r = await pool.query('SELECT password FROM users WHERE id = $1', [user.id]);
  return bcrypt.compare(password, r.rows[0]?.password || '');
}

// Products
export async function findProducts(activeOnly = true) {
  const q = activeOnly
    ? 'SELECT * FROM products WHERE is_active = true ORDER BY created_at DESC'
    : 'SELECT * FROM products ORDER BY created_at DESC';
  const r = await pool.query(q);
  return r.rows.map(toMongo);
}

export async function findProductById(id) {
  const r = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  return toMongo(r.rows[0]);
}

export async function createProduct(data) {
  const r = await pool.query(
    `INSERT INTO products (name, description, price, category, image, stock, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [data.name, data.description || '', data.price, data.category || 'service', data.image || null, data.stock || 0, data.isActive !== false]
  );
  return toMongo(r.rows[0]);
}

export async function updateProduct(id, data) {
  const r = await pool.query(
    `UPDATE products SET name = COALESCE($2, name), description = COALESCE($3, description),
     price = COALESCE($4, price), category = COALESCE($5, category), image = COALESCE($6, image),
     stock = COALESCE($7, stock), is_active = COALESCE($8, is_active)
     WHERE id = $1 RETURNING *`,
    [id, data.name, data.description, data.price, data.category, data.image, data.stock, data.isActive]
  );
  return toMongo(r.rows[0]);
}

export async function deactivateProduct(id) {
  await pool.query('UPDATE products SET is_active = false WHERE id = $1', [id]);
}

// Cart
export async function getOrCreateCart(userId) {
  let r = await pool.query('SELECT * FROM carts WHERE user_id = $1', [userId]);
  if (r.rows.length === 0) {
    await pool.query('INSERT INTO carts (user_id) VALUES ($1)', [userId]);
    r = await pool.query('SELECT * FROM carts WHERE user_id = $1', [userId]);
  }
  return r.rows[0];
}

export async function getCartWithItems(userId) {
  const cart = await getOrCreateCart(userId);
  const items = await pool.query(
    `SELECT ci.*, p.name as p_name, p.price as p_price, p.image as p_image
     FROM cart_items ci JOIN products p ON ci.product_id = p.id
     WHERE ci.cart_id = $1`,
    [cart.id]
  );
  const cartItems = items.rows.map(row => ({
    product: { _id: String(row.product_id), name: row.p_name, price: parseFloat(row.p_price), image: row.p_image },
    quantity: row.quantity
  }));
  return { ...cart, _id: String(cart.id), items: cartItems };
}

export async function addToCart(userId, productId, quantity = 1) {
  const cart = await getOrCreateCart(userId);
  const prod = await findProductById(productId);
  if (!prod) return null;
  const exists = await pool.query(
    'SELECT * FROM cart_items WHERE cart_id = $1 AND product_id = $2',
    [cart.id, productId]
  );
  if (exists.rows.length) {
    await pool.query(
      'UPDATE cart_items SET quantity = quantity + $3 WHERE cart_id = $1 AND product_id = $2',
      [cart.id, productId, quantity]
    );
  } else {
    await pool.query(
      'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)',
      [cart.id, productId, quantity]
    );
  }
  return getCartWithItems(userId);
}

export async function updateCartItem(userId, productId, quantity) {
  const cart = await getOrCreateCart(userId);
  if (quantity <= 0) {
    await pool.query('DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2', [cart.id, productId]);
  } else {
    await pool.query(
      'UPDATE cart_items SET quantity = $3 WHERE cart_id = $1 AND product_id = $2',
      [cart.id, productId, quantity]
    );
  }
  return getCartWithItems(userId);
}

export async function removeFromCart(userId, productId) {
  const cart = await getOrCreateCart(userId);
  await pool.query('DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2', [cart.id, productId]);
  return getCartWithItems(userId);
}

export async function clearCart(userId) {
  const cart = await getOrCreateCart(userId);
  await pool.query('DELETE FROM cart_items WHERE cart_id = $1', [cart.id]);
  return { items: [] };
}

// Orders
export async function createOrder(userId, items, totalAmount) {
  const r = await pool.query(
    'INSERT INTO orders (user_id, total_amount) VALUES ($1, $2) RETURNING *',
    [userId, totalAmount]
  );
  const order = r.rows[0];
  for (const it of items) {
    await pool.query(
      'INSERT INTO order_items (order_id, product_id, name, price, quantity) VALUES ($1, $2, $3, $4, $5)',
      [order.id, it.product, it.name, it.price, it.quantity]
    );
  }
  return toMongo(order);
}

export async function findOrders(userId = null, admin = false) {
  const q = admin
    ? 'SELECT o.*, u.name as u_name, u.email as u_email FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC'
    : 'SELECT o.*, u.name as u_name, u.email as u_email FROM orders o JOIN users u ON o.user_id = u.id WHERE o.user_id = $1 ORDER BY o.created_at DESC';
  const r = admin ? await pool.query(q) : await pool.query(q, [userId]);
  const orders = [];
  for (const row of r.rows) {
    const items = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [row.id]);
    orders.push({
      id: row.id,
      _id: String(row.id),
      user_id: row.user_id,
      totalAmount: parseFloat(row.total_amount),
      paymentId: row.payment_id,
      paymentStatus: row.payment_status,
      status: row.status,
      createdAt: row.created_at,
      items: items.rows.map(i => ({ product: i.product_id, name: i.name, price: parseFloat(i.price), quantity: i.quantity })),
      user: { _id: String(row.user_id), name: row.u_name, email: row.u_email }
    });
  }
  return orders;
}

export async function findOrderById(id) {
  const r = await pool.query(
    'SELECT o.*, u.name as u_name, u.email as u_email FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = $1',
    [id]
  );
  if (!r.rows[0]) return null;
  const row = r.rows[0];
  const items = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
  return {
    id: row.id,
    _id: String(row.id),
    user_id: row.user_id,
    totalAmount: parseFloat(row.total_amount),
    paymentId: row.payment_id,
    paymentStatus: row.payment_status,
    status: row.status,
    createdAt: row.created_at,
    items: items.rows.map(i => ({ product: i.product_id, name: i.name, price: parseFloat(i.price), quantity: i.quantity })),
    user: { _id: String(row.user_id), name: row.u_name, email: row.u_email }
  };
}

export async function updateOrder(id, data) {
  const r = await pool.query(
    'UPDATE orders SET payment_id = COALESCE($2, payment_id), payment_status = COALESCE($3, payment_status), status = COALESCE($4, status) WHERE id = $1 RETURNING *',
    [id, data.paymentId, data.paymentStatus, data.status]
  );
  return toMongo(r.rows[0]);
}

export async function updateOrderStatus(id, status) {
  const r = await pool.query('UPDATE orders SET status = $2 WHERE id = $1 RETURNING *', [id, status]);
  return toMongo(r.rows[0]);
}

export async function getCartItemsForOrder(userId) {
  const cart = await getCartWithItems(userId);
  if (!cart.items?.length) return null;
  return cart.items.map(i => ({
    product: i.product._id,
    name: i.product.name,
    price: parseFloat(i.product.price),
    quantity: i.quantity
  }));
}

export async function productCount() {
  const r = await pool.query('SELECT COUNT(*) as c FROM products');
  return parseInt(r.rows[0].c, 10);
}

export async function insertProducts(products) {
  for (const p of products) {
    await pool.query(
      `INSERT INTO products (name, description, price, category, image, stock, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [p.name, p.description || '', p.price, p.category || 'service', p.image || null, p.stock || 0, p.isActive !== false]
    );
  }
}

export async function clearProducts() {
  await pool.query('DELETE FROM order_items');
  await pool.query('DELETE FROM orders');
  await pool.query('DELETE FROM cart_items');
  await pool.query('DELETE FROM products');
}

export default pool;
