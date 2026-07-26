# ============================================================
# Build Stage
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (leverage Docker cache)
COPY package.json ./
COPY tsconfig.json ./

RUN npm install

# Copy source and build
COPY src/ ./src/

RUN npm run build

# ============================================================
# Production Stage
# ============================================================
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY package.json ./
RUN npm install --omit=dev

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

USER appuser

# Expose port
EXPOSE 3009

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3009/health || exit 1

# Start the application
CMD ["node", "dist/app.js"]
