'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const { after } = require('node:test');

// --- Test environment: isolate from dev DB and disable external side effects ---
process.env.NODE_ENV = 'test';
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbUrl = new URL(process.env.DATABASE_URL);
dbUrl.pathname = '/salon_test';
process.env.DATABASE_URL = dbUrl.toString();

// Prevent real WhatsApp / email during tests. Set to '' rather than delete: server.js
// re-runs dotenv.config(), which would repopulate deleted keys but leaves existing ones alone.
for (const k of [
  'WA_PHONE_NUMBER_ID', 'WA_ACCESS_TOKEN', 'RESEND_API_KEY',
  'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'INVOICE_NOTIFY_EMAIL',
]) {
  process.env[k] = '';
}

let started = null;

/** Idempotent: migrate test DB, start the app on an ephemeral port, log in as admin. */
async function getServer() {
  if (started) return started;

  execFileSync('node', ['run-all-migrations.js'], {
    cwd: path.join(__dirname, '..'),
    env: process.env,
    stdio: 'ignore',
  });

  const { app } = require('../server');
  const db = require('../database');
  await db.ensureDefaultAdmin().catch(() => {});

  const listener = await new Promise((resolve) => {
    const l = app.listen(0, () => resolve(l));
  });
  const port = listener.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.token || loginData.data?.token || null;

  started = { baseUrl, token, listener, db };
  return started;
}

// Release the HTTP listener + DB pool so the test process can exit (otherwise
// open handles keep the event loop alive and buffered output never flushes).
after(async () => {
  if (!started) return;
  await new Promise((resolve) => started.listener.close(resolve));
  await started.db.pool.end().catch(() => {});
});

/** fetch wrapper that adds auth + JSON parsing. Returns { status, body }. */
async function api(method, route, body, { token } = {}) {
  const { baseUrl, token: defaultToken } = await getServer();
  const headers = { 'Content-Type': 'application/json' };
  const auth = token !== undefined ? token : defaultToken;
  if (auth) headers.Authorization = `Bearer ${auth}`;
  const res = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  return { status: res.status, body: parsed };
}

const get = (route, opts) => api('GET', route, undefined, opts);
const post = (route, body, opts) => api('POST', route, body, opts);
const put = (route, body, opts) => api('PUT', route, body, opts);
const del = (route, opts) => api('DELETE', route, undefined, opts);

/** Unique suffix so repeated test runs don't collide on phone/sku/etc. */
const uniq = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

module.exports = { getServer, api, get, post, put, del, uniq };
