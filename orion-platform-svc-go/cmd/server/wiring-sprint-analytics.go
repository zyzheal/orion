package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"
	sprintanalytics_handler "orion/platform-svc-go/internal/sprint-analytics/handler"
	sprintanalytics_repo "orion/platform-svc-go/internal/sprint-analytics/repository"
	sprintanalytics_service "orion/platform-svc-go/internal/sprint-analytics/service"
)

var sprintAnalyticsH *sprintanalytics_handler.Handler

func wireSprintAnalytics(db *database.DB, logger *zap.Logger) {
	repo := sprintanalytics_repo.NewRepository(db.DB)
	svc := sprintanalytics_service.NewSprintService(repo, logger)
	sprintAnalyticsH = sprintanalytics_handler.NewHandler(svc)
}
