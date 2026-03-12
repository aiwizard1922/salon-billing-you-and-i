# Database Backup Guide

Daily backups are **essential** for production. Here are your options.

---

## Option 1: Use Your Hosting Provider’s Backups (Recommended)

If your database is on a managed service, enable its built-in backups first:

| Provider | Where to enable | Notes |
|----------|-----------------|-------|
| **Supabase** | Project → Settings → Database → Backups | Daily by default |
| **Neon** | Console → Branches → Backups | Point-in-time restore |
| **Railway** | Project → PostgreSQL → Backups | One-click enable |
| **Render** | PostgreSQL dashboard → Backups | Daily snapshots |
| **Heroku Postgres** | Add-on dashboard → Durability | Continuous protection |
| **AWS RDS** | RDS Console → Automated backups | 7 days by default |

These handle storage, retention, and often off-site copies.

---

## Option 2: Run Backup Scripts (Self-hosted or extra safety)

For self-hosted PostgreSQL or as an extra backup layer:

### Prerequisites

- **PostgreSQL client tools** (for `pg_dump`):
  - Ubuntu/Debian: `sudo apt install postgresql-client`
  - macOS: `brew install libpq` (add to PATH)
  - Windows: Install PostgreSQL and use its `bin` folder

### One-time backup

```bash
# From project root
node scripts/backup-db.js
```

or

```bash
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh
```

Backups are written to a `backups/` folder (created if missing).

### Daily backups with cron

Add a cron job on your server:

```bash
crontab -e
```

Add (adjust path if needed):

```
# Daily backup at 2 AM
0 2 * * * cd /path/to/salon-billing-you-and-i && node scripts/backup-db.js >> /var/log/salon-backup.log 2>&1
```

Or with the shell script:

```
0 2 * * * /path/to/salon-billing-you-and-i/scripts/backup-db.sh >> /var/log/salon-backup.log 2>&1
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | from `server/.env` | PostgreSQL connection string |
| `BACKUP_DIR` | `./backups` | Folder for backup files |
| `RETENTION_DAYS` | `7` | How many days of backups to keep |

---

## Option 3: Off-site backups (Production)

Store backups outside the server:

1. **Sync to cloud storage** (after backup):
   ```bash
   # Example: upload to S3
   aws s3 cp backups/salon_db_*.sql.gz s3://your-bucket/salon-backups/
   ```

2. **Copy to another machine** with `scp` or `rsync`

3. **Use a backup service** (e.g. Backblaze B2, DigitalOcean Spaces)

---

## Restore

To restore from a backup:

```bash
# Decompress if needed
gunzip backups/salon_db_20250306_020000.sql.gz

# Restore (⚠️ overwrites existing data)
psql "$DATABASE_URL" < backups/salon_db_20250306_020000.sql
```

Or with a fresh database:

```bash
createdb salon_db_restored
psql salon_db_restored < backups/salon_db_20250306_020000.sql
```

---

## Checklist for production

- [ ] Enable provider backups (Option 1)
- [ ] Set up daily cron backup (Option 2) if self-hosted
- [ ] Configure off-site storage (Option 3)
- [ ] Test restore once
- [ ] Document where backups are stored and who has access
