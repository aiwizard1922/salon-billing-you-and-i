'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { get, post, put, uniq } = require('./helpers');

test('editing product quantity records a movement (audit trail)', async () => {
  const created = await post('/api/inventory/products', { name: `Edit ${uniq()}`, quantity: 5, sellingPrice: 10 });
  const id = created.body.data.id;

  const before = await get(`/api/inventory/products/${id}/movements`);
  const beforeCount = before.body.data.length;

  // Edit form sends the full product incl. a changed quantity.
  const upd = await put(`/api/inventory/products/${id}`, { name: created.body.data.name, quantity: 20 });
  assert.equal(upd.body.data.quantity, 20);

  const after = await get(`/api/inventory/products/${id}/movements`);
  assert.equal(after.body.data.length, beforeCount + 1, 'expected one new movement row');
  const mv = after.body.data[0];
  assert.equal(mv.quantity_change, 15);
  assert.equal(mv.quantity_after, 20);
});

test('editing other fields without changing quantity records NO movement', async () => {
  const created = await post('/api/inventory/products', { name: `NoMove ${uniq()}`, quantity: 8, sellingPrice: 10 });
  const id = created.body.data.id;
  const before = (await get(`/api/inventory/products/${id}/movements`)).body.data.length;

  await put(`/api/inventory/products/${id}`, { name: created.body.data.name, quantity: 8, sellingPrice: 99 });
  const after = (await get(`/api/inventory/products/${id}/movements`)).body.data.length;
  assert.equal(after, before, 'no quantity change → no movement');
});

test('over-removing stock floors at 0 and records the shortfall truthfully', async () => {
  const created = await post('/api/inventory/products', { name: `Oversell ${uniq()}`, quantity: 3, sellingPrice: 10 });
  const id = created.body.data.id;

  const adj = await post(`/api/inventory/products/${id}/adjust`, { quantityChange: -10, reason: 'Big sale' });
  assert.equal(adj.body.data.quantity, 0, 'stock floored at 0');

  const mv = (await get(`/api/inventory/products/${id}/movements`)).body.data[0];
  // applied delta is truthful: before(3) + change(-3) = after(0)
  assert.equal(mv.quantity_change, -3);
  assert.equal(mv.quantity_after, 0);
  assert.match(mv.reason, /requested -10, applied -3/);
});
