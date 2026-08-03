package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	as_handler "orion/platform-svc-go/internal/alert-silence/handler"
	as_repo "orion/platform-svc-go/internal/alert-silence/repository"
	as_service "orion/platform-svc-go/internal/alert-silence/service"
)

var alertSilenceH *as_handler.AlertSilenceHandler

func wireAlertSilence(db *database.DB, logger *zap.Logger) {
	repoDB := as_repo.NewDB(db.DB, logger)
	repo := as_repo.NewAlertSilenceRepository(repoDB, logger)
	svc := as_service.NewAlertSilenceService(repo, logger)
	alertSilenceH = as_handler.NewAlertSilenceHandler(svc)
}
