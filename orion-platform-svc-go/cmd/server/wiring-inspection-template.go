package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"
	insptmpl_handler "orion/platform-svc-go/internal/inspection-template/handler"
	insptmpl_repo "orion/platform-svc-go/internal/inspection-template/repository"
	insptmpl_service "orion/platform-svc-go/internal/inspection-template/service"
)

var inspectionTemplateH *insptmpl_handler.Handler
var inspectionTemplateSvc *insptmpl_service.Service

func wireInspectionTemplate(db *database.DB, logger *zap.Logger) {
	repo := insptmpl_repo.NewRepository(db.DB)
	svc := insptmpl_service.NewService(repo, logger)
	inspectionTemplateSvc = svc
	inspectionTemplateH = insptmpl_handler.NewHandler(svc)
}
