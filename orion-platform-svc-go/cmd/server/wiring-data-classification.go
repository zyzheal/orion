package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	dc_handler "orion/platform-svc-go/internal/data-classification/handler"
	dc_repo "orion/platform-svc-go/internal/data-classification/repository"
	dc_service "orion/platform-svc-go/internal/data-classification/service"
)

var dataClassificationH *dc_handler.Handler

func wireDataClassification(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := dc_repo.NewRepository(db.DB)
	svc := dc_service.NewService(repo)
	dataClassificationH = dc_handler.NewHandler(svc)
}
