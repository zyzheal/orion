# Build stage
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git make ca-certificates

WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /build/api-gateway ./cmd/server/

# Runtime stage
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata && \
    addgroup -g 1000 app && \
    adduser -u 1000 -G app -s /bin/sh -D app

WORKDIR /app
COPY --from=builder /build/api-gateway .
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY config/config.example.yaml ./config/

USER app

EXPOSE 3000

ENV GIN_MODE=release
ENV SERVICE_NAME=orion-api-gateway

ENTRYPOINT ["/app/api-gateway"]
