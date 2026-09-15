package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	tool_handler "orion/platform-svc-go/internal/tool/handler"
	tool_repo "orion/platform-svc-go/internal/tool/repository"
	tool_service "orion/platform-svc-go/internal/tool/service"
)

var toolH *tool_handler.ToolHandler

func wireTool(db *database.DB, logger *zap.Logger) {
	toolRepo := tool_repo.NewToolRepository(db)
	invokeRepo := tool_repo.NewInvocationRepository(db)
	versionRepo := tool_repo.NewVersionRepository(db)
	svc := tool_service.NewToolService(toolRepo, invokeRepo, versionRepo)
	toolH = tool_handler.NewToolHandler(svc)
}
