FROM golang:1.22-alpine AS builder
RUN apk add --no-cache git
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /build/tenant-svc ./cmd/server/

FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata && addgroup -g 1000 app && adduser -u 1000 -G app -s /bin/sh -D app
WORKDIR /app
COPY --from=builder /build/tenant-svc .
COPY config/config.example.yaml ./config/
USER app
EXPOSE 8083
ENV GIN_MODE=release
ENTRYPOINT ["/app/tenant-svc"]
