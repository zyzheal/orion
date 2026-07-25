# Build stage
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src/ ./src/

RUN npx tsc

# Runtime stage
FROM node:20-slim AS runtime

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

ENV NODE_ENV=production
ENV PORT=3100

EXPOSE 3100

CMD ["node", "dist/app.js"]
