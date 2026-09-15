package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	cmdb_handler "orion/platform-svc-go/internal/cmdb/handler"
	cmdb_repo "orion/platform-svc-go/internal/cmdb/repository"
	cmdb_service "orion/platform-svc-go/internal/cmdb/service"
)

func wireCmdb(db *database.DB, logger *zap.Logger) {
	_ = logger
	if db == nil {
		return
	}
	repo := cmdb_repo.NewRepository(db.DB)
	svc := cmdb_service.NewService(repo)
	cmdbH = cmdb_handler.NewHandler(svc)
}
