package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	metadata_handler "orion/platform-svc-go/internal/metadata/handler"
	metadata_repo "orion/platform-svc-go/internal/metadata/repository"
	metadata_service "orion/platform-svc-go/internal/metadata/service"
)

func wireMetadata(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := metadata_repo.NewRepository(db.DB)
	svc := metadata_service.NewService(repo)
	metadataH = metadata_handler.NewHandler(svc)
}

var metadataH *metadata_handler.Handler
