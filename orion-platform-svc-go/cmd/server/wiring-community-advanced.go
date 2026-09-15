package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	ca_handler "orion/platform-svc-go/internal/community-advanced/handler"
	ca_repo "orion/platform-svc-go/internal/community-advanced/repository"
	ca_svc "orion/platform-svc-go/internal/community-advanced/service"
)

var communityAdvancedH *ca_handler.Handler

func wireCommunityAdvanced(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := ca_repo.NewRepository(db.DB)
	svc := ca_svc.NewService(repo)
	communityAdvancedH = ca_handler.NewHandler(svc)
}
