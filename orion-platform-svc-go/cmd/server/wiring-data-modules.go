package main

import (
	"orion/go-common/pkg/database"

	dataCatalog_handler "orion/platform-svc-go/internal/data-catalog/handler"
	dataCatalog_introspector "orion/platform-svc-go/internal/data-catalog/introspector"
	dataCatalog_repo "orion/platform-svc-go/internal/data-catalog/repository"
	dataCatalog_service "orion/platform-svc-go/internal/data-catalog/service"
	dataPipeline_handler "orion/platform-svc-go/internal/data-pipeline/handler"
	dataPipeline_repo "orion/platform-svc-go/internal/data-pipeline/repository"
	dataPipeline_service "orion/platform-svc-go/internal/data-pipeline/service"
	dataQuality_handler "orion/platform-svc-go/internal/data-quality/handler"
	dataQuality_repo "orion/platform-svc-go/internal/data-quality/repository"
	dataQuality_service "orion/platform-svc-go/internal/data-quality/service"

	"go.uber.org/zap"
)

var (
	dataQualityH  *dataQuality_handler.Handler
	dataPipelineH *dataPipeline_handler.Handler
)

// wireDataModules wires data-catalog, data-quality, data-pipeline handlers.
// data-catalog uses a real introspector (overrides blueprint_batch_wiring.go
// which wired with nil introspector); dataQualityH and dataPipelineH are wired
// here only.
func wireDataModules(db *database.DB, logger *zap.Logger) {
	dataCatalogRepo := dataCatalog_repo.NewRepository(db.DB)
	dataCatalogSvc := dataCatalog_service.NewService(dataCatalogRepo, dataCatalog_introspector.New())
	dataCatalogH = dataCatalog_handler.NewHandler(dataCatalogSvc)
	dataQualityRepo := dataQuality_repo.NewRepository(db.DB)
	dataQualitySvc := dataQuality_service.NewService(dataQualityRepo)
	dataQualityH = dataQuality_handler.NewHandler(dataQualitySvc)
	dataPipelineRepo := dataPipeline_repo.NewRepository(db.DB)
	dataPipelineSvc := dataPipeline_service.NewService(dataPipelineRepo)
	dataPipelineH = dataPipeline_handler.NewHandler(dataPipelineSvc)
}
