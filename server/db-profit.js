const {
  pool,
  getCollectedRevenueByDateRange,
  getLineItemRevenueTotalsByDateRange,
  getMonthlyCollectedRevenue,
} = require('./database');

const INVOICE_DAY = 'COALESCE(i.paid_at::date, i.invoice_date::date)';
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const MONTHS_SINCE = `DATE_TRUNC('month', CURRENT_DATE) - ($1::int - 1) * INTERVAL '1 month'`;

/** Product cost: prefer invoice_items.product_id, fall back to matching product name. */
const PRODUCT_COGS_JOIN = `
  LEFT JOIN products p_id ON p_id.id = ii.product_id
  LEFT JOIN products p_name ON ii.product_id IS NULL
    AND LOWER(TRIM(p_name.name)) = LOWER(TRIM(REGEXP_REPLACE(ii.service_name, '^\\\\[Product\\\\]\\\\s*', '', 'i')))
`;

const productCostExpr = 'COALESCE(p_id.cost_price, p_name.cost_price, 0)';

async function getCogsForDateRange(fromDate, toDate) {
  const [soldRes, consumedRes] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(ii.quantity::numeric * ${productCostExpr}), 0)::numeric AS cogs
       FROM invoice_items ii
       INNER JOIN invoices i ON i.id = ii.invoice_id
       ${PRODUCT_COGS_JOIN}
       WHERE i.status = 'paid'
         AND ${INVOICE_DAY} >= $1::date
         AND ${INVOICE_DAY} <= $2::date
         AND ii.service_name LIKE '[Product] %'`,
      [fromDate, toDate]
    ),
    pool.query(
      `SELECT COALESCE(SUM(icp.quantity::numeric * COALESCE(p.cost_price, 0)), 0)::numeric AS cogs
       FROM invoice_consumed_products icp
       INNER JOIN invoices i ON i.id = icp.invoice_id
       INNER JOIN products p ON p.id = icp.product_id
       WHERE i.status = 'paid'
         AND ${INVOICE_DAY} >= $1::date
         AND ${INVOICE_DAY} <= $2::date`,
      [fromDate, toDate]
    ),
  ]);
  const productSalesCogs = Number(soldRes.rows[0]?.cogs || 0);
  const consumedCogs = Number(consumedRes.rows[0]?.cogs || 0);
  return {
    productSalesCogs: round2(productSalesCogs),
    consumedCogs: round2(consumedCogs),
    totalCogs: round2(productSalesCogs + consumedCogs),
  };
}

async function getExpenseBreakdownForDateRange(fromDate, toDate) {
  const res = await pool.query(
    `SELECT type, category, COALESCE(SUM(amount), 0)::numeric AS total
     FROM expenses
     WHERE expense_date >= $1::date AND expense_date <= $2::date
     GROUP BY type, category
     ORDER BY total DESC`,
    [fromDate, toDate]
  );
  const rows = res.rows.map((r) => ({
    type: r.type,
    category: r.category,
    total: round2(r.total),
  }));
  const fixed = round2(rows.filter((r) => r.type === 'fixed').reduce((s, r) => s + r.total, 0));
  const daily = round2(rows.filter((r) => r.type === 'daily').reduce((s, r) => s + r.total, 0));
  const productPayments = round2(
    rows.filter((r) => r.category === 'Product payment').reduce((s, r) => s + r.total, 0)
  );
  return {
    rows,
    fixed,
    daily,
    total: round2(fixed + daily),
    productPayments,
  };
}

/**
 * Profit & loss for an inclusive calendar range.
 * Revenue = cash + UPI + card collected. COGS from product sales + back-bar consumption (cost_price).
 * Net profit = revenue − COGS − operating expenses.
 */
async function getProfitReport(fromDate, toDate) {
  const [collected, lineTotals, cogs, expenses] = await Promise.all([
    getCollectedRevenueByDateRange(fromDate, toDate),
    getLineItemRevenueTotalsByDateRange(fromDate, toDate),
    getCogsForDateRange(fromDate, toDate),
    getExpenseBreakdownForDateRange(fromDate, toDate),
  ]);

  const revenue = round2(collected);
  const grossProfit = round2(revenue - cogs.totalCogs);
  const netProfit = round2(revenue - cogs.totalCogs - expenses.total);
  const productGrossProfit = round2(lineTotals.productRevenue - cogs.productSalesCogs);
  const cashSurplus = round2(revenue - expenses.total);

  return {
    from: fromDate,
    to: toDate,
    revenue,
    revenueBreakdown: {
      services: round2(lineTotals.serviceRevenue),
      products: round2(lineTotals.productRevenue),
      memberships: round2(lineTotals.membershipRevenue),
    },
    cogs,
    grossProfit,
    productGrossProfit,
    expenses,
    netProfit,
    /** Revenue minus expenses only (no COGS) — matches daily “Net” in reports. */
    cashSurplus,
  };
}

/** Monthly revenue, COGS, expenses, and net profit for trend charts. */
async function getMonthlyProfitTrend(months = 12) {
  const m = Math.min(24, Math.max(3, parseInt(String(months), 10) || 12));

  const [revenueRows, cogsRes, expRes] = await Promise.all([
    getMonthlyCollectedRevenue(m),
    pool.query(
      `SELECT month, COALESCE(SUM(cogs), 0)::numeric AS cogs
       FROM (
         SELECT TO_CHAR(${INVOICE_DAY}, 'YYYY-MM') AS month,
                ii.quantity::numeric * ${productCostExpr} AS cogs
         FROM invoice_items ii
         INNER JOIN invoices i ON i.id = ii.invoice_id
         ${PRODUCT_COGS_JOIN}
         WHERE i.status = 'paid'
           AND ii.service_name LIKE '[Product] %'
           AND ${INVOICE_DAY} >= ${MONTHS_SINCE}
         UNION ALL
         SELECT TO_CHAR(${INVOICE_DAY}, 'YYYY-MM'),
                icp.quantity::numeric * COALESCE(p.cost_price, 0)
         FROM invoice_consumed_products icp
         INNER JOIN invoices i ON i.id = icp.invoice_id
         INNER JOIN products p ON p.id = icp.product_id
         WHERE i.status = 'paid'
           AND ${INVOICE_DAY} >= ${MONTHS_SINCE}
       ) sub
       GROUP BY month
       ORDER BY month`,
      [m]
    ),
    pool.query(
      `SELECT TO_CHAR(expense_date, 'YYYY-MM') AS month,
              COALESCE(SUM(amount), 0)::numeric AS expenses
       FROM expenses
       WHERE expense_date >= ${MONTHS_SINCE}
       GROUP BY 1
       ORDER BY 1`,
      [m]
    ),
  ]);

  const cogsMap = Object.fromEntries(
    cogsRes.rows.map((r) => [r.month, round2(r.cogs)])
  );
  const expMap = Object.fromEntries(
    expRes.rows.map((r) => [r.month, round2(r.expenses)])
  );
  const monthSet = new Set([
    ...revenueRows.map((r) => r.month),
    ...cogsRes.rows.map((r) => r.month),
    ...expRes.rows.map((r) => r.month),
  ]);

  return [...monthSet]
    .sort()
    .map((month) => {
      const revenue = round2(revenueRows.find((r) => r.month === month)?.revenue || 0);
      const cogs = cogsMap[month] ?? 0;
      const expenses = expMap[month] ?? 0;
      const grossProfit = round2(revenue - cogs);
      const netProfit = round2(revenue - cogs - expenses);
      return { month, revenue, cogs, expenses, grossProfit, netProfit, profit: netProfit };
    });
}

module.exports = {
  getProfitReport,
  getMonthlyProfitTrend,
  getCogsForDateRange,
  getExpenseBreakdownForDateRange,
};
