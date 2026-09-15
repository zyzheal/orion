package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	llmtrace_handler "orion/platform-svc-go/internal/llm-trace/handler"
	llmtrace_repo "orion/platform-svc-go/internal/llm-trace/repository"
	llmtrace_service "orion/platform-svc-go/internal/llm-trace/service"
)

var ai_llmtraceH *llmtrace_handler.Handler

func wirellmtrace(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := llmtrace_repo.NewRepository(db.DB)
	svc := llmtrace_service.NewService(repo)
	ai_llmtraceH = llmtrace_handler.NewHandler(svc)
}
