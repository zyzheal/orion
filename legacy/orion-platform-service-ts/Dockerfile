# Orion Platform Service - Dockerfile
# 使用 Debian-slim (glibc) 替代 Alpine (musl)，兼容 Rocky Linux 8+ / RHEL / CentOS
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build

# ==================== Production ====================
FROM node:20-slim AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --production=true

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/healthz || exit 1

CMD ["node", "dist/index.js"]