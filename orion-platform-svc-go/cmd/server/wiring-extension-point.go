package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	extension_point_handler "orion/platform-svc-go/internal/extension-point/handler"
	ep_repo "orion/platform-svc-go/internal/extension-point/repository"
	ep_service "orion/platform-svc-go/internal/extension-point/service"
)

func wireExtensionPoint(db *database.DB, logger *zap.Logger) {
	repo := ep_repo.NewRepository(db.DB)
	bus := ep_service.NewEventBus(logger)
	registry := ep_service.NewRegistry(repo, bus, "default", logger)
	svc := ep_service.NewServiceEx(repo, registry, "default")
	extensionPointH = extension_point_handler.NewHandler(svc)
}

var extensionPointH *extension_point_handler.Handler
