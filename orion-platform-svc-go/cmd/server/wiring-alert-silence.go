package main

import (
	"time"

	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	as_fatigue "orion/platform-svc-go/internal/alert-silence/fatigue"
	as_handler "orion/platform-svc-go/internal/alert-silence/handler"
	as_repo "orion/platform-svc-go/internal/alert-silence/repository"
	as_service "orion/platform-svc-go/internal/alert-silence/service"
)

var alertSilenceH *as_handler.AlertSilenceHandler

func wireAlertSilence(db *database.DB, logger *zap.Logger) {
	repoDB := as_repo.NewDB(db.DB, logger)
	repo := as_repo.NewAlertSilenceRepository(repoDB, logger)
	fatigueAnalyzer := as_fatigue.NewAnalyzer(10*time.Minute, 30.0)
	svc := as_service.NewAlertSilenceService(repo, logger, fatigueAnalyzer)
	alertSilenceH = as_handler.NewAlertSilenceHandler(svc, svc)
}
