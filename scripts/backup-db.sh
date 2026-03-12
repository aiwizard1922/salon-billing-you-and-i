#!/usr/bin/env bash
# Daily PostgreSQL backup for Salon Billing
# Usage: ./scripts/backup-db.sh
# Requires: pg_dump (PostgreSQL client tools) and DATABASE_URL

set -e

# Load .env from server if it exists
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/server/.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE" 2>/dev/null || true
  set +a
fi

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL not set. Add it to server/.env or export it."
  exit 1
fi

# Config
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
mkdir -p "$BACKUP_DIR"

# Create backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="salon_db_${TIMESTAMP}.sql"
FILEPATH="$BACKUP_DIR/$FILENAME"

echo "Backing up to $FILEPATH ..."
if pg_dump "$DATABASE_URL" -F p > "$FILEPATH" 2>/dev/null; then
  gzip -f "$FILEPATH"
  echo "Backup saved: ${FILEPATH}.gz"
else
  echo "Error: pg_dump failed. Is PostgreSQL client installed? (apt install postgresql-client)"
  exit 1
fi

# Retention: keep last N daily backups
find "$BACKUP_DIR" -name "salon_db_*.sql.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
