# Orion Platform Service - Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build

# ==================== Production ====================
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache wget

COPY package*.json ./
RUN npm ci --production=true

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/healthz || exit 1

CMD ["node", "dist/index.js"]
