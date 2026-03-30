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

const migrationPath = path.join(__dirname, 'db/migrations/016-appointment-service-lines.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

async function run() {
  try {
    await pool.query(sql);
    console.log('Migration 016 (appointment service_lines) applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
