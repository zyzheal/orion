package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	ta_handler "orion/platform-svc-go/internal/terminal-audit/handler"
	ta_repo "orion/platform-svc-go/internal/terminal-audit/repository"
	ta_svc "orion/platform-svc-go/internal/terminal-audit/service"
)

var terminalAuditH *ta_handler.Handler

func wireTerminalAudit(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := ta_repo.NewRepository(db.DB)
	svc := ta_svc.NewService(repo)
	terminalAuditH = ta_handler.NewHandler(svc)
}
