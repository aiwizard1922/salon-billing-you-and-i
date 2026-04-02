#!/usr/bin/env node
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const migrationOrder = [
  'db/schema.sql',
  'db/migrations/001-staff-memberships-clients.sql',
  'db/migrations/002-inventory-products.sql',
  'db/migrations/003-digital-catalog.sql',
  'db/seed-services.sql',
  'db/migrations/004-crm.sql',
  'db/migrations/005-staff-management.sql',
  'db/migrations/006-membership-enhancements.sql',
  'db/migrations/007-membership-tracking-renewal.sql',
  'db/migrations/008-value-based-membership.sql',
  'db/migrations/009-fix-membership-balance-backfill.sql',
  'db/migrations/010-split-payment-membership.sql',
  'db/migrations/011-expenses.sql',
  'db/migrations/012-invoice-discount.sql',
  'db/migrations/013-invoice-items-staff.sql',
  'db/migrations/add-admins.sql',
  'db/migrations/014-seed-hair-inventory-products.sql',
  'db/migrations/015-invoice-gst-breakdown.sql',
  'db/migrations/016-appointment-service-lines.sql',
  'db/migrations/017-remove-other-custom-placeholder-service.sql',
  'db/migrations/018-payment-split-amounts.sql',
  'db/migrations/019-move-payment-split-to-notes-drop-amount-cols.sql',
];

/** Safe to ignore when re-running migrations. */
function isBenignMigrationError(err) {
  const msg = (err.message || '').toLowerCase();
  if (msg.includes('already exists')) return true;
  if (err.code === '42P07') return true; // duplicate_table
  if (err.code === '42701') return true; // duplicate_column
  if (err.code === '42710') return true; // duplicate_object
  return false;
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  console.log('Running migrations...');

  for (const file of migrationOrder) {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) {
      console.warn(`Skipping (not found): ${file}`);
      continue;
    }
    const sql = fs.readFileSync(fullPath, 'utf8');
    try {
      await pool.query(sql);
      console.log(`✓ ${file}`);
    } catch (err) {
      if (isBenignMigrationError(err)) {
        console.log(`✓ ${file} (already applied)`);
      } else {
        console.error(`✗ ${file}:`, err.message);
        process.exit(1);
      }
    }
  }

  console.log('All migrations applied successfully.');
  await pool.end();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
