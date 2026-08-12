package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	condition_repo "orion/platform-svc-go/internal/condition/repository"
	condition_service "orion/platform-svc-go/internal/condition/service"
	re_handler "orion/platform-svc-go/internal/rule-engine/handler"
	re_repo "orion/platform-svc-go/internal/rule-engine/repository"
	re_service "orion/platform-svc-go/internal/rule-engine/service"
)

var ruleEngineH *re_handler.RuleEngineHandler

func wireRuleEngine(db *database.DB, logger *zap.Logger) {
	repo := re_repo.NewRepository(db.DB)
	svc := re_service.NewRuleEngineService(repo, logger)
	// Inject the shared condition engine for JSON DSL condition evaluation.
	condRepo := condition_repo.NewRepository(db.DB)
	condEng := condition_service.NewConditionEngine(condRepo, logger)
	svc.SetConditionEngine(condEng)
	ruleEngineH = re_handler.NewRuleEngineHandler(svc)
}
