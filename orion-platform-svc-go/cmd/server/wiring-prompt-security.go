package main

import (
	"orion/go-common/pkg/database"

	pshandler "orion/platform-svc-go/internal/prompt-security/handler"
	psrepo "orion/platform-svc-go/internal/prompt-security/repository"
	psservice "orion/platform-svc-go/internal/prompt-security/service"

	"go.uber.org/zap"
)

var promptSecurityH *pshandler.PromptSecurityHandler

func wirePromptSecurity(db *database.DB, logger *zap.Logger) {
	// Auto-migrate tables if they do not exist (defense-in-depth alongside migration system).
	if err := psrepo.AutoMigrate(db.DB); err != nil {
		logger.Warn("prompt-security auto-migration failed (will retry at runtime)", zap.Error(err))
	}

	repo := psrepo.NewRepository(db.DB)
	svc := psservice.NewPromptSecurityService(repo, logger)
	promptSecurityH = pshandler.NewPromptSecurityHandler(svc)
}
