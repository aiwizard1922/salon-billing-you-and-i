'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { get, post, put, uniq } = require('./helpers');

test('health endpoint is up', async () => {
  const { status, body } = await get('/api/health');
  assert.equal(status, 200);
  assert.ok(body);
});

test('login with correct credentials returns a token', async () => {
  const { status, body } = await post('/api/auth/login', { username: 'admin', password: 'admin123' });
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.ok(body.token, 'expected a JWT token');
});

test('login with wrong password is rejected', async () => {
  const { body } = await post('/api/auth/login', { username: 'admin', password: 'wrong-pass' });
  assert.notEqual(body.success, true);
});

test('create customer requires name and phone', async () => {
  const { status, body } = await post('/api/customers', { name: 'No Phone' });
  assert.equal(status, 400);
  assert.equal(body.success, false);
});

test('create, fetch, and update a customer', async () => {
  const phone = `9${uniq()}`.slice(0, 12);
  const created = await post('/api/customers', { name: 'Test Client', phone, gender: 'female' });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.name, 'Test Client');
  const id = created.body.data.id;

  const list = await get('/api/customers');
  assert.equal(list.body.success, true);
  assert.ok(list.body.data.some((c) => c.id === id));

  const updated = await put(`/api/customers/${id}`, { name: 'Renamed Client', phone });
  assert.equal(updated.body.data.name, 'Renamed Client');
});
