package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	tg_handler "orion/platform-svc-go/internal/tenant-gateway/handler"
	tg_repo "orion/platform-svc-go/internal/tenant-gateway/repository"
	tg_svc "orion/platform-svc-go/internal/tenant-gateway/service"
)

var tenantGatewayH *tg_handler.Handler

func wireTenantGateway(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := tg_repo.NewRepository(db.DB)
	svc := tg_svc.NewService(repo)
	tenantGatewayH = tg_handler.NewHandler(svc)
}
