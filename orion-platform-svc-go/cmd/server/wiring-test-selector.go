package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	testselector_handler "orion/platform-svc-go/internal/test-selector/handler"
	testselector_repo "orion/platform-svc-go/internal/test-selector/repository"
	testselector_service "orion/platform-svc-go/internal/test-selector/service"
)

func wireTestSelector(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := testselector_repo.NewRepository(db.DB)
	svc := testselector_service.NewService(repo, db.DB)
	testSelectorH = testselector_handler.NewHandler(svc)
}

var testSelectorH *testselector_handler.Handler
