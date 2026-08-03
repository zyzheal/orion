package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	ac_handler "orion/platform-svc-go/internal/alert-correlation/handler"
	ac_repo "orion/platform-svc-go/internal/alert-correlation/repository"
	ac_service "orion/platform-svc-go/internal/alert-correlation/service"
)

var alertCorrelationH *ac_handler.AlertCorrelationHandler

func wireAlertCorrelation(db *database.DB, logger *zap.Logger) {
	repoDB := ac_repo.NewDB(db.DB, logger)
	repo := ac_repo.NewAlertCorrelationRepository(repoDB, logger)
	svc := ac_service.NewAlertCorrelationService(repo, logger)
	alertCorrelationH = ac_handler.NewAlertCorrelationHandler(svc)
}
