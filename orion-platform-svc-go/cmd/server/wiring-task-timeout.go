package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	task_timeout_handler "orion/platform-svc-go/internal/task-timeout/handler"
	"orion/platform-svc-go/internal/task-timeout/models"
	task_timeout_repo "orion/platform-svc-go/internal/task-timeout/repository"
	task_timeout_service "orion/platform-svc-go/internal/task-timeout/service"
)

func wireTaskTimeout(db *database.DB, logger *zap.Logger) {
	repo := task_timeout_repo.NewRepository(db.DB)
	svc := task_timeout_service.NewService(repo, task_timeout_service.Config{
		CheckIntervalMs:      60000,
		FirstRemindHours:     1,
		EscalateHours:        4,
		AutoCompleteHours:    24,
		DefaultTimeoutAction: models.TimeoutActionRemind,
	}, logger)
	taskTimeoutH = task_timeout_handler.NewHandler(svc)
}

var taskTimeoutH *task_timeout_handler.Handler
