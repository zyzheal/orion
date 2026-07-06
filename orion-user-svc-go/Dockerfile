FROM golang:1.25-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server ./cmd/server/

FROM alpine:3.19

RUN apk add --no-cache ca-certificates
RUN addgroup -g 1000 app && adduser -u 1000 -G app -s /bin/sh -D app
WORKDIR /app

COPY --from=builder /app/server .

EXPOSE ${PORT:-8084}

USER app
CMD ["./server"]
