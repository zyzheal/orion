package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	cmdb_import_handler "orion/platform-svc-go/internal/cmdb-import/handler"
	cmdb_import_repo "orion/platform-svc-go/internal/cmdb-import/repository"
	cmdb_import_service "orion/platform-svc-go/internal/cmdb-import/service"
)

func wireCmdbImport(db *database.DB, logger *zap.Logger) {
	_ = db
	repo := cmdb_import_repo.NewRepository(db.DB)
	svc := cmdb_import_service.NewCMDBImportManager(repo)
	cmdb_importH = cmdb_import_handler.NewHandler(svc)
}

var cmdb_importH *cmdb_import_handler.Handler
