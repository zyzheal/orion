# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* bun.lock* ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

# Install Docker CLI for sandbox execution (Docker-out-of-Docker pattern)
RUN apk add --no-cache docker-cli curl

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Copy built artifacts
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/package.json ./package.json
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules

# Mount Docker socket (for DinD/DooD sandbox)
VOLUME ["/var/run/docker.sock"]

USER appuser

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3100/health || exit 1

ENV NODE_ENV=production

CMD ["node", "dist/app.js"]
