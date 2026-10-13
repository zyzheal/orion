package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"
	alertshift_handler "orion/platform-svc-go/internal/alert-shift/handler"
	alertshift_repo "orion/platform-svc-go/internal/alert-shift/repository"
	alertshift_service "orion/platform-svc-go/internal/alert-shift/service"
)

var alertShiftH *alertshift_handler.Handler

func wireAlertShift(db *database.DB, logger *zap.Logger) {
	repo := alertshift_repo.NewRepository(db.DB)
	svc := alertshift_service.NewService(repo, logger)
	alertShiftH = alertshift_handler.NewHandler(svc)
}
