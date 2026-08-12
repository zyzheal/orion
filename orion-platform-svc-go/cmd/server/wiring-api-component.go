package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"
	apicomp_handler "orion/platform-svc-go/internal/api-component/handler"
	apicomp_repo "orion/platform-svc-go/internal/api-component/repository"
	apicomp_service "orion/platform-svc-go/internal/api-component/service"
)

var apiComponentH *apicomp_handler.Handler

func wireAPIComponent(db *database.DB, logger *zap.Logger) {
	repo := apicomp_repo.NewRepository(db.DB)
	svc := apicomp_service.NewService(repo)
	apiComponentH = apicomp_handler.NewHandler(svc)
}