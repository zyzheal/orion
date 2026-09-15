package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	disasterrecovery_handler "orion/platform-svc-go/internal/disaster-recovery/handler"
	disasterrecovery_orch "orion/platform-svc-go/internal/disaster-recovery/orchestrator"
	disasterrecovery_repo "orion/platform-svc-go/internal/disaster-recovery/repository"
	disasterrecovery_service "orion/platform-svc-go/internal/disaster-recovery/service"
)

var disasterrecoveryH *disasterrecovery_handler.Handler

func wiredisasterrecovery(db *database.DB, logger *zap.Logger) {
	repo := disasterrecovery_repo.NewRepository(db.DB)
	svc := disasterrecovery_service.NewService(repo)

	// Wire the orchestrator with a real ShellExecutor so DR plans actually
	// execute shell commands (kubectl/pg_repack/curl etc.) instead of stubs.
	orch := disasterrecovery_orch.NewDROrchestrator(nil, logger, disasterrecovery_orch.ShellExecutor)
	svc.SetOrchestrator(orch)

	disasterrecoveryH = disasterrecovery_handler.NewHandler(svc)
}
