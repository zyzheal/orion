package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	cmdb_import_handler "orion/platform-svc-go/internal/cmdb-import/handler"
	cmdb_import_service "orion/platform-svc-go/internal/cmdb-import/service"
)

func wireCmdbImport(db *database.DB, logger *zap.Logger) {
	_ = db
	svc := cmdb_import_service.NewService(logger)
	cmdb_importH = cmdb_import_handler.NewHandler(svc)
}

var cmdb_importH *cmdb_import_handler.Handler
