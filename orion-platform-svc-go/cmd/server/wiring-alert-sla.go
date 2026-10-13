package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"
	alertsla_handler "orion/platform-svc-go/internal/alert-sla/handler"
	alertsla_repo "orion/platform-svc-go/internal/alert-sla/repository"
	alertsla_service "orion/platform-svc-go/internal/alert-sla/service"
)

var alertSlaH *alertsla_handler.Handler

func wireAlertSLA(db *database.DB, logger *zap.Logger) {
	repo := alertsla_repo.NewRepository(db.DB)
	svc := alertsla_service.NewService(repo, logger)
	alertSlaH = alertsla_handler.NewHandler(svc)
}
