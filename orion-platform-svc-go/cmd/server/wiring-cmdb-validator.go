package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	cmdb_validator_handler "orion/platform-svc-go/internal/cmdb-validator/handler"
	cmdb_validator_service "orion/platform-svc-go/internal/cmdb-validator/service"
	cmdb_validator_repo "orion/platform-svc-go/internal/cmdb-validator/repository"
)

func wireCmdbValidator(db *database.DB, logger *zap.Logger) {
	_ = db
	repo := cmdb_validator_repo.NewRepository(db.DB)
	svc := cmdb_validator_service.NewValidatorRegistry(repo, logger)
	cmdb_validatorH = cmdb_validator_handler.NewHandler(svc)
}

var cmdb_validatorH *cmdb_validator_handler.Handler
