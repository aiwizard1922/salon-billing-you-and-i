'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { get } = require('./helpers');

test('profit report responds for a date range', async () => {
  const { status, body } = await get('/api/analytics/profit?from=2026-01-01&to=2026-12-31');
  assert.equal(status, 200);
  assert.equal(body.success, true);
  const d = body.data;
  assert.ok(typeof d.revenue === 'number');
  assert.ok(typeof d.netProfit === 'number');
  assert.ok(d.cogs);
  assert.ok(d.expenses);
  // Net profit must reconcile: revenue − COGS − expenses (±1 paisa rounding).
  const expectedNet = Math.round((d.revenue - d.cogs.totalCogs - d.expenses.total) * 100) / 100;
  assert.equal(d.netProfit, expectedNet);
  assert.equal(d.grossProfit, Math.round((d.revenue - d.cogs.totalCogs) * 100) / 100);
  assert.equal(d.cashSurplus, Math.round((d.revenue - d.expenses.total) * 100) / 100);
});

test('profit report requires from and to', async () => {
  const { status } = await get('/api/analytics/profit');
  assert.equal(status, 400);
});

test('monthly profit trend responds', async () => {
  const { status, body } = await get('/api/analytics/profit/monthly?months=6');
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
  for (const row of body.data) {
    const expected = Math.round((row.revenue - row.cogs - row.expenses) * 100) / 100;
    assert.equal(row.netProfit, expected);
  }
});
