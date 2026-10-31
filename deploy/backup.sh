#!/bin/sh
# Automatic backups, run by the `backup` service in docker-compose.yml:
# the database (pg_dump, gzipped: menu, settings, outlets, orders), once when
# the service starts (so every deploy gets one) and every night at BACKUP_HOUR
# (Nepal time). Files older than BACKUP_KEEP_DAYS are deleted.
# Photo files are left out unless BACKUP_PHOTOS=1: they would be copied in full
# every night, and can be uploaded again from the originals.
# The files hold customers' names and phone numbers: they are readable by
# their owner only. Copy them off the server too (see deploy/README.md).
set -u
KEEP=${BACKUP_KEEP_DAYS:-14}
HOUR=${BACKUP_HOUR:-3}
OWNER=${BACKUP_OWNER:-1000:1000}
DIR=/backups
umask 077

backup() {
  stamp=$(date +%Y-%m-%d_%H%M)
  ok=1
  skip="--exclude-table-data=media_files"
  [ "${BACKUP_PHOTOS:-0}" = 1 ] && skip=""
  if pg_dump --no-owner -Z 6 $skip -f "$DIR/db-$stamp.sql.gz.part"; then
    mv "$DIR/db-$stamp.sql.gz.part" "$DIR/db-$stamp.sql.gz"
  else
    rm -f "$DIR/db-$stamp.sql.gz.part"; ok=0
  fi
  chown "$OWNER" "$DIR"/*-"$stamp".* 2>/dev/null
  find "$DIR" -maxdepth 1 \( -name 'db-*.sql.gz' \) -mtime +"$KEEP" -delete
  if [ "$ok" = 1 ]; then
    date -u +%Y-%m-%dT%H:%M:%SZ > "$DIR/last-success"
    chmod 644 "$DIR/last-success"; chown "$OWNER" "$DIR/last-success" 2>/dev/null
    echo "$(date) backup ok: db-$stamp.sql.gz ($(du -h "$DIR/db-$stamp.sql.gz" | cut -f1))"
  else
    echo "$(date) BACKUP FAILED (see errors above)" >&2
  fi
}

backup
last=$(date +%F)
while true; do
  sleep 600
  if [ "$(date +%H)" -eq "$HOUR" ] && [ "$(date +%F)" != "$last" ]; then
    backup
    last=$(date +%F)
  fi
done
