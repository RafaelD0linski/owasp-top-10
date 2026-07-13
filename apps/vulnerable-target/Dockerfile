FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
COPY apps/vulnerable-target/package.json ./
COPY apps/vulnerable-target/server.js ./
EXPOSE 4000
USER node
CMD ["node", "server.js"]
