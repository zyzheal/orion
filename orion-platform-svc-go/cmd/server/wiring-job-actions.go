package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	ja_handler "orion/platform-svc-go/internal/job-actions/handler"
	ja_repo "orion/platform-svc-go/internal/job-actions/repository"
	ja_service "orion/platform-svc-go/internal/job-actions/service"
)

var jobActionsH *ja_handler.Handler

func wireJobActions(db *database.DB, logger *zap.Logger) {
	repo := ja_repo.NewRepository(db.DB)
	exec := ja_service.NewJobActionExecutor(repo, logger)
	jobActionsH = ja_handler.NewHandler(exec, repo)
}
