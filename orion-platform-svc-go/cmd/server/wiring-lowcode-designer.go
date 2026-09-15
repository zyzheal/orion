package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	lc_handler "orion/platform-svc-go/internal/lowcode-designer/handler"
	lc_repo "orion/platform-svc-go/internal/lowcode-designer/repository"
	lc_service "orion/platform-svc-go/internal/lowcode-designer/service"
)

var lcH *lc_handler.Handler

func wirelowcodesigner(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := lc_repo.NewRepository(db.DB)
	svc := lc_service.NewService(repo)
	lcH = lc_handler.NewHandler(svc)
}
