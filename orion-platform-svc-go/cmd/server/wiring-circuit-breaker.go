package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	cb_handler "orion/platform-svc-go/internal/circuit-breaker/handler"
	cb_repo "orion/platform-svc-go/internal/circuit-breaker/repository"
	cb_service "orion/platform-svc-go/internal/circuit-breaker/service"
)

func wireCircuitBreaker(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := cb_repo.NewRepository(db.DB)
	svc := cb_service.NewService(repo)
	circuitBreakerH = cb_handler.NewHandler(svc)
}

var circuitBreakerH *cb_handler.Handler
