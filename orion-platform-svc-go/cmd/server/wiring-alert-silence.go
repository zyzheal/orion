package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	as_handler "orion/platform-svc-go/internal/alert-silence/handler"
	as_service "orion/platform-svc-go/internal/alert-silence/service"
)

func wireAlertSilence(db *database.DB, logger *zap.Logger) {
	// TODO: repository requires *pgxpool.Pool — wire pgxpool at infrastructure layer first
	// svc := as_service.NewAlertSilenceService(repo, logger)
	// alertSilenceH = as_handler.NewAlertSilenceHandler(svc)
	_ = db
	_ = logger
}

var alertSilenceH *as_handler.AlertSilenceHandler
