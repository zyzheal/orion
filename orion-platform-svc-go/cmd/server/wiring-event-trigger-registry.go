package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	etr_handler "orion/platform-svc-go/internal/event-trigger-registry/handler"
	etr_repo "orion/platform-svc-go/internal/event-trigger-registry/repository"
	etr_svc "orion/platform-svc-go/internal/event-trigger-registry/service"
)

var eventTriggerRegistryH *etr_handler.Handler

func wireEventTriggerRegistry(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := etr_repo.NewRepository(db.DB)
	svc := etr_svc.NewService(repo)
	eventTriggerRegistryH = etr_handler.NewHandler(svc)
}
