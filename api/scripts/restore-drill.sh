#!/usr/bin/env bash
# Story 4.3: proves a backup is actually restorable, not just "a file exists". Restores into
# a disposable database (never the real dev/prod DB), checks it looks sane, then drops it.
# This is what devops-restoledger.md §6 means by "Backup verification: Scheduled restore-
# drill job runs and alerts on failure" — run this on a schedule against your latest backup,
# alert if it exits non-zero.
set -euo pipefail

BACKUP_FILE="${1:?Usage: restore-drill.sh <path-to-backup.sql.gz.enc>}"
CONTAINER_NAME="${POSTGRES_CONTAINER:-restoledger-postgres}"
DB_USER="${POSTGRES_USER:-restoledger}"
PASSPHRASE="${BACKUP_ENCRYPTION_PASSPHRASE:?Set BACKUP_ENCRYPTION_PASSPHRASE (same value used to create the backup)}"
DRILL_DB="restoledger_restore_drill_$(date -u +%Y%m%dT%H%M%SZ)"

cleanup() {
  echo "Cleaning up drill database $DRILL_DB..."
  docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$DRILL_DB\";" > /dev/null
}
trap cleanup EXIT

echo "Decrypting and restoring $BACKUP_FILE into disposable database $DRILL_DB..."
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DRILL_DB\";" > /dev/null

openssl enc -d -aes-256-cbc -pbkdf2 -salt -pass "pass:$PASSPHRASE" -in "$BACKUP_FILE" \
  | gunzip \
  | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DRILL_DB" -v ON_ERROR_STOP=1 > /dev/null

echo "Verifying restored data..."
table_count=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DRILL_DB" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
migration_count=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DRILL_DB" -tAc \
  "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL" 2>/dev/null || echo 0)

echo "Restored database has $table_count tables, $migration_count applied migrations."

if [ "$table_count" -lt 5 ]; then
  echo "RESTORE DRILL FAILED: expected at least 5 tables, found $table_count"
  exit 1
fi
if [ "$migration_count" -lt 1 ]; then
  echo "RESTORE DRILL FAILED: no applied migrations found in restored database"
  exit 1
fi

echo "RESTORE DRILL PASSED: backup is restorable and contains applied schema."
