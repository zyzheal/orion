package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	pandawiki_handler "orion/platform-svc-go/internal/pandawiki/handler"
	pandawiki_repo "orion/platform-svc-go/internal/pandawiki/repository"
	pandawiki_service "orion/platform-svc-go/internal/pandawiki/service"
)

func wirePandawiki(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := pandawiki_repo.NewRepository(db.DB)
	svc := pandawiki_service.NewService(repo)
	pandawikiH = pandawiki_handler.NewHandler(svc)
}

var pandawikiH *pandawiki_handler.Handler
