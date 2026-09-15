package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	userstatus_handler "orion/platform-svc-go/internal/user-status/handler"
	userstatus_repo "orion/platform-svc-go/internal/user-status/repository"
	userstatus_service "orion/platform-svc-go/internal/user-status/service"
)

var userstatusH *userstatus_handler.Handler

func wireuserstatus(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := userstatus_repo.NewRepository(db.DB)
	svc := userstatus_service.NewService(repo)
	userstatusH = userstatus_handler.NewHandler(svc)
}
