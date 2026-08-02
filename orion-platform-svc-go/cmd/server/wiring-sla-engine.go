package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	slaengine_handler "orion/platform-svc-go/internal/sla-engine/handler"
	slaengine_repo "orion/platform-svc-go/internal/sla-engine/repository"
	slaengine_service "orion/platform-svc-go/internal/sla-engine/service"
)

func wireSLAEngine(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := slaengine_repo.NewRepository(db.DB)
	calc := slaengine_service.NewSLACalculator(repo)
	slaEngineH = slaengine_handler.NewHandler(calc)
}

var slaEngineH *slaengine_handler.Handler
