.PHONY: build test lint docker-build run migrate-up clean

BIN := user-svc

build:
	@echo "Building user service..."
	CGO_ENABLED=0 go build -ldflags="-s -w" -o $(BIN) ./cmd/server/

test:
	go test -race -coverprofile=coverage.out ./...
	go tool cover -func=coverage.out | grep total

lint:
	golangci-lint run ./...

docker-build:
	docker build -t orion/user-svc:latest .

run: build
	./$(BIN)

migrate-up:
	@for f in $$(ls migrations/*.sql | sort); do \
		echo "Applying $$f..."; \
		psql "$$DATABASE_URL" -f $$f; \
	done

clean:
	rm -f $(BIN) coverage.out
