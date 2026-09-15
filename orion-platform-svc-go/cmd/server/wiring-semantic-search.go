package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	ss_handler "orion/platform-svc-go/internal/semantic-search/handler"
	ss_repo "orion/platform-svc-go/internal/semantic-search/repository"
	ss_service "orion/platform-svc-go/internal/semantic-search/service"
)

var semanticSearchH *ss_handler.SemanticSearchHandler

func wireSemanticSearch(db *database.DB, logger *zap.Logger) {
	repo := ss_repo.NewSemanticSearchRepository(db.DB.DB)
	svc := ss_service.NewSemanticSearchService(repo, logger)
	semanticSearchH = ss_handler.NewSemanticSearchHandler(svc)
}
