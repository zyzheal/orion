package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	module_handler "orion/platform-svc-go/internal/module/handler"
	module_repo "orion/platform-svc-go/internal/module/repository"
	module_service "orion/platform-svc-go/internal/module/service"
)

var moduleH *module_handler.Handler

func wireUmodule(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := module_repo.NewRepository(db.DB)
	svc := module_service.NewService(repo)
	moduleH = module_handler.NewHandler(svc)
}
