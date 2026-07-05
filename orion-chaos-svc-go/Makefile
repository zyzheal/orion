.PHONY: build test lint docker-build run migrate-up clean

BIN := chaos-svc

build:
	@echo "Building Chaos Service..."
	CGO_ENABLED=0 go build -ldflags="-s -w" -o $(BIN) ./cmd/server/

test:
	go test -race -coverprofile=coverage.out ./...
	go tool cover -func=coverage.out | grep total

lint:
	golangci-lint run ./...

docker-build:
	docker build -t orion/chaos-svc:latest .

run: build
	./$(BIN)

migrate-up:
	@echo "Running migrations..."
	@cd migrations && ls -1 *.sql | sort | while read f; do echo "Applying $$f"; done

clean:
	rm -f $(BIN) coverage.out
