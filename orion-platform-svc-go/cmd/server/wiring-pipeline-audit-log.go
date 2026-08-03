package main

import (
    "go.uber.org/zap"
    "orion/go-common/pkg/database"
    pal_handler "orion/platform-svc-go/internal/pipeline-audit-log/handler"
    pal_repo "orion/platform-svc-go/internal/pipeline-audit-log/repository"
    pal_service "orion/platform-svc-go/internal/pipeline-audit-log/service"
)

var pipelineAuditLogH *pal_handler.Handler

func wirePipelineAuditLog(db *database.DB, logger *zap.Logger) {
    _ = logger
    repo := pal_repo.NewRepository(db.DB)
    svc := pal_service.NewService(repo)
    pipelineAuditLogH = pal_handler.NewHandler(svc)
}
