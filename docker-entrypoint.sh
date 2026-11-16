#!/bin/sh
set -eu

DB_DIR=$(dirname "${DB_PATH:-/data/db/app.sqlite}")
FILES_DIR=${STORAGE_DIR:-/data/files}
case "$DB_DIR" in
  /?*) ;;
  *) DB_DIR=/data/db ;;
esac
case "$FILES_DIR" in
  /?*) ;;
  *) FILES_DIR=/data/files ;;
esac

if [ "$(id -u)" -eq 0 ]; then
  for dir in "$DB_DIR" "$FILES_DIR"; do
    mkdir -p "$dir"
    if [ "$(stat -c %u "$dir")" != "$(id -u bun)" ] || [ "$(stat -c %g "$dir")" != "$(id -g bun)" ]; then
      echo "Fixing ownership of $dir" >&2
      chown -R bun:bun "$dir"
    fi
  done
  exec setpriv --reuid=bun --regid=bun --init-groups "$@"
fi

for dir in "$DB_DIR" "$FILES_DIR"; do
  if [ ! -w "$dir" ]; then
    echo "error: $dir is not writable by uid $(id -u)" >&2
    exit 1
  fi
done
exec "$@"
