package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"

	sc_handler "orion/platform-svc-go/internal/service-catalog/handler"
	sc_repo "orion/platform-svc-go/internal/service-catalog/repository"
	sc_service "orion/platform-svc-go/internal/service-catalog/service"
)

var serviceCatalogH *sc_handler.Handler

func wireServiceCatalog(db *database.DB, logger *zap.Logger) {
	repo := sc_repo.NewRepository(db.DB)
	svc := sc_service.NewService(repo)
	serviceCatalogH = sc_handler.NewHandler(svc)
}