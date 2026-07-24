FROM --platform=$BUILDPLATFORM golang:1.24.3-alpine AS builder

WORKDIR /src
ENV CGO_ENABLED=0

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . .

ARG TARGETOS TARGETARCH VERSION
RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg/mod \
    GOOS=$TARGETOS GOARCH=$TARGETARCH go build -ldflags "-s -w -extldflags '-static' -X github.com/orion-platform/orion-knowledge/telemetry.Version=${VERSION}" -o /build/orion-knowledge-api pro/cmd/api_pro/main.go pro/cmd/api_pro/wire_gen.go \
    && GOOS=$TARGETOS GOARCH=$TARGETARCH go build -ldflags "-s -w -extldflags '-static' -X github.com/orion-platform/orion-knowledge/telemetry.Version=${VERSION}" -o /build/orion-knowledge-migrate cmd/migrate/main.go cmd/migrate/wire_gen.go

FROM alpine:3.21 AS api

RUN apk update \
    && apk upgrade \
    && apk add --no-cache ca-certificates tzdata \
    && update-ca-certificates 2>/dev/null || true \
    && rm -rf /var/cache/apk/*

WORKDIR /app

COPY --from=builder /build/orion-knowledge-api /app/orion-knowledge-api
COPY --from=builder /build/orion-knowledge-migrate /app/orion-knowledge-migrate
COPY --from=builder /src/store/pg/migration /app/migration

CMD ["sh", "-c", "/app/orion-knowledge-migrate && /app/orion-knowledge-api"]
