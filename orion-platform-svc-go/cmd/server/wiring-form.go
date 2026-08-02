package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	form_handler "orion/platform-svc-go/internal/form/handler"
	form_repo "orion/platform-svc-go/internal/form/repository"
	form_service "orion/platform-svc-go/internal/form/service"
)

func wireForm(db *database.DB, logger *zap.Logger) {
	repo := form_repo.NewRepository(db.DB)
	engine := form_service.NewFormEngine(repo, logger)
	formH = form_handler.NewHandler(engine, logger)
}

var formH *form_handler.Handler
