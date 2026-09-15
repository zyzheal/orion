package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	observability_handler "orion/platform-svc-go/internal/observability/handler"
	observability_repo "orion/platform-svc-go/internal/observability/repository"
	observability_service "orion/platform-svc-go/internal/observability/service"
)

var observabilityH *observability_handler.Handler

func wireUobservability(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := observability_repo.NewRepository(db.DB)
	svc := observability_service.NewService(repo)
	observabilityH = observability_handler.NewHandler(svc)
}
