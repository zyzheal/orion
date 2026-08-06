package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	dedup_handler "orion/platform-svc-go/internal/alert-deduplication/handler"
	dedup_repo "orion/platform-svc-go/internal/alert-deduplication/repository"
	dedup_service "orion/platform-svc-go/internal/alert-deduplication/service"
)

var alertDeduplicationH *dedup_handler.AlertDeduplicationHandler

func wireAlertDeduplication(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := dedup_repo.NewRepository(db.DB)
	svc := dedup_service.NewAlertDeduplicationService(logger, repo)
	alertDeduplicationH = dedup_handler.NewAlertDeduplicationHandler(svc)
}
