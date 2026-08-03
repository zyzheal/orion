package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	cmdb_collector_handler "orion/platform-svc-go/internal/cmdb-collector/handler"
	cmdb_collector_service "orion/platform-svc-go/internal/cmdb-collector/service"
	cmdb_collector_repo "orion/platform-svc-go/internal/cmdb-collector/repository"
)

func wireCmdbCollector(db *database.DB, logger *zap.Logger) {
	_ = db
	repo := cmdb_collector_repo.NewRepository(db.DB)
	svc := cmdb_collector_service.NewService(repo, nil, nil)
	cmdbCollectorH = cmdb_collector_handler.NewHandler(svc)
}

var cmdbCollectorH *cmdb_collector_handler.Handler
