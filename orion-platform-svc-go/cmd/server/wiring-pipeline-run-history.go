package main

import (
    "go.uber.org/zap"
    "orion/go-common/pkg/database"
    prh_handler "orion/platform-svc-go/internal/pipeline-run-history/handler"
    prh_repo "orion/platform-svc-go/internal/pipeline-run-history/repository"
    prh_service "orion/platform-svc-go/internal/pipeline-run-history/service"
)

var pipelineRunHistoryH *prh_handler.Handler

func wirePipelineRunHistory(db *database.DB, logger *zap.Logger) {
    _ = logger
    repo := prh_repo.NewRepository(db.DB)
    svc := prh_service.NewService(repo)
    pipelineRunHistoryH = prh_handler.NewHandler(svc)
}
