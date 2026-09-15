package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"

	channel_handler "orion/platform-svc-go/internal/channel/handler"
	channel_repo "orion/platform-svc-go/internal/channel/repository"
	channel_service "orion/platform-svc-go/internal/channel/service"
)

var channelH *channel_handler.Handler

func wireChannel(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := channel_repo.NewRepository(db.DB)
	svc := channel_service.NewService(repo)
	channelH = channel_handler.NewHandler(svc)
}
