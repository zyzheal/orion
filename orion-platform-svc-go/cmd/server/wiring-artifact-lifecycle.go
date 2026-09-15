package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	artifactlifecycle_handler "orion/platform-svc-go/internal/artifact-lifecycle/handler"
	artifactlifecycle_repo "orion/platform-svc-go/internal/artifact-lifecycle/repository"
	artifactlifecycle_service "orion/platform-svc-go/internal/artifact-lifecycle/service"
)

var artifactlifecycleH *artifactlifecycle_handler.Handler

func wireartifactlifecycle(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := artifactlifecycle_repo.NewRepository(db.DB)
	svc := artifactlifecycle_service.NewService(repo)
	artifactlifecycleH = artifactlifecycle_handler.NewHandler(svc)
}
