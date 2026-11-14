#!/bin/sh
# Nightly database backup for hosting without Docker (a control panel's cron jobs).
# The Docker set-up uses backup.sh instead. Same result: a gzipped pg_dump of the
# menu, settings, outlets, accounts and orders, files older than BACKUP_KEEP_DAYS
# (default 14) deleted, and BACKUP_DIR/last-success written for the dashboard's check.
#
#   Cron (every night at 3:00):  0 3 * * * /bin/sh $HOME/omc-api/scripts/backup-cron.sh $HOME/omc-api/.env
#
# Reads DATABASE_URL and BACKUP_DIR from that .env file. Set BACKUP_DIR there to a
# folder outside the website's public folder, e.g. /home/you/omc-backups.
# The files hold customers' names and phone numbers: only their owner can read them.
set -u
ENV_FILE=${1:?give the path to the backend .env file}
val() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//'; }
DATABASE_URL=$(val DATABASE_URL)
DIR=$(val BACKUP_DIR)
KEEP=${BACKUP_KEEP_DAYS:-14}
[ -n "$DATABASE_URL" ] || { echo "DATABASE_URL is missing in $ENV_FILE" >&2; exit 1; }
[ -n "$DIR" ] || { echo "BACKUP_DIR is missing in $ENV_FILE" >&2; exit 1; }
umask 077
mkdir -p "$DIR"
stamp=$(date +%Y-%m-%d_%H%M)
# Photos are left out (they are copied to disk too, and can be uploaded again).
if pg_dump --no-owner -Z 6 --exclude-table-data=media_files -f "$DIR/db-$stamp.sql.gz.part" "$DATABASE_URL"; then
  mv "$DIR/db-$stamp.sql.gz.part" "$DIR/db-$stamp.sql.gz"
  find "$DIR" -maxdepth 1 -name 'db-*.sql.gz' -mtime +"$KEEP" -delete
  date -u +%Y-%m-%dT%H:%M:%SZ > "$DIR/last-success"
  chmod 644 "$DIR/last-success"
  echo "$(date) backup ok: db-$stamp.sql.gz"
else
  rm -f "$DIR/db-$stamp.sql.gz.part"
  echo "$(date) BACKUP FAILED (see errors above)" >&2
  exit 1
fi
