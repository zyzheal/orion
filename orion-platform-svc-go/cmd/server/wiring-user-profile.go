package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	userprofile_handler "orion/platform-svc-go/internal/user-profile/handler"
	userprofile_repo "orion/platform-svc-go/internal/user-profile/repository"
	userprofile_service "orion/platform-svc-go/internal/user-profile/service"
)

var userprofileH *userprofile_handler.Handler

func wireuserprofile(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := userprofile_repo.NewRepository(db.DB)
	svc := userprofile_service.NewService(repo)
	userprofileH = userprofile_handler.NewHandler(svc)
}
