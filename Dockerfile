# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/vulnerable-target/package.json ./apps/vulnerable-target/
COPY packages/scanner-core/package.json ./packages/scanner-core/
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:./dev.db"
RUN npm run build -w @owasp/scanner-core \
  && npm run db:push -w web \
  && npm run build -w web

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN apt-get update -y && apt-get install -y openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/prisma ./apps/web/prisma
COPY --from=builder /app/packages/scanner-core ./packages/scanner-core
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/pdfkit ./node_modules/pdfkit
COPY --from=builder /app/node_modules/fontkit ./node_modules/fontkit
COPY --from=builder /app/node_modules/linebreak ./node_modules/linebreak
COPY --from=builder /app/node_modules/png-js ./node_modules/png-js
COPY --from=builder /app/node_modules/jpeg-exif ./node_modules/jpeg-exif
COPY --from=builder /app/node_modules/unicode-properties ./node_modules/unicode-properties
COPY --from=builder /app/node_modules/brotli ./node_modules/brotli
COPY --from=builder /app/node_modules/clone ./node_modules/clone
COPY --from=builder /app/node_modules/tiny-inflate ./node_modules/tiny-inflate
COPY --from=builder /app/node_modules/pako ./node_modules/pako
COPY --from=builder /app/node_modules/base64-js ./node_modules/base64-js
COPY --from=builder /app/node_modules/dfa ./node_modules/dfa
COPY --from=builder /app/node_modules/restructure ./node_modules/restructure
COPY --from=builder /app/node_modules/unicode-trie ./node_modules/unicode-trie

# Garante resolução do workspace package no runtime
RUN mkdir -p node_modules/@owasp \
  && ln -sfn /app/packages/scanner-core /app/node_modules/@owasp/scanner-core \
  && if [ -d /app/apps/web/node_modules ]; then \
       mkdir -p /app/apps/web/node_modules/@owasp \
       && ln -sfn /app/packages/scanner-core /app/apps/web/node_modules/@owasp/scanner-core; \
     fi

COPY docker/web-entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh \
  && chmod +x /entrypoint.sh \
  && mkdir -p /data \
  && chown -R nextjs:nodejs /app /data

USER nextjs
EXPOSE 3000
VOLUME ["/data"]
ENTRYPOINT ["/entrypoint.sh"]
