package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	fh_handler "orion/platform-svc-go/internal/file-handler/handler"
	fh_service "orion/platform-svc-go/internal/file-handler/service"
)

var fileHandlerH *fh_handler.Handler

func wireFileHandler(db *database.DB, logger *zap.Logger) {
	svc := fh_service.NewFileStorageManager(db.DB, logger)
	fileHandlerH = fh_handler.NewHandler(svc)
}
