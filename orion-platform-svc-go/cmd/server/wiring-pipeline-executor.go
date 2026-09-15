package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	pipeline_executor_handler "orion/platform-svc-go/internal/pipeline-executor/handler"
	pipeline_executor_repo "orion/platform-svc-go/internal/pipeline-executor/repository"
	pipeline_executor_service "orion/platform-svc-go/internal/pipeline-executor/service"
)

func wirePipelineExecutor(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := pipeline_executor_repo.NewRepository(db.DB)
	svc := pipeline_executor_service.NewExecutor(repo, logger)
	pipelineExecutorH = pipeline_executor_handler.NewHandler(svc)
}

var pipelineExecutorH *pipeline_executor_handler.Handler
