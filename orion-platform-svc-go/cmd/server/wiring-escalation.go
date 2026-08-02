package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	escalation_handler "orion/platform-svc-go/internal/escalation/handler"
	escalation_repo "orion/platform-svc-go/internal/escalation/repository"
	escalation_service "orion/platform-svc-go/internal/escalation/service"
)

func wireEscalation(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := escalation_repo.NewRepository(db.DB)
	svc := escalation_service.NewService(repo)
	escalationH = escalation_handler.NewHandler(svc)
}

var escalationH *escalation_handler.Handler
