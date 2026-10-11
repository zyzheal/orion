package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"

	ar_handler "orion/platform-svc-go/internal/auto-recovery/handler"
	ar_repo "orion/platform-svc-go/internal/auto-recovery/repository"
	ar_service "orion/platform-svc-go/internal/auto-recovery/service"

	cap_handler "orion/platform-svc-go/internal/capacity/handler"
	cap_repo "orion/platform-svc-go/internal/capacity/repository"
	cap_service "orion/platform-svc-go/internal/capacity/service"

	mwops_handler "orion/platform-svc-go/internal/middleware-ops/handler"
	mwops_repo "orion/platform-svc-go/internal/middleware-ops/repository"
	mwops_service "orion/platform-svc-go/internal/middleware-ops/service"

	orch_handler "orion/platform-svc-go/internal/orchestration/handler"
	orch_repo "orion/platform-svc-go/internal/orchestration/repository"
	orch_service "orion/platform-svc-go/internal/orchestration/service"
)

// Handler variables for Wave 4 unwired modules
var (
	autoRecoveryH   *ar_handler.AutoRecoveryHandler
	capacityH       *cap_handler.Handler
	middlewareOpsH  *mwops_handler.Handler
	orchestrationH  *orch_handler.OrchestrationHandler
)

func wireAutoRecovery(db *database.DB, logger *zap.Logger) {
	repo := ar_repo.NewAutoRecoveryRepository(db.DB.DB)
	svc := ar_service.NewAutoRecoveryService(repo, logger)
	autoRecoveryH = ar_handler.NewAutoRecoveryHandler(svc)
}

func wireCapacity(db *database.DB, logger *zap.Logger) {
	repo := cap_repo.NewRepository(db.DB)
	svc := cap_service.NewService(repo)
	capacityH = cap_handler.NewHandler(svc)
}

// wireCrossover is disabled: repository interface mismatch (pre-existing).
// Repository exposes CreateCall/GetCall/UpdateCall/ListCalls/DeleteCall with
// *CallRecord, while service.RepositoryInterface requires Create/Get/UpdateResult/
// List/ListByTarget/Delete with *models.CrossoverCall. Needs a repository
// adapter before it can be wired.
func wireCrossover(db *database.DB, logger *zap.Logger) {
	_ = db
	_ = logger
}

func wireMiddlewareOps(db *database.DB, logger *zap.Logger) {
	repo := mwops_repo.NewRepository(db.DB)
	svc := mwops_service.NewService(repo)
	middlewareOpsH = mwops_handler.NewHandler(svc)
}

func wireOrchestration(db *database.DB, logger *zap.Logger) {
	repo := orch_repo.NewOrchestrationRepository(db.DB.DB)
	svc := orch_service.NewOrchestrationService(repo, logger)
	orchestrationH = orch_handler.NewOrchestrationHandler(svc)
}
