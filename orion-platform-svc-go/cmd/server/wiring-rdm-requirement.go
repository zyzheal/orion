package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"
	rdmreq_handler "orion/platform-svc-go/internal/rdm/requirement/handler"
	rdmreq_repo "orion/platform-svc-go/internal/rdm/requirement/repository"
	rdmreq_service "orion/platform-svc-go/internal/rdm/requirement/service"
)

var rdmRequirementH *rdmreq_handler.Handler

func wireRDMRequirement(db *database.DB, logger *zap.Logger) {
	repo := rdmreq_repo.NewRepository(db.DB)
	svc := rdmreq_service.NewService(repo, logger)
	rdmRequirementH = rdmreq_handler.NewHandler(svc)
}
