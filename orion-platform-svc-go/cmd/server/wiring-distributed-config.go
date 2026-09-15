package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	dc_handler "orion/platform-svc-go/internal/distributed-config/handler"
	dc_repo "orion/platform-svc-go/internal/distributed-config/repository"
	dc_service "orion/platform-svc-go/internal/distributed-config/service"
)

var dcH *dc_handler.Handler

func wiredistributedconfig(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := dc_repo.NewRepository(db.DB)
	svc := dc_service.NewService(repo)
	dcH = dc_handler.NewHandler(svc)
}
