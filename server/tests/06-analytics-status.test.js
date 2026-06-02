'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { get } = require('./helpers');

test('sales-performance analytics responds for a date range', async () => {
  const { status, body } = await get('/api/analytics/sales-performance?from=2026-01-01&to=2026-12-31');
  assert.equal(status, 200);
  assert.equal(body.success, true);
});

test('sales-performance requires from and to', async () => {
  const { status } = await get('/api/analytics/sales-performance');
  assert.equal(status, 400);
});

test('client insights summary responds', async () => {
  const { body } = await get('/api/analytics/clients/summary');
  assert.equal(body.success, true);
});

test('whatsapp status reports not-configured in test env', async () => {
  const { body } = await get('/api/whatsapp/status');
  assert.equal(body.configured, false);
  assert.ok(Array.isArray(body.missing));
});

test('email status reports not-ready in test env', async () => {
  const { body } = await get('/api/email/status');
  assert.equal(body.ready, false);
});
