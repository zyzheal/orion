package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"
	condition_handler "orion/platform-svc-go/internal/condition/handler"
	condition_repo "orion/platform-svc-go/internal/condition/repository"
	condition_service "orion/platform-svc-go/internal/condition/service"
)

var conditionH *condition_handler.Handler

func wireCondition(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := condition_repo.NewRepository(db.DB)
	eng := condition_service.NewConditionEngine(repo, logger)
	conditionH = condition_handler.NewHandler(eng)
}
