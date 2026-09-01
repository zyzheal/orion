package main

import (
	"orion/go-common/pkg/database"

	agents_handler "orion/platform-svc-go/internal/agents/handler"
	aiAgents_handler "orion/platform-svc-go/internal/ai/agents/handler"
	aiAgents_repo "orion/platform-svc-go/internal/ai/agents/repository"
	aiAgents_service "orion/platform-svc-go/internal/ai/agents/service"
	aiCost_handler "orion/platform-svc-go/internal/ai/cost/handler"
	aiCost_repo "orion/platform-svc-go/internal/ai/cost/repository"
	aiCost_service "orion/platform-svc-go/internal/ai/cost/service"
	aiReview_handler "orion/platform-svc-go/internal/ai/review/handler"
	aiReview_repo "orion/platform-svc-go/internal/ai/review/repository"
	aiReview_service "orion/platform-svc-go/internal/ai/review/service"
	apiConsumption_handler "orion/platform-svc-go/internal/api-consumption/handler"
	apiConsumption_repo "orion/platform-svc-go/internal/api-consumption/repository"
	apiConsumption_service "orion/platform-svc-go/internal/api-consumption/service"
	artifactVersion_handler "orion/platform-svc-go/internal/artifact-version/handler"
	artifactVersion_repo "orion/platform-svc-go/internal/artifact-version/repository"
	artifactVersion_service "orion/platform-svc-go/internal/artifact-version/service"
	cacheCleanup_handler "orion/platform-svc-go/internal/cache-cleanup/handler"
	cacheCleanup_repo "orion/platform-svc-go/internal/cache-cleanup/repository"
	cacheCleanup_service "orion/platform-svc-go/internal/cache-cleanup/service"
	cache_mod_handler "orion/platform-svc-go/internal/cache/handler"
	cache_mod_repo "orion/platform-svc-go/internal/cache/repository"
	cache_mod_service "orion/platform-svc-go/internal/cache/service"
	contract_handler "orion/platform-svc-go/internal/contract/handler"
	contract_repo "orion/platform-svc-go/internal/contract/repository"
	contract_service "orion/platform-svc-go/internal/contract/service"
	dbdevops_handler "orion/platform-svc-go/internal/database-devops/handler"
	gw_routes_handler "orion/platform-svc-go/internal/gateway-routes/handler"
	infraCap_handler "orion/platform-svc-go/internal/infrastructure/capacity/handler"
	infraCap_repo "orion/platform-svc-go/internal/infrastructure/capacity/repository"
	infraCap_service "orion/platform-svc-go/internal/infrastructure/capacity/service"
	pe_handler "orion/platform-svc-go/internal/pipeline-engine/handler"
	pe_service "orion/platform-svc-go/internal/pipeline-engine/service"
	ps_handler "orion/platform-svc-go/internal/prompt-security/handler"
	rate_limit_handler "orion/platform-svc-go/internal/rate-limiting/handler"
	test_reports_handler "orion/platform-svc-go/internal/test-reports/handler"

	"go.uber.org/zap"
)

var (
	aiAgentsH        *aiAgents_handler.Handler
	aiCostH          *aiCost_handler.Handler
	aiReviewH        *aiReview_handler.Handler
	apiConsumptionH  *apiConsumption_handler.Handler
	artifactVersionH *artifactVersion_handler.Handler
	cacheCleanupH    *cacheCleanup_handler.Handler
	cacheModH        *cache_mod_handler.Handler
	contractH        *contract_handler.Handler
	peH              *pe_handler.Handler
	infraCapH        *infraCap_handler.Handler
	psH              *ps_handler.PromptSecurityHandler
	agentsH          *agents_handler.Handler
	dbdevopsH        *dbdevops_handler.Handler
	gwRoutesH        *gw_routes_handler.Handler
	rateLimitH       *rate_limit_handler.Handler
	testReportsH     *test_reports_handler.Handler
)

