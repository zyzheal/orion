package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"
	re_handler "orion/platform-svc-go/internal/roweditor/handler"
	re_repo "orion/platform-svc-go/internal/roweditor/repository"
	re_service "orion/platform-svc-go/internal/roweditor/service"
	re_roweditor "orion/platform-svc-go/internal/roweditor"
)

var roweditorH *re_handler.Handler

func wireRoweditor(db *database.DB, logger *zap.Logger) {
	repo := re_repo.NewRepository(db.DB)
	svc := re_service.NewService(repo)
	dbOps := re_roweditor.NewDBFromGoCommon(db.DB)
	roweditorH = re_handler.NewHandler(svc, dbOps)
}