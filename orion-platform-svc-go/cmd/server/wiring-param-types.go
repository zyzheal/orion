package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	paramtypes_handler "orion/platform-svc-go/internal/param-types/handler"
	paramtypes_repo "orion/platform-svc-go/internal/param-types/repository"
	paramtypes_service "orion/platform-svc-go/internal/param-types/service"
)

func wireParamTypes(db *database.DB, logger *zap.Logger) {
	repo := paramtypes_repo.NewRepository(db.DB)
	reg := paramtypes_service.NewParamTypeRegistry(repo, logger)
	paramTypesH = paramtypes_handler.NewHandler(reg)
}

var paramTypesH *paramtypes_handler.Handler
