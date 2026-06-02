# API Integration Tests

Automated tests for the salon billing API. They run against an **isolated `salon_test`
database** (never your dev/prod data) and start the Express app in-process on a random port.
WhatsApp and email are disabled in the test environment, so no real messages are sent.

## Run

```bash
cd server
npm test
```

The first run creates/migrates `salon_test` automatically. Tests run sequentially
(`--test-concurrency=1`) because they share one test database.

## Prerequisites

- A local PostgreSQL reachable via `DATABASE_URL` in `server/.env`.
- The DB user must be able to `CREATE DATABASE` (the `salon_test` DB is created once).

## What's covered

| File | Area |
|------|------|
| `01-auth-customers.test.js` | Health, login (success/fail), customer CRUD + validation |
| `02-invoices-stock.test.js` | Invoice create, mark-paid, double-pay guard, **consumed-product & retail-sale stock deduction** |
| `03-inventory-catalog.test.js` | Product CRUD, stock adjust, low-stock list, suppliers, catalog services & promotions |
| `04-memberships.test.js` | Plan create, buy on invoice, pay from membership balance |
| `05-staff-expenses-appointments.test.js` | Staff CRUD, shifts, goals, expenses, appointment booking |
| `06-analytics-status.test.js` | Sales-performance & client analytics, WhatsApp/email status endpoints |

## Adding tests

Use the helpers:

```js
const { get, post, put, del, uniq } = require('./helpers');
const { test } = require('node:test');

test('my case', async () => {
  const { status, body } = await post('/api/customers', { name: 'X', phone: `9${uniq()}` });
});
```

`uniq()` gives a unique suffix so reruns don't collide on phone/SKU/etc. Auth token is
attached automatically.
