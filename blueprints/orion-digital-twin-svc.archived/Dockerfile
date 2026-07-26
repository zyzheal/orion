FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json ./
RUN bun install
COPY src/ ./src/
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app
COPY package.json ./
RUN bun install --production
COPY --from=builder /app/dist ./dist
EXPOSE 3020
CMD ["bun", "run", "dist/app.js"]
