#!/bin/sh
# Applies every seed file in order. Runs inside the postgres container (see `pnpm db:seed`).
set -e
for f in /seeds/*.sql; do
  echo "seeding $(basename "$f")"
  psql -v ON_ERROR_STOP=1 -U ie -d indent_easy -q -f "$f"
done
