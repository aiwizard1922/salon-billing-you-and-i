'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { get, post, put, uniq } = require('./helpers');

test('product create requires a name', async () => {
  const { status } = await post('/api/inventory/products', { quantity: 5 });
  assert.equal(status, 400);
});

test('product CRUD + manual stock adjustment + low-stock list', async () => {
  const created = await post('/api/inventory/products', {
    name: `Wax ${uniq()}`, sku: `SKU-${uniq()}`, quantity: 3, lowStockThreshold: 5, sellingPrice: 120,
  });
  assert.equal(created.status, 201);
  const id = created.body.data.id;

  // appears in low-stock (3 <= 5)
  const low = await get('/api/inventory/products?lowStock=true');
  assert.ok(low.body.data.some((p) => p.id === id));

  // adjust stock up by 10 → 13
  const adj = await post(`/api/inventory/products/${id}/adjust`, { quantityChange: 10, reason: 'Restock' });
  assert.equal(adj.body.data.quantity, 13);

  // update price
  const upd = await put(`/api/inventory/products/${id}`, { sellingPrice: 150 });
  assert.equal(Number(upd.body.data.selling_price), 150);
});

test('supplier create + list', async () => {
  const s = await post('/api/inventory/suppliers', { name: `Supplier ${uniq()}`, email: 'sup@example.com' });
  assert.equal(s.body.success, true);
  const list = await get('/api/inventory/suppliers');
  assert.ok(list.body.data.some((x) => x.id === s.body.data.id));
});

test('catalog: create service and promotion', async () => {
  const svc = await post('/api/catalog/services', { name: `Facial ${uniq()}`, category: 'Skin', price: 800 });
  assert.equal(svc.status, 201);

  const promoBad = await post('/api/catalog/promotions', { name: 'No dates' });
  assert.equal(promoBad.status, 400);

  const promo = await post('/api/catalog/promotions', {
    name: `Diwali ${uniq()}`, discountType: 'percent', discountValue: 15,
    startDate: '2026-01-01', endDate: '2026-12-31',
  });
  assert.equal(promo.status, 201);
});
