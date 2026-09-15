package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	rca_handler "orion/platform-svc-go/internal/rca/handler"
	rca_repo "orion/platform-svc-go/internal/rca/repository"
	rca_service "orion/platform-svc-go/internal/rca/service"
)

var rcaH *rca_handler.RCAHandler

func wireRCA(db *database.DB, logger *zap.Logger) {
	repo := rca_repo.NewRCARespository(db.DB, logger)
	svc := rca_service.NewRCAService(repo, logger)
	rcaH = rca_handler.NewRCAHandler(svc)
}
