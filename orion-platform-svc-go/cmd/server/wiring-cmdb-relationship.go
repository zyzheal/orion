package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	cmdb_relationship_handler "orion/platform-svc-go/internal/cmdb-relationship/handler"
	cmdb_relationship_service "orion/platform-svc-go/internal/cmdb-relationship/service"
	cmdb_relationship_repo "orion/platform-svc-go/internal/cmdb-relationship/repository"
)

func wireCmdbRelationship(db *database.DB, logger *zap.Logger) {
	_ = db
	repo := cmdb_relationship_repo.NewRepository(db.DB)
	svc := cmdb_relationship_service.NewRelationshipManager(repo, logger)
	cmdb_relationshipH = cmdb_relationship_handler.NewHandler(svc)
}

var cmdb_relationshipH *cmdb_relationship_handler.Handler
