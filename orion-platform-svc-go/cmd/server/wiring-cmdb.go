package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	cmdb_attribute "orion/platform-svc-go/internal/cmdb/attribute"
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
	attrFactory := cmdb_attribute.NewWithDefaults()
	svc := cmdb_service.NewServiceWithAttributes(repo, attrFactory)
	cmdbH = cmdb_handler.NewHandler(svc)
}
