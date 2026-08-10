package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	"orion/platform-svc-go/internal/data-masking/handler"
	data_masking_repo "orion/platform-svc-go/internal/data-masking/repository"
	data_masking_service "orion/platform-svc-go/internal/data-masking/service"
)

var dataMaskingH *handler.Handler

func wireDataMasking(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := data_masking_repo.NewRepository(db.DB)
	svc := data_masking_service.NewService(repo)
	dataMaskingH = handler.NewHandler(svc)
}