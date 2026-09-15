package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	smartdeploy_handler "orion/platform-svc-go/internal/smart-deploy/handler"
	smartdeploy_repo "orion/platform-svc-go/internal/smart-deploy/repository"
	smartdeploy_service "orion/platform-svc-go/internal/smart-deploy/service"
)

var smartDeployH *smartdeploy_handler.Handler

func wiresmartdeploy(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := smartdeploy_repo.NewRepository(db.DB)
	svc := smartdeploy_service.NewService(repo)
	smartDeployH = smartdeploy_handler.NewHandler(svc)
}
