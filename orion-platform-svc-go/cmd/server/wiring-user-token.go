package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	usertoken_handler "orion/platform-svc-go/internal/user-token/handler"
	usertoken_repo "orion/platform-svc-go/internal/user-token/repository"
	usertoken_service "orion/platform-svc-go/internal/user-token/service"
)

var usertokenH *usertoken_handler.Handler

func wireusertoken(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := usertoken_repo.NewRepository(db.DB)
	svc := usertoken_service.NewService(repo)
	usertokenH = usertoken_handler.NewHandler(svc)
}
