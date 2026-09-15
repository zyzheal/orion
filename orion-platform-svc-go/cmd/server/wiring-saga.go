package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	saga_handler "orion/platform-svc-go/internal/saga/handler"
	saga_repo "orion/platform-svc-go/internal/saga/repository"
	saga_svc "orion/platform-svc-go/internal/saga/service"
)

func wireSaga(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := saga_repo.NewRepository(db.DB)
	coordinator := saga_svc.NewSagaCoordinator(repo)
	sagaH = saga_handler.NewHandler(coordinator)
}

var sagaH *saga_handler.Handler
