#!/usr/bin/env node
/**
 * Daily PostgreSQL backup for Salon Billing (Node.js version)
 * Uses pg_dump - requires PostgreSQL client tools installed.
 * Usage: node scripts/backup-db.js
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../server/.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && m[1].trim()) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

const DATABASE_URL = process.env.DATABASE_URL;
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../backups');
const RETENTION_DAYS = parseInt(process.env.RETENTION_DAYS || '7', 10);

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL not set in server/.env');
  process.exit(1);
}

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
const filename = `salon_db_${timestamp}.sql`;
const filepath = path.join(BACKUP_DIR, filename);

const pgDump = spawn('pg_dump', [DATABASE_URL, '-F', 'p'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

const writeStream = fs.createWriteStream(filepath);
pgDump.stdout.pipe(writeStream);

let stderr = '';
pgDump.stderr.on('data', (d) => { stderr += d.toString(); });

pgDump.on('close', (code) => {
  if (code !== 0) {
    console.error('pg_dump failed:', stderr || 'unknown error');
    console.error('Install PostgreSQL client tools: apt install postgresql-client');
    process.exit(1);
  }
  writeStream.end(() => {
    console.log('Backup saved:', filepath);
    try {
      const zlib = require('zlib');
      const gzip = zlib.createGzip();
      const input = fs.createReadStream(filepath);
      const output = fs.createWriteStream(filepath + '.gz');
      input.pipe(gzip).pipe(output);
      output.on('finish', () => {
        fs.unlinkSync(filepath);
        console.log('Compressed:', filepath + '.gz');
        pruneOldBackups();
      });
    } catch (err) {
      console.warn('Skipping compression:', err.message);
      pruneOldBackups();
    }
  });
});

function pruneOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.sql.gz') || f.endsWith('.sql'))
      .map((f) => ({ name: f, path: path.join(BACKUP_DIR, f), mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);

    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    files.filter((f) => f.mtime.getTime() < cutoff).forEach((f) => {
      fs.unlinkSync(f.path);
      console.log('Removed old backup:', f.name);
    });
  } catch (e) {
    console.warn('Could not prune old backups:', e.message);
  }
}
