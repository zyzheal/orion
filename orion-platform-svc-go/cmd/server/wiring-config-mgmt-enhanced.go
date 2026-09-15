package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	cme_handler "orion/platform-svc-go/internal/config-mgmt-enhanced/handler"
	cme_repo "orion/platform-svc-go/internal/config-mgmt-enhanced/repository"
	cme_svc "orion/platform-svc-go/internal/config-mgmt-enhanced/service"
)

var configMgmtEnhancedH *cme_handler.Handler

func wireConfigMgmtEnhanced(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := cme_repo.NewRepository(db.DB)
	svc := cme_svc.NewService(repo)
	configMgmtEnhancedH = cme_handler.NewHandler(svc)
}
