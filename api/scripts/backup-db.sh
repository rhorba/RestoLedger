#!/usr/bin/env bash
# Story 4.3 (devops-restoledger.md §6 "Backup verification"): dump the database, compress,
# encrypt at rest. Local dev runs pg_dump inside the docker-compose Postgres container
# (docker exec) since no pg_dump binary is required on the host; a real deployment runs this
# from wherever has network access to the managed Postgres instance (a scheduled job, or the
# hosting platform's own backup tooling as a complement — see docs/mobile-publishing.md-style
# note: which platform is TBD, this script works unchanged once DATABASE_URL points at it).
set -euo pipefail

CONTAINER_NAME="${POSTGRES_CONTAINER:-restoledger-postgres}"
DB_USER="${POSTGRES_USER:-restoledger}"
DB_NAME="${POSTGRES_DB:-restoledger}"
BACKUP_DIR="${BACKUP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups}"
PASSPHRASE="${BACKUP_ENCRYPTION_PASSPHRASE:?Set BACKUP_ENCRYPTION_PASSPHRASE before running a backup}"

mkdir -p "$BACKUP_DIR"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
out_file="$BACKUP_DIR/restoledger-$timestamp.sql.gz.enc"

echo "Dumping $DB_NAME from container $CONTAINER_NAME..."
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" \
  | gzip \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "pass:$PASSPHRASE" \
  > "$out_file"

size=$(du -h "$out_file" | cut -f1)
echo "Backup written: $out_file ($size)"
echo "Verify it's actually restorable with: scripts/restore-drill.sh \"$out_file\""
