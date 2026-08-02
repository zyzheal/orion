package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	mlops_handler "orion/platform-svc-go/internal/mlops/handler"
	mlops_repo "orion/platform-svc-go/internal/mlops/repository"
	mlops_service "orion/platform-svc-go/internal/mlops/service"
)

func wireMLOps(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := mlops_repo.NewRepository(db.DB)
	svc := mlops_service.NewService(repo)
	mlopsH = mlops_handler.NewHandler(svc)
}

var mlopsH *mlops_handler.Handler
