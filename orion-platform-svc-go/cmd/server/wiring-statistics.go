package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"
	stats_handler "orion/platform-svc-go/internal/statistics/handler"
	stats_repo "orion/platform-svc-go/internal/statistics/repository"
	stats_service "orion/platform-svc-go/internal/statistics/service"
)

var statisticsH *stats_handler.Handler

func wireStatistics(db *database.DB, logger *zap.Logger) {
	repo := stats_repo.NewRepository(db.DB, 1000)
	svc := stats_service.NewService(repo)
	statisticsH = stats_handler.NewHandler(svc)
}