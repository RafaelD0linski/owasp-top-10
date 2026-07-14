# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/vulnerable-target/package.json ./apps/vulnerable-target/
COPY packages/scanner-core/package.json ./packages/scanner-core/
ENV NODE_ENV=development
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:./dev.db"
RUN npm run build -w @owasp/scanner-core \
  && npx --yes prisma@5.22.0 generate --schema=apps/web/prisma/schema.prisma \
  && npm install -w web --no-save lightningcss-linux-x64-gnu @tailwindcss/oxide-linux-x64-gnu \
  && NODE_ENV=production npm run build -w web

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN apt-get update -y && apt-get install -y openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs \
  && mkdir -p /data

# Next standalone + assets
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/prisma ./apps/web/prisma
COPY --from=builder /app/packages/scanner-core ./packages/scanner-core
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Runtime packages (evita COPY manual quebrado de deps do pdfkit)
RUN npm install --omit=dev --no-package-lock pdfkit@0.19.1 prisma@5.22.0 \
  && mkdir -p node_modules/@owasp \
  && ln -sfn /app/packages/scanner-core /app/node_modules/@owasp/scanner-core \
  && if [ -d /app/apps/web/node_modules ]; then \
       mkdir -p /app/apps/web/node_modules/@owasp \
       && ln -sfn /app/packages/scanner-core /app/apps/web/node_modules/@owasp/scanner-core; \
     fi

COPY docker/web-entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh \
  && chmod +x /entrypoint.sh \
  && chown -R nextjs:nodejs /app /data

USER nextjs
EXPOSE 3000
VOLUME ["/data"]
ENTRYPOINT ["/entrypoint.sh"]
