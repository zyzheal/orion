package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	ap_handler "orion/platform-svc-go/internal/autonomous-pipeline/handler"
	ap_repo "orion/platform-svc-go/internal/autonomous-pipeline/repository"
	ap_svc "orion/platform-svc-go/internal/autonomous-pipeline/service"
)

var autonomousPipelineH *ap_handler.Handler

func wireAutonomousPipeline(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := ap_repo.NewRepository(db.DB)
	svc := ap_svc.NewService(repo)
	autonomousPipelineH = ap_handler.NewHandler(svc)
}
