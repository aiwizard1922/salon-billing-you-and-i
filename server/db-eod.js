const { pool } = require('./database');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// pg returns DATE as a Date (which serializes to UTC, shifting the day under +05:30).
// Always hand back close_date as a plain YYYY-MM-DD string.
const SELECT_COLS =
  "id, to_char(close_date, 'YYYY-MM-DD') AS close_date, opening_float, counted_cash, " +
  'cash_collected, total_collected, expenses, expected_cash, variance, notes, closed_by, locked, created_at, updated_at';

async function getDailyClose(date) {
  const res = await pool.query(`SELECT ${SELECT_COLS} FROM daily_closes WHERE close_date = $1::date`, [date]);
  return res.rows[0] || null;
}

async function getRecentDailyCloses(limit = 30) {
  const res = await pool.query(
    `SELECT ${SELECT_COLS} FROM daily_closes ORDER BY close_date DESC LIMIT $1`,
    [Math.min(180, Math.max(1, Number(limit) || 30))]
  );
  return res.rows;
}

async function getCloseAudits(date) {
  const res = await pool.query(
    `SELECT id, to_char(close_date, 'YYYY-MM-DD') AS close_date, action, opening_float, counted_cash,
            expected_cash, variance, notes, reason, changed_by, created_at
       FROM daily_close_audits WHERE close_date = $1::date ORDER BY created_at DESC, id DESC`,
    [date]
  );
  return res.rows;
}

/**
 * Close a day (locks it). Money figures are computed here so stored numbers always reconcile.
 * Caller must ensure the day is not already locked (route returns 409 otherwise).
 */
async function closeDay({
  closeDate, openingFloat, countedCash, cashCollected, totalCollected, expenses, notes, closedBy,
}) {
  const opening = round2(openingFloat);
  const counted = round2(countedCash);
  const cash = round2(cashCollected);
  const total = round2(totalCollected);
  const exp = round2(expenses);
  const expected = round2(opening + cash - exp);
  const variance = round2(counted - expected);

  const res = await pool.query(
    `INSERT INTO daily_closes
       (close_date, opening_float, counted_cash, cash_collected, total_collected, expenses, expected_cash, variance, notes, closed_by, locked, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, NOW())
     ON CONFLICT (close_date) DO UPDATE SET
       opening_float = EXCLUDED.opening_float, counted_cash = EXCLUDED.counted_cash,
       cash_collected = EXCLUDED.cash_collected, total_collected = EXCLUDED.total_collected,
       expenses = EXCLUDED.expenses, expected_cash = EXCLUDED.expected_cash, variance = EXCLUDED.variance,
       notes = EXCLUDED.notes, closed_by = EXCLUDED.closed_by, locked = TRUE, updated_at = NOW()
     RETURNING ${SELECT_COLS}`,
    [closeDate, opening, counted, cash, total, exp, expected, variance, notes || null, closedBy || null]
  );
  await pool.query(
    `INSERT INTO daily_close_audits (close_date, action, opening_float, counted_cash, expected_cash, variance, notes, changed_by)
     VALUES ($1, 'close', $2, $3, $4, $5, $6, $7)`,
    [closeDate, opening, counted, expected, variance, notes || null, closedBy || null]
  );
  return res.rows[0];
}

/** Reopen a locked day for editing. Requires a reason; logs an audit entry. */
async function reopenDay({ closeDate, reason, reopenedBy }) {
  const current = await getDailyClose(closeDate);
  if (!current) return { error: 'No close exists for this day.' };
  if (!current.locked) return { error: 'Day is already open for editing.' };

  await pool.query('UPDATE daily_closes SET locked = FALSE, updated_at = NOW() WHERE close_date = $1::date', [closeDate]);
  await pool.query(
    `INSERT INTO daily_close_audits (close_date, action, opening_float, counted_cash, expected_cash, variance, reason, changed_by)
     VALUES ($1, 'reopen', $2, $3, $4, $5, $6, $7)`,
    [closeDate, current.opening_float, current.counted_cash, current.expected_cash, current.variance, reason, reopenedBy || null]
  );
  return { close: await getDailyClose(closeDate) };
}

module.exports = { getDailyClose, getRecentDailyCloses, getCloseAudits, closeDay, reopenDay };
