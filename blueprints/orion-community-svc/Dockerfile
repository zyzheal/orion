FROM node:22-alpine AS base
RUN apk add --no-cache dumb-init

FROM base AS builder
WORKDIR /app
COPY package.json tsconfig.json ./
COPY src/ ./src/
RUN npm install
RUN npx tsc --noEmit

FROM base AS production
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/src ./src

ENV NODE_ENV=production
ENV PORT=3029
ENV HOST=0.0.0.0

EXPOSE 3029
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.ts"]
