package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	cmdb_relationship_handler "orion/platform-svc-go/internal/cmdb-relationship/handler"
	cmdb_relationship_service "orion/platform-svc-go/internal/cmdb-relationship/service"
)

func wireCmdbRelationship(db *database.DB, logger *zap.Logger) {
	_ = db
	svc := cmdb_relationship_service.NewService(logger)
	cmdb_relationshipH = cmdb_relationship_handler.NewHandler(svc)
}

var cmdb_relationshipH *cmdb_relationship_handler.Handler
