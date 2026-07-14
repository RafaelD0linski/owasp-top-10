#!/bin/sh
set -e

export DATABASE_URL="${DATABASE_URL:-file:/data/prod.db}"

cd /app/apps/web

# Só toca o banco deste app (volume /data). Prisma 5.22 pinado.
if command -v npx >/dev/null 2>&1; then
  npx --yes prisma@5.22.0 db push --skip-generate --schema=./prisma/schema.prisma || true
fi

cd /app
exec node apps/web/server.js
