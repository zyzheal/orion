package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	te_handler "orion/platform-svc-go/internal/task-executor/handler"
	te_repo "orion/platform-svc-go/internal/task-executor/repository"
	te_service "orion/platform-svc-go/internal/task-executor/service"
)

var taskExecutorH *te_handler.TaskExecutorHandler

func wireTaskExecutor(db *database.DB, logger *zap.Logger) {
	repo := te_repo.NewRepository(db.DB)
	svc := te_service.NewTaskExecutorService(repo, logger)
	taskExecutorH = te_handler.NewTaskExecutorHandler(svc)
}
