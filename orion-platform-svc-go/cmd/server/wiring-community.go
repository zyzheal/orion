package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	community_handler "orion/platform-svc-go/internal/community/handler"
	community_repo "orion/platform-svc-go/internal/community/repository"
	community_service "orion/platform-svc-go/internal/community/service"
)

var communityH *community_handler.Handler

func wireUcommunity(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := community_repo.NewRepository(db.DB)
	svc := community_service.NewService(repo)
	communityH = community_handler.NewHandler(svc)
}
