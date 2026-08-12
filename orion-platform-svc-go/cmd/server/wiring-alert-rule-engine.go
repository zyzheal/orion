package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"
	alertRule_handler "orion/platform-svc-go/internal/alert-rule-engine/handler"
	alertRule_repo "orion/platform-svc-go/internal/alert-rule-engine/repository"
	alertRule_service "orion/platform-svc-go/internal/alert-rule-engine/service"
)

var alertRuleEngineH *alertRule_handler.Handler

func wireAlertRuleEngine(db *database.DB, logger *zap.Logger) {
	repo := alertRule_repo.NewRepository(db.DB)
	svc := alertRule_service.NewService(repo)
	alertRuleEngineH = alertRule_handler.NewHandler(svc)
}