// wireInlineHandlers wires the unassigned CRUD and P1 handlers that previously
// lived inline in initWiring:
//   - Group A: ai-agents, ai-cost, ai-review, api-consumption, artifact-version,
//     cache-cleanup, cache-mod, contract
//   - Group B: pipeline-engine (peH), infrastructure-capacity
//   - Group C: psH (alias of promptSecurityH, same handler object)
//   - P1: agents, database-devops, gateway-routes, rate-limiting, test-reports
func wireInlineHandlers(db *database.DB, logger *zap.Logger) {
	// Group A: Standard CRUD handlers
	aiAgentsRepo := aiAgents_repo.NewRepository(db.DB)
	aiAgentsSvc := aiAgents_service.NewService(aiAgentsRepo)
	aiAgentsH = aiAgents_handler.NewHandler(aiAgentsSvc)
	aiCostRepo := aiCost_repo.NewRepository(db.DB)
	aiCostSvc := aiCost_service.NewService(aiCostRepo)
	aiCostH = aiCost_handler.NewHandler(aiCostSvc)
	aiReviewRepo := aiReview_repo.NewRepository(db.DB)
	aiReviewSvc := aiReview_service.NewService(aiReviewRepo)
	aiReviewH = aiReview_handler.NewHandler(aiReviewSvc)
	apiConsumptionRepo := apiConsumption_repo.NewRepository(db.DB)
	apiConsumptionSvc := apiConsumption_service.NewService(apiConsumptionRepo)
	apiConsumptionH = apiConsumption_handler.NewHandler(apiConsumptionSvc)
	artifactVersionRepo := artifactVersion_repo.NewRepository(db.DB)
	artifactVersionSvc := artifactVersion_service.NewService(artifactVersionRepo)
	artifactVersionH = artifactVersion_handler.NewHandler(artifactVersionSvc)
	cacheCleanupRepo := cacheCleanup_repo.NewRepository(db.DB)
	cacheCleanupSvc := cacheCleanup_service.NewService(cacheCleanupRepo)
	cacheCleanupH = cacheCleanup_handler.NewHandler(cacheCleanupSvc)
	cacheModRepo := cache_mod_repo.NewRepository(db.DB)
	cacheModSvc := cache_mod_service.NewService(cacheModRepo)
	cacheModH = cache_mod_handler.NewHandler(cacheModSvc)
	contractRepo := contract_repo.NewRepository(db.DB)
	contractSvc := contract_service.NewService(contractRepo)
	contractH = contract_handler.NewHandler(contractSvc)
	// Group B: Special handlers
	// selfHealing requires pgxpool (not available from sqlx.DB),
	// defer to infrastructure layer wiring. Keep nil so router guard skips it.
	peH = pe_handler.NewHandler(&pe_service.PipelineEngine{})
	infraCapPoolRepo := infraCap_repo.NewPoolRepository(db.DB)
	infraCapForecastRepo := infraCap_repo.NewForecastRepository(db.DB)
	infraCapPolicyRepo := infraCap_repo.NewPolicyRepository(db.DB)
	infraCapMetricRepo := infraCap_repo.NewMetricRepository(db.DB)
	infraCapAlertRepo := infraCap_repo.NewAlertRepository(db.DB)
	infraCapReportRepo := infraCap_repo.NewReportRepository(db.DB)
	infraCapSvc := infraCap_service.NewService(infraCapPoolRepo, infraCapForecastRepo, infraCapPolicyRepo, infraCapMetricRepo, infraCapAlertRepo, infraCapReportRepo)
	infraCapH = infraCap_handler.NewHandler(infraCapSvc)
	// Group C: Duplicate — psH shares the same handler as promptSecurityH
	psH = promptSecurityH
	// P1: agents, database-devops, gateway-routes, rate-limiting, test-reports
	agentsH = agents_handler.NewHandler(db.DB)
	// database-devops: backup/restore operations only. Data source management
	// was removed in ARCH-0.11b — /data-sources (internal/datasource) is the
	// single source of truth for data source CRUD + encryption.
	dbdevopsH = dbdevops_handler.NewHandler(db.DB)
	wireDatabaseDevopsExecutors(logger) // ARCH-0.10b: real backup/restore execution
	gwRoutesH = gw_routes_handler.NewHandler(db.DB)
	rateLimitH = rate_limit_handler.NewHandler(db.DB)
	testReportsH = test_reports_handler.NewHandler(db.DB)
}
