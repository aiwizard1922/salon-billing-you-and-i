#!/usr/bin/env node
'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const migrationPath = path.join(__dirname, 'db/migrations/013-invoice-items-staff.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

async function run() {
  try {
    await pool.query(sql);
    console.log('Migration 013 (invoice_items staff_id) applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
