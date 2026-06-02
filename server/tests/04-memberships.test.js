'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { get, post, uniq } = require('./helpers');

test('membership plan create requires a name', async () => {
  const { status } = await post('/api/membership-plans', { price: 5000 });
  assert.equal(status, 400);
});

test('create plan, assign to customer, pay invoice from membership balance', async () => {
  const plan = await post('/api/membership-plans', {
    name: `Gold ${uniq()}`, durationDays: 365, price: 5000, specialPrice: 5000,
  });
  assert.equal(plan.status, 201);
  const planId = plan.body.data.id;

  const cust = await post('/api/customers', { name: 'Member Client', phone: `9${uniq()}`.slice(0, 12) });
  const customerId = cust.body.data.id;
  const staff = await post('/api/staff', { name: `Stylist ${uniq()}` });
  const staffId = staff.body.data.id;

  // Buy the membership on an invoice (credits the wallet).
  const buy = await post('/api/invoices', {
    customerId,
    items: [{ lineKind: 'membership', service_name: `[Membership] Gold`, unit_price: 5000, quantity: 1, staff_id: staffId, membership_plan_id: planId }],
    cgstPercent: 0, sgstPercent: 0,
  });
  assert.equal(buy.status, 201);
  await post(`/api/invoices/${buy.body.data.id}/pay`, { paymentMethod: 'cash' });

  // Active membership should now exist with balance.
  const active = await get(`/api/membership/active?customerId=${customerId}`);
  assert.ok(active.body.data, 'expected an active membership');
  assert.ok(Number(active.body.data.remaining_balance) > 0);

  // New service invoice paid from membership.
  const svcInv = await post('/api/invoices', {
    customerId,
    items: [{ lineKind: 'service', serviceMode: 'custom', service_name: 'Cut', unit_price: 400, quantity: 1, staff_id: staffId }],
    cgstPercent: 0, sgstPercent: 0,
  });
  const pay = await post(`/api/invoices/${svcInv.body.data.id}/pay`, {
    paymentMethod: 'membership', membershipId: active.body.data.id,
  });
  assert.equal(pay.body.success, true);
  assert.equal(pay.body.data.status, 'paid');
});
