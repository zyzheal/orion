package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	inspection_handler "orion/platform-svc-go/internal/inspection/handler"
	inspection_repo "orion/platform-svc-go/internal/inspection/repository"
	inspection_service "orion/platform-svc-go/internal/inspection/service"
)

var inspectionH *inspection_handler.Handler

func wireInspection(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := inspection_repo.NewRepository(db.DB)
	svc := inspection_service.NewService(repo)
	inspectionH = inspection_handler.NewHandler(svc)
}
