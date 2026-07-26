# ============================================================
# Build Stage
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY tsconfig.json ./

RUN npm install

COPY src/ ./src/

RUN npm run build

# ============================================================
# Production Stage
# ============================================================
FROM node:20-alpine AS production

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

USER appuser

EXPOSE 3022

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3022/health || exit 1

CMD ["node", "dist/app.js"]
