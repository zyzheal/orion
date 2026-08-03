package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	adapter_handler "orion/platform-svc-go/internal/alert-adapter/handler"
	adapter_repo "orion/platform-svc-go/internal/alert-adapter/repository"
	adapter_service "orion/platform-svc-go/internal/alert-adapter/service"
)

func wireAlertAdapter(db *database.DB, logger *zap.Logger) {
	repo := adapter_repo.NewRepository(db.DB)
	factory := adapter_service.NewFactory(repo, logger)
	svc := adapter_service.NewAdapterService(factory, repo)
	alertAdapterH = adapter_handler.NewHandler(svc)
}

var alertAdapterH *adapter_handler.Handler
