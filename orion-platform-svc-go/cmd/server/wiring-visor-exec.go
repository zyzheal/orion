package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	visor_handler "orion/platform-svc-go/internal/visor-exec/handler"
	visor_repo "orion/platform-svc-go/internal/visor-exec/repository"
	v_service "orion/platform-svc-go/internal/visor-exec/service"
)

func wireVisorExec(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := visor_repo.NewRepository(db.DB)
	svc := v_service.NewService(repo)
	visorExecH = visor_handler.NewHandler(svc)
}

var visorExecH *visor_handler.Handler
