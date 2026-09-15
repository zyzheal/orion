package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	mcp_handler "orion/platform-svc-go/internal/mcp/handler"
	mcp_repo "orion/platform-svc-go/internal/mcp/repository"
	mcp_service "orion/platform-svc-go/internal/mcp/service"
)

var mcpH *mcp_handler.Handler

func wireUmcp(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := mcp_repo.NewRepository(db.DB)
	svc := mcp_service.NewService(repo)
	mcpH = mcp_handler.NewHandler(svc)
}
