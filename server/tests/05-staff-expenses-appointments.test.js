'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { get, post, put, uniq } = require('./helpers');

test('staff create requires a name; CRUD works', async () => {
  const bad = await post('/api/staff', {});
  assert.equal(bad.status, 400);

  const name = `Asha ${uniq()}`;
  const created = await post('/api/staff', { name, role: 'Colorist' });
  assert.equal(created.status, 201);
  const id = created.body.data.id;

  // updateStaff is a full replace, so include name alongside the changed field.
  const upd = await put(`/api/staff/${id}`, { name, role: 'Senior Colorist' });
  assert.equal(upd.body.data.role, 'Senior Colorist');

  const list = await get('/api/staff?active=true');
  assert.ok(list.body.data.some((s) => s.id === id));
});

test('staff shift and goal creation', async () => {
  const s = await post('/api/staff', { name: `Shift Staff ${uniq()}` });
  const staffId = s.body.data.id;

  const shift = await post('/api/staff/shifts', {
    staffId, shiftDate: '2026-06-10', startTime: '10:00', endTime: '18:00',
  });
  assert.equal(shift.body.success, true);

  const goal = await post('/api/staff/goals', {
    staffId, periodType: 'monthly', periodValue: '2026-06', targetAmount: 50000, targetCount: 100,
  });
  assert.equal(goal.body.success, true);
});

test('expense create requires category and amount; CRUD works', async () => {
  const bad = await post('/api/expenses', { amount: 100 });
  assert.equal(bad.status, 400);

  const created = await post('/api/expenses', { category: 'Rent', amount: 20000, type: 'fixed' });
  assert.equal(created.status, 201);
  assert.equal(Number(created.body.data.amount), 20000);

  const summary = await get('/api/expenses/summary');
  assert.equal(summary.body.success, true);
});

test('appointment booking creates an appointment', async () => {
  const cust = await post('/api/customers', { name: 'Appt Client', phone: `9${uniq()}`.slice(0, 12) });
  const appt = await post('/api/appointments', {
    customerId: cust.body.data.id,
    appointmentDate: '2026-07-01',
    appointmentTime: '14:30',
    services: ['Hair Cut'],
  });
  assert.equal(appt.body.success, true);
});
