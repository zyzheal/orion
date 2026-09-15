package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	runbook_handler "orion/platform-svc-go/internal/runbook/handler"
	runbook_repo "orion/platform-svc-go/internal/runbook/repository"
	runbook_service "orion/platform-svc-go/internal/runbook/service"
)

func wireRunbook(db *database.DB, logger *zap.Logger) {
	_ = logger
	if db == nil {
		return
	}
	repo := runbook_repo.NewRepository(db.DB)
	svc := runbook_service.NewService(repo)
	runbookH = runbook_handler.NewHandler(svc)
}
