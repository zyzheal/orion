package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	release_mgmt_handler "orion/platform-svc-go/internal/release-management/handler"
	release_mgmt_repo "orion/platform-svc-go/internal/release-management/repository"
	release_mgmt_service "orion/platform-svc-go/internal/release-management/service"
)

var releaseMgmtH *release_mgmt_handler.Handler

func wireReleaseManagement(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := release_mgmt_repo.NewRepository(db.DB)
	svc := release_mgmt_service.NewService(repo)
	releaseMgmtH = release_mgmt_handler.NewHandler(svc)
}