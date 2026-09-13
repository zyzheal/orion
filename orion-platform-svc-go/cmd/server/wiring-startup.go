package main

import (
	"orion/go-common/pkg/database"
	startup_handler "orion/platform-svc-go/internal/startup/handler"
	startup_repo "orion/platform-svc-go/internal/startup/repository"
	startup_svc "orion/platform-svc-go/internal/startup/service"

	"go.uber.org/zap"
)

// The handler's Service interface used to declare interface{} for the request
// context and for return values, which forced the startupAdapter below to
// type-assert every request context before the service could see it — so a
// deadline or cancellation set by the request never reached any startup call.
// The interface is now fully typed, so the manager is passed through directly
// and the adapter is deleted. The assertion below pins that at compile time.
var _ startup_handler.Service = (*startup_svc.StartupManager)(nil)

var startupH *startup_handler.Handler

func wireStartup(db *database.DB, logger *zap.Logger) {
	repo := startup_repo.NewRepository(db.DB)
	startupH = startup_handler.NewHandler(startup_svc.NewStartupManager(repo, logger))
}
