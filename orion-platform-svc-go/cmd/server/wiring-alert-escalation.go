package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	escalation_handler "orion/platform-svc-go/internal/alert-escalation/handler"
	escalation_repo "orion/platform-svc-go/internal/alert-escalation/repository"
	escalation_service "orion/platform-svc-go/internal/alert-escalation/service"
)

var alertEscH *escalation_handler.Handler

func wirealertescalation(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := escalation_repo.NewRepository(db.DB)
	svc := escalation_service.NewService(repo)
	alertEscH = escalation_handler.NewHandler(svc)
}
