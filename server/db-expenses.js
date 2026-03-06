const { pool } = require('./database');

const FIXED_CATEGORIES = ['Salary', 'Product payment', 'Electricity', 'Water', 'Rent', 'Internet', 'Other'];
const DAILY_CATEGORIES = ['Milk', 'Flowers', 'OT', 'Incentives', 'Supplies', 'Miscellaneous', 'Other'];

async function getExpenses(filters = {}) {
  let query = 'SELECT * FROM expenses WHERE 1=1';
  const params = [];
  let idx = 1;
  if (filters.type) {
    query += ` AND type = $${idx}`;
    params.push(filters.type);
    idx++;
  }
  if (filters.fromDate) {
    query += ` AND expense_date >= $${idx}`;
    params.push(filters.fromDate);
    idx++;
  }
  if (filters.toDate) {
    query += ` AND expense_date <= $${idx}`;
    params.push(filters.toDate);
    idx++;
  }
  query += ' ORDER BY expense_date DESC, id DESC';
  const res = await pool.query(query, params);
  return res.rows;
}

async function createExpense({ type, category, amount, expenseDate, notes }) {
  const res = await pool.query(
    `INSERT INTO expenses (type, category, amount, expense_date, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [type || 'daily', category || 'Other', Number(amount) || 0, expenseDate || new Date().toISOString().slice(0, 10), notes || null]
  );
  return res.rows[0];
}

async function updateExpense(id, { type, category, amount, expenseDate, notes }) {
  const res = await pool.query(
    `UPDATE expenses SET type = COALESCE($1, type), category = COALESCE($2, category), amount = COALESCE($3, amount),
     expense_date = COALESCE($4, expense_date), notes = $5
     WHERE id = $6 RETURNING *`,
    [type, category, amount != null ? Number(amount) : null, expenseDate, notes || null, id]
  );
  return res.rows[0] || null;
}

async function deleteExpense(id) {
  const res = await pool.query('DELETE FROM expenses WHERE id = $1 RETURNING id', [id]);
  return res.rows[0] || null;
}

async function getExpenseSummary(filters = {}) {
  let query = `
    SELECT type, SUM(amount)::numeric as total
    FROM expenses WHERE 1=1`;
  const params = [];
  let idx = 1;
  if (filters.fromDate) {
    query += ` AND expense_date >= $${idx}`;
    params.push(filters.fromDate);
    idx++;
  }
  if (filters.toDate) {
    query += ` AND expense_date <= $${idx}`;
    params.push(filters.toDate);
    idx++;
  }
  query += ' GROUP BY type';
  const res = await pool.query(query, params);
  return res.rows;
}

module.exports = {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
  FIXED_CATEGORIES,
  DAILY_CATEGORIES,
};
