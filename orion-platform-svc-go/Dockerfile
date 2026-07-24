# Multi-stage Dockerfile for orion-platform-svc-go
# Stage 1: Build with Go
# Stage 2: Minimal runtime image

# ============================================================
# Stage 1: Builder
# ============================================================
FROM golang:1.25-alpine AS builder

WORKDIR /src

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy go.mod/go.sum first for better layer caching
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source
COPY . .

# Build the binary (static, CGO disabled for alpine)
ARG TARGETARCH=amd64
ARG CGO_ENABLED=0
ARG GOPROXY=
RUN GOOS=linux GOARCH=${TARGETARCH} CGO_ENABLED=${CGO_ENABLED} \
    go build -trimpath -ldflags="-s -w" \
    -o /out/server ./cmd/server

# ============================================================
# Stage 2: Runner (alpine-based)
# ============================================================
FROM alpine:3.19 AS runner

LABEL maintainer="orion-team"
LABEL service="orion-platform-svc"
LABEL version="0.1.0"

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata

# Create non-root user
RUN addgroup -g 10001 -S orion && \
    adduser -u 10001 -S orion -G orion

# Copy migrations and binary from builder
COPY --from=builder --chown=orion:orion /out/server /usr/local/bin/server
COPY --chown=orion:orion migrations/ /app/migrations/

# Working directory for migrations lookup
WORKDIR /app

# Expose the service port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost:8080/healthz || exit 1

# Run as non-root
USER orion

# Entrypoint
ENTRYPOINT ["/usr/local/bin/server"]

# ============================================================
# Stage 3: Scratch (production minimal, optional)
# ============================================================
FROM scratch AS production

COPY --from=builder /out/server /server
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

# Note: scratch images need statically linked binaries with CGO disabled.
# The binary built with CGO_ENABLED=0 should work here, but migrations/
# need to be embedded at build time for scratch to work.
# For now, use alpine-based runner stage above.
EXPOSE 8080
ENTRYPOINT ["/server"]
