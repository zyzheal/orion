package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	ped_handler "orion/platform-svc-go/internal/pipeline-error-detail/handler"
	ped_repo "orion/platform-svc-go/internal/pipeline-error-detail/repository"
	ped_svc "orion/platform-svc-go/internal/pipeline-error-detail/service"
)

var pipelineErrorDetailH *ped_handler.Handler

func wirePipelineErrorDetail(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := ped_repo.NewRepository(db.DB)
	svc := ped_svc.NewService(repo)
	pipelineErrorDetailH = ped_handler.NewHandler(svc)
}
