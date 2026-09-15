package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	useractivity_handler "orion/platform-svc-go/internal/user-activity/handler"
	useractivity_repo "orion/platform-svc-go/internal/user-activity/repository"
	useractivity_service "orion/platform-svc-go/internal/user-activity/service"
)

var useractivityH *useractivity_handler.Handler

func wireuseractivity(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := useractivity_repo.NewRepository(db.DB)
	svc := useractivity_service.NewService(repo)
	useractivityH = useractivity_handler.NewHandler(svc)
}
