#!/usr/bin/env node
/**
 * One-time script to clear test data from the database.
 * Run from project root:
 *   DATABASE_URL="postgresql://user:pass@host/db?sslmode=require" node server/scripts/clear-test-data.js
 *
 * Get DATABASE_URL from Render: salon-billing-db → Info → External Database URL
 */

const { Pool } = require('pg');

const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error('Set DATABASE_URL. Example:');
  console.error('  DATABASE_URL="postgresql://user:pass@host/db?sslmode=require" node server/scripts/clear-test-data.js');
  process.exit(1);
}

const pool = new Pool({
  connectionString: conn,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function tableExists(client, name) {
  const r = await client.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1",
    [name]
  );
  return r.rows.length > 0;
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (await tableExists(client, 'membership_usage')) {
      await client.query('DELETE FROM membership_usage');
      console.log('Deleted membership_usage');
    }
    await client.query('DELETE FROM invoice_items');
    console.log('Deleted invoice_items');
    await client.query('DELETE FROM invoices');
    console.log('Deleted invoices');
    await client.query('DELETE FROM appointments');
    console.log('Deleted appointments');
    if (await tableExists(client, 'customer_memberships')) {
      await client.query('DELETE FROM customer_memberships');
      console.log('Deleted customer_memberships');
    }
    if (await tableExists(client, 'expenses')) {
      await client.query('DELETE FROM expenses');
      console.log('Deleted expenses');
    }
    if (await tableExists(client, 'customer_tags')) {
      await client.query('DELETE FROM customer_tags');
      console.log('Deleted customer_tags');
    }
    await client.query('DELETE FROM customers');
    console.log('Deleted customers');
    await client.query('COMMIT');
    console.log('\nDone. All test data cleared.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
