package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	cachemgmt_handler "orion/platform-svc-go/internal/cache-mgmt/handler"
	cachemgmt_repo "orion/platform-svc-go/internal/cache-mgmt/repository"
	cachemgmt_service "orion/platform-svc-go/internal/cache-mgmt/service"
)

var cacheMgmtH *cachemgmt_handler.Handler

func wirecachemgmt(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := cachemgmt_repo.NewRepository(db.DB)
	svc := cachemgmt_service.NewService(repo, nil)
	cacheMgmtH = cachemgmt_handler.NewHandler(svc)
}
