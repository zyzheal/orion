package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	cb_handler "orion/platform-svc-go/internal/circuit-breaker/handler"
	cb_service "orion/platform-svc-go/internal/circuit-breaker/service"
)

func wireCircuitBreaker(db *database.DB, logger *zap.Logger) {
	_ = db
	svc := cb_service.NewService(logger)
	circuitBreakerH = cb_handler.NewHandler(svc)
}

var circuitBreakerH *cb_handler.Handler
