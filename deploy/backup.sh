#!/bin/sh
set -eu
umask 077
mkdir -p /backups
while true; do
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  target="/backups/teramont-${stamp}.dump"
  if pg_dump --format=custom --no-owner > "${target}.partial" && pg_restore --list "${target}.partial" > /dev/null; then
    mv "${target}.partial" "$target"
    date -u +%s > /backups/last-success
    find /backups -maxdepth 1 -name 'teramont-*.dump' -type f -mtime +14 -delete
    printf 'Backup verified: %s\n' "$stamp"
    sleep 86400
  else
    rm -f "${target}.partial"
    printf 'Backup failed; retry in 300 seconds\n' >&2
    sleep 300
  fi
done
