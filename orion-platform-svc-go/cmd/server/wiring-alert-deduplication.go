package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	dedup_handler "orion/platform-svc-go/internal/alert-deduplication/handler"
	dedup_service "orion/platform-svc-go/internal/alert-deduplication/service"
)

func wireAlertDeduplication(db *database.DB, logger *zap.Logger) {
	_ = db
	svc := dedup_service.NewAlertDeduplicationService(logger)
	alertDeduplicationH = dedup_handler.NewAlertDeduplicationHandler(svc)
}

var alertDeduplicationH *dedup_handler.AlertDeduplicationHandler
