package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"
	inspsched_handler "orion/platform-svc-go/internal/inspection-schedule/handler"
	inspsched_repo "orion/platform-svc-go/internal/inspection-schedule/repository"
	inspsched_service "orion/platform-svc-go/internal/inspection-schedule/service"
)

var inspectionScheduleH *inspsched_handler.Handler

func wireInspectionSchedule(db *database.DB, logger *zap.Logger) {
	repo := inspsched_repo.NewRepository(db.DB)
	svc := inspsched_service.NewService(repo, logger)
	inspectionScheduleH = inspsched_handler.NewHandler(svc)
}
