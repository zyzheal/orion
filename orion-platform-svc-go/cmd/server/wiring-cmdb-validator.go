package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	cmdb_validator_handler "orion/platform-svc-go/internal/cmdb-validator/handler"
	cmdb_validator_service "orion/platform-svc-go/internal/cmdb-validator/service"
)

func wireCmdbValidator(db *database.DB, logger *zap.Logger) {
	_ = db
	svc := cmdb_validator_service.NewService(logger)
	cmdb_validatorH = cmdb_validator_handler.NewHandler(svc)
}

var cmdb_validatorH *cmdb_validator_handler.Handler
