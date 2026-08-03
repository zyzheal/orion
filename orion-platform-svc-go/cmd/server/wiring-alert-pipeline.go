package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	alert_pipeline_handler "orion/platform-svc-go/internal/alert-pipeline/handler"
	alert_pipeline_service "orion/platform-svc-go/internal/alert-pipeline/service"
)

var alertPipelineH *alert_pipeline_handler.Handler

func wireAlertPipeline(db *database.DB, logger *zap.Logger) {
	_ = db
	_ = logger
	svc := alert_pipeline_service.NewPipelineService(logger)
	alertPipelineH = alert_pipeline_handler.NewHandler(svc, logger)
}
