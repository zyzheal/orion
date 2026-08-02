package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	ie_handler "orion/platform-svc-go/internal/import-export/handler"
	ie_async "orion/platform-svc-go/internal/import-export/async"
	ie_factory "orion/platform-svc-go/internal/import-export/factory"
	ie_repo "orion/platform-svc-go/internal/import-export/repository"
	ie_service "orion/platform-svc-go/internal/import-export/service"
)

func wireImportExport(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := ie_repo.NewRepository(db.DB)
	factory := ie_factory.NewFactory()
	svc := ie_service.NewImportExportService(factory, repo)
	asyncSvc := ie_async.NewProcessor(factory, repo)
	importExportH = ie_handler.NewHandler(svc, asyncSvc)
}

var importExportH *ie_handler.Handler
