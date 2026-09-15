package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	apkhandler "orion/platform-svc-go/internal/apk-upload-history/handler"
	apkrepo "orion/platform-svc-go/internal/apk-upload-history/repository"
	apksvc "orion/platform-svc-go/internal/apk-upload-history/service"
)

var apkUploadHistoryH *apkhandler.Handler

func wireApkUploadHistory(db *database.DB, logger *zap.Logger) {
	_ = logger
	repo := apkrepo.NewRepository(db.DB)
	svc := apksvc.NewService(repo)
	apkUploadHistoryH = apkhandler.NewHandler(svc)
}
