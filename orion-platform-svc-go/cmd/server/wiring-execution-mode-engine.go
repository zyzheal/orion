package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	eme_handler "orion/platform-svc-go/internal/execution-mode-engine/handler"
	eme_repo "orion/platform-svc-go/internal/execution-mode-engine/repository"
	eme_svc "orion/platform-svc-go/internal/execution-mode-engine/service"
)

var executionModeEngineH *eme_handler.Handler

func wireExecutionModeEngine(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := eme_repo.NewRepository(db.DB)
	svc := eme_svc.NewService(repo)
	executionModeEngineH = eme_handler.NewHandler(svc)
}