package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	tq_handler "orion/platform-svc-go/internal/tenant-quota/handler"
	tq_repo "orion/platform-svc-go/internal/tenant-quota/repository"
	tq_service "orion/platform-svc-go/internal/tenant-quota/service"
)

var tqH *tq_handler.Handler

func wireTenantQuota(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := tq_repo.NewRepository(db.DB)
	svc := tq_service.NewService(repo)
	tqH = tq_handler.NewHandler(svc)
}
