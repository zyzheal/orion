.PHONY: build test lint docker-build run migrate-up clean

BIN := api-gateway

build:
	@echo "Building API Gateway..."
	CGO_ENABLED=0 go build -ldflags="-s -w" -o $(BIN) ./cmd/server/

test:
	go test -race -coverprofile=coverage.out ./...
	go tool cover -func=coverage.out | grep total

lint:
	golangci-lint run ./...

docker-build:
	docker build -t orion/api-gateway:latest .

run: build
	./$(BIN)

migrate-up:
	@echo "Gateway has no database migrations"

clean:
	rm -f $(BIN) coverage.out
