'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { get } = require('./helpers');

test('profit report responds for a date range', async () => {
  const { status, body } = await get('/api/analytics/profit?from=2026-01-01&to=2026-12-31');
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.ok(typeof body.data.revenue === 'number');
  assert.ok(typeof body.data.netProfit === 'number');
  assert.ok(body.data.cogs);
  assert.ok(body.data.expenses);
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
});
