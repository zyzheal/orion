package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	ac_handler "orion/platform-svc-go/internal/alert-correlation/handler"
	ac_service "orion/platform-svc-go/internal/alert-correlation/service"
)

func wireAlertCorrelation(db *database.DB, logger *zap.Logger) {
	// TODO: repository requires *pgxpool.Pool — wire pgxpool at infrastructure layer first
	// svc := ac_service.NewAlertCorrelationService(repo, logger)
	// alertCorrelationH = ac_handler.NewAlertCorrelationHandler(svc)
	_ = db
	_ = logger
}

var alertCorrelationH *ac_handler.AlertCorrelationHandler
