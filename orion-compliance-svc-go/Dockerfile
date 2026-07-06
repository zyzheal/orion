# Build stage
FROM golang:1.25-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /app

# Copy go mod files first for better layer caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o compliance-svc ./cmd/server

# Final stage - minimal image
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata && addgroup -g 1000 app && adduser -u 1000 -G app -s /bin/sh -D app

WORKDIR /app

# Copy binary from builder stage
COPY --from=builder /app/compliance-svc .
COPY --from=builder /app/migrations ./migrations

# Expose port
EXPOSE 8087

# Run the service
USER app
CMD ["./compliance-svc"]
