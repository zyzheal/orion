package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	alert_pipeline_handler "orion/platform-svc-go/internal/alert-pipeline/handler"
	alert_pipeline_repository "orion/platform-svc-go/internal/alert-pipeline/repository"
	alert_pipeline_service "orion/platform-svc-go/internal/alert-pipeline/service"
)

var alertPipelineH *alert_pipeline_handler.Handler

func wireAlertPipeline(db *database.DB, logger *zap.Logger) {
	repo := alert_pipeline_repository.NewRepository(db.DB)
	svc := alert_pipeline_service.NewPipelineService(logger, repo)
	alertPipelineH = alert_pipeline_handler.NewHandler(svc, repo, logger)
}