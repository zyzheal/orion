package main

import (
	"orion/go-common/pkg/database"

	pipeline_budget_handler "orion/platform-svc-go/internal/pipeline-budget/handler"
	pipeline_budget_repo "orion/platform-svc-go/internal/pipeline-budget/repository"
	pipeline_budget_service "orion/platform-svc-go/internal/pipeline-budget/service"
	pipeline_templates_handler "orion/platform-svc-go/internal/pipeline-templates/handler"
	pipeline_templates_repo "orion/platform-svc-go/internal/pipeline-templates/repository"
	pipeline_templates_service "orion/platform-svc-go/internal/pipeline-templates/service"
	pipeline_versions_handler "orion/platform-svc-go/internal/pipeline-versions/handler"
	pipeline_versions_repo "orion/platform-svc-go/internal/pipeline-versions/repository"
	pipeline_versions_service "orion/platform-svc-go/internal/pipeline-versions/service"
	resilience_score_handler "orion/platform-svc-go/internal/resilience-score/handler"
	resilience_score_repo "orion/platform-svc-go/internal/resilience-score/repository"
	resilience_score_service "orion/platform-svc-go/internal/resilience-score/service"
	sbom_handler "orion/platform-svc-go/internal/sbom/handler"
	sbom_repo "orion/platform-svc-go/internal/sbom/repository"
	sbom_service "orion/platform-svc-go/internal/sbom/service"

	"go.uber.org/zap"
)

var (
	pipelineBudgetH    *pipeline_budget_handler.Handler
	pipelineTemplatesH *pipeline_templates_handler.Handler
	pipelineVersionsH  *pipeline_versions_handler.Handler
	resilienceScoreH   *resilience_score_handler.Handler
	sbomH              *sbom_handler.Handler
)

// wirePipelineModules wires pipeline-budget, pipeline-templates, pipeline-versions,
// resilience-score, and sbom handlers.
func wirePipelineModules(db *database.DB, logger *zap.Logger) {
	// pipeline-budget services
	pipelineBudgetRepo := pipeline_budget_repo.NewRepository(db.DB)
	pipelineBudgetSvc := pipeline_budget_service.NewService(pipelineBudgetRepo)
	pipelineBudgetH = pipeline_budget_handler.NewHandler(pipelineBudgetSvc)
	// pipeline-templates services
	pipelineTemplatesRepo := pipeline_templates_repo.NewRepository(db.DB)
	pipelineTemplatesSvc := pipeline_templates_service.NewService(pipelineTemplatesRepo)
	pipelineTemplatesH = pipeline_templates_handler.NewHandler(pipelineTemplatesSvc)
	// pipeline-versions services
	pipelineVersionsRepo := pipeline_versions_repo.NewRepository(db.DB)
	pipelineVersionsSvc := pipeline_versions_service.NewService(pipelineVersionsRepo)
	pipelineVersionsH = pipeline_versions_handler.NewHandler(pipelineVersionsSvc)
	// resilience-score services
	resilienceScoreRepo := resilience_score_repo.NewRepository(db.DB)
	resilienceScoreSvc := resilience_score_service.NewService(resilienceScoreRepo, db.DB)
	resilienceScoreH = resilience_score_handler.NewHandler(resilienceScoreSvc)
	// sbom services
	sbomRepo := sbom_repo.NewRepository(db.DB)
	sbomSvc := sbom_service.NewService(sbomRepo)
	sbomH = sbom_handler.NewHandler(sbomSvc)
}
