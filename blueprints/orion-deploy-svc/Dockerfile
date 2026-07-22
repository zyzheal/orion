# Multi-stage build for orion-deploy-svc
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy only production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Copy built application
COPY --from=builder /app/dist ./dist

# Set ownership
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/app.js"]
