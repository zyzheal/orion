package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	"orion/platform-svc-go/internal/code-embedding/handler"
	"orion/platform-svc-go/internal/code-embedding/repository"
	"orion/platform-svc-go/internal/code-embedding/service"
)

var codeEmbeddingH *handler.CodeEmbeddingHandler

func wireCodeEmbedding(db *database.DB, logger *zap.Logger) {
	repo := repository.NewRepository(db.DB)
	svc := service.NewCodeEmbeddingService(logger, repo)
	codeEmbeddingH = handler.NewCodeEmbeddingHandler(svc)
}
