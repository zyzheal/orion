package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	vector_handler "orion/platform-svc-go/internal/vector/handler"
	vector_repo "orion/platform-svc-go/internal/vector/repository"
	vector_service "orion/platform-svc-go/internal/vector/service"
)

var vectorH *vector_handler.Handler

func wireUvector(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := vector_repo.NewRepository(db.DB)
	svc := vector_service.NewService(repo)
	vectorH = vector_handler.NewHandler(svc)
}
