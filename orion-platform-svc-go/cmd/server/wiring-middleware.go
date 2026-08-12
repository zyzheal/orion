package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"
	mw_handler "orion/platform-svc-go/internal/middleware/handler"
	mw_repo "orion/platform-svc-go/internal/middleware/repository"
	mw_service "orion/platform-svc-go/internal/middleware/service"
)

var middlewareH *mw_handler.Handler

func wireMiddleware(db *database.DB, logger *zap.Logger) {
	repo := mw_repo.NewRepository(db.DB)
	svc := mw_service.NewService(repo)
	middlewareH = mw_handler.NewHandler(svc)
}