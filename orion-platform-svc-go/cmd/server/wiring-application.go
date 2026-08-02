package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	app_handler "orion/platform-svc-go/internal/application/handler"
	app_repo "orion/platform-svc-go/internal/application/repository"
	app_service "orion/platform-svc-go/internal/application/service"
)

func wireApplication(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := app_repo.NewRepository(db.DB)
	svc := app_service.NewService(repo)
	applicationH = app_handler.NewHandler(svc)
}

var applicationH *app_handler.Handler
