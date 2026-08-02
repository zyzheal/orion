package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	testgen_handler "orion/platform-svc-go/internal/test-generation/handler"
	testgen_repo "orion/platform-svc-go/internal/test-generation/repository"
	testgen_service "orion/platform-svc-go/internal/test-generation/service"
)

func wireTestGeneration(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := testgen_repo.NewRepository(db.DB)
	svc := testgen_service.NewService(repo)
	testGenH = testgen_handler.NewHandler(svc)
}

var testGenH *testgen_handler.Handler
