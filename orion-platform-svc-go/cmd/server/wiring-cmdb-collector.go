package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	cmdb_collector_handler "orion/platform-svc-go/internal/cmdb-collector/handler"
	cmdb_collector_service "orion/platform-svc-go/internal/cmdb-collector/service"
)

func wireCmdbCollector(db *database.DB, logger *zap.Logger) {
	_ = db
	svc := cmdb_collector_service.NewService(logger)
	cmdb_collectorH = cmdb_collector_handler.NewHandler(svc)
}

var cmdb_collectorH *cmdb_collector_handler.Handler
