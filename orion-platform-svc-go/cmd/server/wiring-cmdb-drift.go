package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	cmdb_drift_handler "orion/platform-svc-go/internal/cmdb-drift/handler"
	cmdb_drift_repo "orion/platform-svc-go/internal/cmdb-drift/repository"
	cmdb_drift_service "orion/platform-svc-go/internal/cmdb-drift/service"
)

func wireCmdbDrift(db *database.DB, logger *zap.Logger) {
	repo := cmdb_drift_repo.NewRepository(db.DB)
	svc := cmdb_drift_service.NewDriftDetector(repo, logger)
	cmdbDriftH = cmdb_drift_handler.NewHandler(svc)
}

var cmdbDriftH *cmdb_drift_handler.Handler
