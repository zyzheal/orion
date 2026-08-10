package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"
	test_exec_engine_handler "orion/platform-svc-go/internal/test-execution-engine/handler"
	test_exec_engine_repo "orion/platform-svc-go/internal/test-execution-engine/repository"
	test_exec_engine_service "orion/platform-svc-go/internal/test-execution-engine/service"
)

var testExecEngineH *test_exec_engine_handler.Handler

func wireTestExecutionEngine(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := test_exec_engine_repo.NewRepository(db.DB)
	svc := test_exec_engine_service.NewService(repo)
	testExecEngineH = test_exec_engine_handler.NewHandler(svc)
}
