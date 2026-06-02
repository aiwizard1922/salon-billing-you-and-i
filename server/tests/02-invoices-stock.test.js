'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert');
const { get, post, uniq } = require('./helpers');

let customerId;
let staffId;

before(async () => {
  const c = await post('/api/customers', { name: 'Invoice Client', phone: `9${uniq()}`.slice(0, 12) });
  customerId = c.body.data.id;
  const s = await post('/api/staff', { name: `Stylist ${uniq()}`, role: 'Stylist' });
  staffId = s.body.data.id;
});

test('create a simple service invoice (pending)', async () => {
  const { status, body } = await post('/api/invoices', {
    customerId,
    items: [{ lineKind: 'service', serviceMode: 'custom', service_name: 'Hair Cut', unit_price: 300, quantity: 1, staff_id: staffId }],
    cgstPercent: 2.5,
    sgstPercent: 2.5,
  });
  assert.equal(status, 201);
  assert.equal(body.success, true);
  // 300 + 5% tax = 315
  assert.equal(Number(body.data.total), 315);
  assert.equal(body.data.status, 'pending');
});

test('marking an invoice paid moves it to paid and rejects double-pay', async () => {
  const created = await post('/api/invoices', {
    customerId,
    items: [{ lineKind: 'service', serviceMode: 'custom', service_name: 'Shave', unit_price: 100, quantity: 1, staff_id: staffId }],
  });
  const id = created.body.data.id;
  const paid = await post(`/api/invoices/${id}/pay`, { paymentMethod: 'cash' });
  assert.equal(paid.body.success, true);
  assert.equal(paid.body.data.status, 'paid');

  const again = await post(`/api/invoices/${id}/pay`, { paymentMethod: 'cash' });
  assert.equal(again.status, 400);
});

test('consumed products are NOT billed but DO deduct stock on payment', async () => {
  // product with known stock
  const prod = await post('/api/inventory/products', {
    name: `Color Tube ${uniq()}`, quantity: 10, sellingPrice: 0, lowStockThreshold: 2,
  });
  const productId = prod.body.data.id;
  assert.equal(prod.body.data.quantity, 10);

  const created = await post('/api/invoices', {
    customerId,
    items: [{ lineKind: 'service', serviceMode: 'custom', service_name: 'Hair Color', unit_price: 1000, quantity: 1, staff_id: staffId }],
    cgstPercent: 0, sgstPercent: 0, igstPercent: 0, serviceTaxPercent: 0,
    consumedProducts: [{ productId, quantity: 3, serviceName: 'Hair Color' }],
  });
  // consumed product must not change the total (service only, zero tax)
  assert.equal(Number(created.body.data.total), 1000);
  const invId = created.body.data.id;

  // stock unchanged before payment
  let after = await get(`/api/inventory/products`);
  let p = after.body.data.find((x) => x.id === productId);
  assert.equal(p.quantity, 10, 'stock should not drop before payment');

  await post(`/api/invoices/${invId}/pay`, { paymentMethod: 'cash' });

  after = await get(`/api/inventory/products`);
  p = after.body.data.find((x) => x.id === productId);
  assert.equal(p.quantity, 7, 'stock should drop by 3 after payment');

  // movement recorded
  const mv = await get(`/api/inventory/products/${productId}/movements`);
  assert.ok(mv.body.data.some((m) => m.type === 'out' && m.quantity_change === -3));
});

test('retail product sale line deducts stock on payment', async () => {
  const prod = await post('/api/inventory/products', {
    name: `Shampoo ${uniq()}`, quantity: 5, sellingPrice: 250, lowStockThreshold: 1,
  });
  const productId = prod.body.data.id;
  const productName = prod.body.data.name;

  const created = await post('/api/invoices', {
    customerId,
    items: [
      { lineKind: 'service', serviceMode: 'custom', service_name: 'Hair Spa', unit_price: 500, quantity: 1, staff_id: staffId },
      { lineKind: 'product', service_name: `[Product] ${productName}`, unit_price: 250, quantity: 2, staff_id: staffId },
    ],
  });
  const invId = created.body.data.id;
  await post(`/api/invoices/${invId}/pay`, { paymentMethod: 'cash' });

  const after = await get('/api/inventory/products');
  const p = after.body.data.find((x) => x.id === productId);
  assert.equal(p.quantity, 3, 'sold 2 of 5 → 3 left');
});
