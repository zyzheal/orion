package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	visor_handler "orion/platform-svc-go/internal/visor/handler"
	visor_repo "orion/platform-svc-go/internal/visor/repository"
	visor_service "orion/platform-svc-go/internal/visor/service"
)

// wireVisorCore wires the main visor module (dashboards, hosts, alert rules,
// alert instances, metrics, notification channels). Distinct from visorExecH
// (visor-exec) which is a separate module.
func wireVisorCore(db *database.DB, logger *zap.Logger) {
	_ = logger
	if db == nil {
		return
	}
	repo := visor_repo.NewRepository(db.DB)
	svc := visor_service.NewService(repo)
	visorH = visor_handler.NewHandler(svc)
}

var visorH *visor_handler.Handler
