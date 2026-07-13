#!/bin/sh
set -e

export DATABASE_URL="${DATABASE_URL:-file:/data/prod.db}"

cd /app/apps/web
# Garante schema no volume persistente
if [ -x /app/node_modules/.bin/prisma ]; then
  /app/node_modules/.bin/prisma db push --skip-generate --schema=./prisma/schema.prisma
elif [ -x /app/apps/web/node_modules/.bin/prisma ]; then
  /app/apps/web/node_modules/.bin/prisma db push --skip-generate --schema=./prisma/schema.prisma
else
  npx prisma db push --skip-generate --schema=./prisma/schema.prisma
fi

cd /app
exec node apps/web/server.js
