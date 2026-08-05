package main
import (
	gs_handler "orion/platform-svc-go/internal/global-search/handler"
	pm_handler "orion/platform-svc-go/internal/plugin-marketplace/handler"
	pm_repo "orion/platform-svc-go/internal/plugin-marketplace/repository"
	pm_service "orion/platform-svc-go/internal/plugin-marketplace/service"
	user_handler "orion/platform-svc-go/internal/user/handler"
	user_repo "orion/platform-svc-go/internal/user/repository"
	user_service "orion/platform-svc-go/internal/user/service"
	auth_handler "orion/platform-svc-go/internal/auth/handler"
	auth_repo "orion/platform-svc-go/internal/auth/repository"
	auth_service "orion/platform-svc-go/internal/auth/service"
	perm_handler "orion/platform-svc-go/internal/permission/handler"
	perm_repo "orion/platform-svc-go/internal/permission/repository"
	perm_service "orion/platform-svc-go/internal/permission/service"
	pipeline_service "orion/platform-svc-go/internal/pipeline/service"
	skill_handler "orion/platform-svc-go/internal/skill/handler"
	// ---- Wave 2: Auth + Permission modules ----
	// ---- Wave 5: Pipeline Assistant modules ----
	// ---- Wave 7a: P2 modules ----
	// ---- problem module ----
	// ---- new blueprint modules ----
	dataCatalog_handler "orion/platform-svc-go/internal/data-catalog/handler"
	dataCatalog_repo "orion/platform-svc-go/internal/data-catalog/repository"
	dataCatalog_service "orion/platform-svc-go/internal/data-catalog/service"
	dataCatalog_introspector "orion/platform-svc-go/internal/data-catalog/introspector"
	dataQuality_handler "orion/platform-svc-go/internal/data-quality/handler"
	dataQuality_repo    "orion/platform-svc-go/internal/data-quality/repository"
	dataQuality_service "orion/platform-svc-go/internal/data-quality/service"
	dataPipeline_handler "orion/platform-svc-go/internal/data-pipeline/handler"
	dataPipeline_repo    "orion/platform-svc-go/internal/data-pipeline/repository"
	dataPipeline_service "orion/platform-svc-go/internal/data-pipeline/service"
	apiConsumption_handler "orion/platform-svc-go/internal/api-consumption/handler"
	// ---- GraphViz module ----
	graphviz_handler "orion/platform-svc-go/internal/graphviz/handler"
	contract_handler "orion/platform-svc-go/internal/contract/handler"
	pe_handler "orion/platform-svc-go/internal/pipeline-engine/handler"
	// ---- Blueprint CI-CD merge: ci-cd subdomain handlers ----
	ciArtReg_handler "orion/platform-svc-go/internal/ci-cd/artifact-registry/handler"
	ciArtReg_repo "orion/platform-svc-go/internal/ci-cd/artifact-registry/repository"
	ciArtReg_service "orion/platform-svc-go/internal/ci-cd/artifact-registry/service"
	ciArtVer_handler "orion/platform-svc-go/internal/ci-cd/artifact-version/handler"
	ciArtVer_repo "orion/platform-svc-go/internal/ci-cd/artifact-version/repository"
	ciArtVer_service "orion/platform-svc-go/internal/ci-cd/artifact-version/service"
	ciBuild_handler "orion/platform-svc-go/internal/ci-cd/build/handler"
	ciCanary_handler "orion/platform-svc-go/internal/ci-cd/canary/handler"
	ciDeploy_handler "orion/platform-svc-go/internal/ci-cd/deploy/handler"
	ciPipeline_handler "orion/platform-svc-go/internal/ci-cd/pipeline/handler"
	ciPTmpl_handler "orion/platform-svc-go/internal/ci-cd/pipeline-template/handler"
	ciPTmpl_repo "orion/platform-svc-go/internal/ci-cd/pipeline-template/repository"
	ciPTmpl_service "orion/platform-svc-go/internal/ci-cd/pipeline-template/service"
	ciRunner_handler "orion/platform-svc-go/internal/ci-cd/runner/handler"
	ciRunner_repo "orion/platform-svc-go/internal/ci-cd/runner/repository"
	ciRunner_service "orion/platform-svc-go/internal/ci-cd/runner/service"
	// ---- Blueprint InfraOps merge: infrastructure subdomain handlers ----
	infraCap_handler "orion/platform-svc-go/internal/infrastructure/capacity/handler"
	infraDr_handler "orion/platform-svc-go/internal/infrastructure/dr/handler"
	infraDr_repo "orion/platform-svc-go/internal/infrastructure/dr/repository"
	infraDr_service "orion/platform-svc-go/internal/infrastructure/dr/service"
	infraEE_handler "orion/platform-svc-go/internal/infrastructure/ephemeral-env/handler"
	infraEE_repo "orion/platform-svc-go/internal/infrastructure/ephemeral-env/repository"
	infraEE_service "orion/platform-svc-go/internal/infrastructure/ephemeral-env/service"
	infraMW_handler "orion/platform-svc-go/internal/infrastructure/middleware-ops/handler"
	infraBackup_handler "orion/platform-svc-go/internal/infrastructure/backup/handler"
	infraBackup_repo "orion/platform-svc-go/internal/infrastructure/backup/repository"
	infraBackup_service "orion/platform-svc-go/internal/infrastructure/backup/service"
	infraChaos_handler "orion/platform-svc-go/internal/infrastructure/chaos/handler"
	infraChaos_repo "orion/platform-svc-go/internal/infrastructure/chaos/repository"
	infraChaos_service "orion/platform-svc-go/internal/infrastructure/chaos/service"
	infraDba_handler "orion/platform-svc-go/internal/infrastructure/dba/handler"
	infraDba_repo "orion/platform-svc-go/internal/infrastructure/dba/repository"
	infraDba_service "orion/platform-svc-go/internal/infrastructure/dba/service"
	infraDegradation_handler "orion/platform-svc-go/internal/infrastructure/degradation/handler"
	infraDegradation_repo "orion/platform-svc-go/internal/infrastructure/degradation/repository"
	infraDegradation_service "orion/platform-svc-go/internal/infrastructure/degradation/service"
	infraDTwin_handler "orion/platform-svc-go/internal/infrastructure/digital-twin/handler"
	infraDTwin_repo "orion/platform-svc-go/internal/infrastructure/digital-twin/repository"
	infraDTwin_service "orion/platform-svc-go/internal/infrastructure/digital-twin/service"
	infraIac_handler "orion/platform-svc-go/internal/infrastructure/iac/handler"
	infraIac_repo "orion/platform-svc-go/internal/infrastructure/iac/repository"
	infraIac_service "orion/platform-svc-go/internal/infrastructure/iac/service"
	infraMWn_handler "orion/platform-svc-go/internal/infrastructure/maintenance-window/handler"
	infraMWn_repo "orion/platform-svc-go/internal/infrastructure/maintenance-window/repository"
	infraMWn_service "orion/platform-svc-go/internal/infrastructure/maintenance-window/service"
	infraMulti_handler "orion/platform-svc-go/internal/infrastructure/multicloud/handler"
	infraMulti_repo "orion/platform-svc-go/internal/infrastructure/multicloud/repository"
	infraMulti_service "orion/platform-svc-go/internal/infrastructure/multicloud/service"
	infraOCI_handler "orion/platform-svc-go/internal/infrastructure/oci-registry/handler"
	infraOCI_repo "orion/platform-svc-go/internal/infrastructure/oci-registry/repository"
	infraOCI_service "orion/platform-svc-go/internal/infrastructure/oci-registry/service"
	infraServerless_handler "orion/platform-svc-go/internal/infrastructure/serverless/handler"
	infraServerless_repo "orion/platform-svc-go/internal/infrastructure/serverless/repository"
	infraServerless_service "orion/platform-svc-go/internal/infrastructure/serverless/service"
	// ---- Batch 1: registered modules ----
	aiAgents_handler "orion/platform-svc-go/internal/ai/agents/handler"
	aiCost_handler "orion/platform-svc-go/internal/ai/cost/handler"
	aiGateway_handler "orion/platform-svc-go/internal/ai/gateway/handler"
	aiDecisions_handler "orion/platform-svc-go/internal/ai/decisions/handler"
	aiDecisions_repo "orion/platform-svc-go/internal/ai/decisions/repository"
	aiDecisions_service "orion/platform-svc-go/internal/ai/decisions/service"
	aiGateway_repo "orion/platform-svc-go/internal/ai/gateway/repository"
	aiGateway_service "orion/platform-svc-go/internal/ai/gateway/service"
	llmprovider "orion/platform-svc-go/internal/ai/llm-provider"
	aiReview_handler "orion/platform-svc-go/internal/ai/review/handler"
	artifactVersion_handler "orion/platform-svc-go/internal/artifact-version/handler"
	cache_mod_handler "orion/platform-svc-go/internal/cache/handler"
	cacheCleanup_handler "orion/platform-svc-go/internal/cache-cleanup/handler"
	aiReview_repo "orion/platform-svc-go/internal/ai/review/repository"
	aiReview_service "orion/platform-svc-go/internal/ai/review/service"
	aiAgents_repo "orion/platform-svc-go/internal/ai/agents/repository"
	aiAgents_service "orion/platform-svc-go/internal/ai/agents/service"
	aiCost_repo "orion/platform-svc-go/internal/ai/cost/repository"
	aiCost_service "orion/platform-svc-go/internal/ai/cost/service"
	apiConsumption_repo "orion/platform-svc-go/internal/api-consumption/repository"
	apiConsumption_service "orion/platform-svc-go/internal/api-consumption/service"
	artifactVersion_repo "orion/platform-svc-go/internal/artifact-version/repository"
	artifactVersion_service "orion/platform-svc-go/internal/artifact-version/service"
	cache_mod_repo "orion/platform-svc-go/internal/cache/repository"
	cache_mod_service "orion/platform-svc-go/internal/cache/service"
	cacheCleanup_repo "orion/platform-svc-go/internal/cache-cleanup/repository"
	cacheCleanup_service "orion/platform-svc-go/internal/cache-cleanup/service"
	contract_repo "orion/platform-svc-go/internal/contract/repository"
	contract_service "orion/platform-svc-go/internal/contract/service"
	infraCap_repo "orion/platform-svc-go/internal/infrastructure/capacity/repository"
	infraCap_service "orion/platform-svc-go/internal/infrastructure/capacity/service"
	pe_service "orion/platform-svc-go/internal/pipeline-engine/service"
	// ---- Wave 7: P2 module imports (batch 1-2 + alert/apm/bi/canary) ----
	message_queue_handler "orion/platform-svc-go/internal/message-queue/handler"
	// ---- P0-6: Agent sandbox (isolated code execution) ----
	sandbox_handler "orion/platform-svc-go/internal/sandbox/handler"
	aiModels_handler "orion/platform-svc-go/internal/ai/models/handler"
	aiModels_repo "orion/platform-svc-go/internal/ai/models/repository"
	aiModels_service "orion/platform-svc-go/internal/ai/models/service"
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
	sandbox_repo "orion/platform-svc-go/internal/sandbox/repository"
	sandbox_service "orion/platform-svc-go/internal/sandbox/service"
	// ---- P0-9: Centralized logging service ----
	logging_handler "orion/platform-svc-go/internal/logging/handler"
	logging_repo "orion/platform-svc-go/internal/logging/repository"
	logging_service "orion/platform-svc-go/internal/logging/service"
	// ---- P0-5: Object storage (S3/MinIO abstraction) ----
	storage_handler "orion/platform-svc-go/internal/storage/handler"
	storage_repo "orion/platform-svc-go/internal/storage/repository"
	storage_service "orion/platform-svc-go/internal/storage/service"
	// ---- P0-8: Message queue reliable persistence ----
	message_queue_repo "orion/platform-svc-go/internal/message-queue/repository"
	message_queue_service "orion/platform-svc-go/internal/message-queue/service"
	// ---- P0-4: AI Inference Proxy ----
	aiInference_handler "orion/platform-svc-go/internal/ai/inference/handler"
	aiInference_service "orion/platform-svc-go/internal/ai/inference/service"
	sh_handler "orion/platform-svc-go/internal/self-healing/handler"
	// ---- P0-20: Network Management Module ----
	network_handler "orion/platform-svc-go/internal/network/handler"
	network_repo "orion/platform-svc-go/internal/network/repository"
	network_service "orion/platform-svc-go/internal/network/service"
	// ---- P0-18: K8s Provisioner ----
	cluster_handler "orion/platform-svc-go/internal/cluster/handler"
	cluster_repo "orion/platform-svc-go/internal/cluster/repository"
	cluster_service "orion/platform-svc-go/internal/cluster/service"
	"os"
	"context"
	"go.uber.org/zap"
	// NATS subscribers for incident + self-healing domains
	incident_nats "orion/platform-svc-go/internal/incident/nats"
	sh_nats "orion/platform-svc-go/internal/self-healing/nats"
	// ---- AI module handler imports (internal/ai/) ----
	ai_knowledge_handler "orion/platform-svc-go/internal/ai/knowledge/handler"
	ai_agent_run_handler "orion/platform-svc-go/internal/ai-agent-run/handler"
	ai_agent_run_repo "orion/platform-svc-go/internal/ai-agent-run/repository"
	ai_agent_run_service "orion/platform-svc-go/internal/ai-agent-run/service"
	// ---- Prompt Security + remaining un-wired modules ----
	ps_handler "orion/platform-svc-go/internal/prompt-security/handler"
	)
var (
	gsH                 *gs_handler.Handler // Global search service
	pluginMarketplaceH  *pm_handler.Handler
	authH               *auth_handler.Handler
	pipelineRunnerSvc   *pipeline_service.Service
	skillH              *skill_handler.Handler
	dataQualityH        *dataQuality_handler.Handler
	dataPipelineH       *dataPipeline_handler.Handler
	apiConsumptionH     *apiConsumption_handler.Handler
	// ---- GraphViz module ----
	graphvizH           *graphviz_handler.Handler
	contractH           *contract_handler.Handler
	peH                 *pe_handler.Handler
	aiAgentRunH         *ai_agent_run_handler.Handler
	aiAgentsH           *aiAgents_handler.Handler
	aiCostH             *aiCost_handler.Handler
	aiGatewayH          *aiGateway_handler.Handler
	aiDecisionsH        *aiDecisions_handler.Handler
	aiReviewH           *aiReview_handler.Handler
	artifactVersionH    *artifactVersion_handler.Handler
	cacheModH           *cache_mod_handler.Handler
	cacheCleanupH       *cacheCleanup_handler.Handler
	storageH            *storage_handler.Handler
	clusterH            *cluster_handler.Handler
	aiInferenceH        *aiInference_handler.Handler
	networkH            *network_handler.Handler
	sandboxH            *sandbox_handler.Handler
	aiModelsH           *aiModels_handler.Handler
	pipelineBudgetH     *pipeline_budget_handler.Handler
	pipelineTemplatesH  *pipeline_templates_handler.Handler
	pipelineVersionsH   *pipeline_versions_handler.Handler
	resilienceScoreH    *resilience_score_handler.Handler
	sbomH               *sbom_handler.Handler
	loggingH            *logging_handler.Handler
	selfhealingH        *sh_handler.SelfHealingHandler
	// ---- Blueprint CI-CD merge handlers ----
	ciArtRegH    *ciArtReg_handler.ArtifactRegistryHandler
	ciArtVerH    *ciArtVer_handler.ArtifactVersionHandler
	ciBuildH     *ciBuild_handler.Handler
	ciCanaryH    *ciCanary_handler.Handler
	ciDeployH    *ciDeploy_handler.Handler
	ciPipelineH  *ciPipeline_handler.Handler
	ciPTmplH     *ciPTmpl_handler.Handler
	ciRunnerH    *ciRunner_handler.Handler
	// ---- Blueprint InfraOps merge handlers ----
	infraCapH *infraCap_handler.Handler
	infraDrH  *infraDr_handler.Handler
	infraEEH  *infraEE_handler.Handler
	infraMWH  *infraMW_handler.Handler
	infraBackupH  *infraBackup_handler.Handler
	infraChaosH   *infraChaos_handler.Handler
	infraDbaH     *infraDba_handler.Handler
	infraDegH     *infraDegradation_handler.Handler
	infraDTwinH   *infraDTwin_handler.Handler
	infraIacH     *infraIac_handler.Handler
	infraMWnH     *infraMWn_handler.Handler
	infraMultiH   *infraMulti_handler.Handler
	infraOCIH     *infraOCI_handler.Handler
	infraServerlessH *infraServerless_handler.Handler
	// ---- AI module handlers (internal/ai/) ----
	ai_knowledgeH     *ai_knowledge_handler.KnowledgeHandler
	psH *ps_handler.PromptSecurityHandler
)
func initWiring(infra *infrastructure, logger *zap.Logger) {
	db := infra.db
	_ = logger
	// ---- Delegated domain wiring (split for readability) ----
	// P0-09: Alert pipeline handler
	wireAlertPipeline(db, logger)
	// P0-26: Domain CQRS handler
	wireDomainCQRS(db, logger)
	// P0-30: Pipeline audit log handler
	wirePipelineAuditLog(db, logger)
	// P0-31: Pipeline run history handler
	wirePipelineRunHistory(db, logger)
	// P0-47: Prompt security module (config + scan persistence)
	wirePromptSecurity(db, logger)
	// P0-48: Wire remaining 10 un-wired modules
	wireCacheMonitor(db, logger)
	wireCodeEmbedding(db, logger)
	wireDataClassification(db, logger)
	wireFileHandler(db, logger)
	wireJobActions(db, logger)
	wireRCA(db, logger)
	wireRuleEngine(db, logger)
	wireSemanticSearch(db, logger)
	wireTaskExecutor(db, logger)
	wireTool(db, logger)
	// Core modules: feature-flag, role, ag, artifact, plugin, inception,
	// environment, policy, project/team organization
	wireCoreModules(db)
	// Wave 2: Auth + Permission modules (ae, amfa, ssou, ssop, abac, paudit)
	wireAuthModules(db)
	// Infrastructure modules: capability, chaos, infrastructure, iac, cron,
	// gateway-dynamic (incl. gray release), handler-registry, i18n, serverless, multicloud
	wireInfrastructureModules(db, logger)
	// Observability & operations modules: cmdb, monitoring, alert, artifact-ops,
	// config, session, api-key, eventbus, event-trigger, hook-chain
	wireObservabilityModules(db)
	// CI/CD & domain modules: chatops, code-repo, approval, audit, incident,
	// build-env, build, pipeline, dba, deploy, deploy-enhanced, digital-twin,
	// finops, knowledge, security-compliance, tenant, ticketing, change, skill,
	// sla, visor, change-request, report-designer, oncall, diagnostic, api-market,
	// ci-type, backup, lowcode
	wireCICDModules(db)
	wireDomainModules(db)
	// Notification & channel modules
	wireNotificationModules(db)
	// Workflow orchestration modules
	wireWorkflowModules(db)
	// Wave 5: Pipeline Assistant modules
	wirePipelineAssistantModules(db)
	// Wave 6: Observability modules
	wireObservabilityWaveModules(db)
	// Wave 7a: P2 security & compliance modules
	wireP2Modules(db)
	// Blueprint modules: billing, cost-allocation, efficiency, data-lineage,
	// data-quality, api-consumption, contract
	wireBlueprintModules(db)
	// P1: wire metadata, mlops, test-generation, inspection handlers
	wireMetadata(db, logger)
	wireMLOps(db, logger)
	wireTestGeneration(db, logger)
	wireInspection(db, logger)
	dataCatalogRepo := dataCatalog_repo.NewRepository(infra.db.DB)
	dataCatalogSvc := dataCatalog_service.NewService(dataCatalogRepo, dataCatalog_introspector.New())
	dataCatalogH = dataCatalog_handler.NewHandler(dataCatalogSvc)
	dataQualityRepo := dataQuality_repo.NewRepository(infra.db.DB)
	dataQualitySvc := dataQuality_service.NewService(dataQualityRepo)
	dataQualityH = dataQuality_handler.NewHandler(dataQualitySvc)
	dataPipelineRepo := dataPipeline_repo.NewRepository(infra.db.DB)
	dataPipelineSvc := dataPipeline_service.NewService(dataPipelineRepo)
	dataPipelineH = dataPipeline_handler.NewHandler(dataPipelineSvc)
	// Wave 7: P2 batch modules (alert-breaker, apm, bi-dashboard, canary-*,
	// cross-domain, decision-explanation, degradation, dependency-coordination,
	// dual-engine, env-*, global-param, integration, maintenance-window,
	// message-queue, metrics, multi-modal-trigger, notification-management,
	// oci-registry, plugin-hotreload, process-step, progressive, queue, risk,
	// runbook, script-*, self-service, service-*, ticket-knowledge, topology,
	// unified-config, vector-*, version-archive)
	wireWave7BatchModules(db)
	// Wave 7b-j: Automation modules
	wireAutomationModules(db)
	// ---- Inline wiring (requires secrets or cross-module dependencies) ----
	// user services (needed by auth)
	userRepo := user_repo.NewRepository(infra.db.DB)
	userSvc := user_service.NewService(userRepo)
	userH = user_handler.NewHandler(userSvc)
	// auth services (requires ffCfg.JWTSecret + userRepo)
	authRepo := auth_repo.NewRepository(infra.db.DB)
	authSvc := auth_service.NewService(authRepo, userRepo, infra.ffCfg.JWTSecret)
	authH = auth_handler.NewHandler(authSvc)
	// permission services
	permRepo := perm_repo.NewRepository(infra.db.DB)
	permSvc := perm_service.NewService(permRepo)
	permH = perm_handler.NewHandler(permSvc)
	// ---- LLM Provider Registry + AI services ----
	llmProviderRegistry := llmprovider.NewProviderRegistry()
	// Wire real LLM providers from environment variables (graceful no-op when unset).
	if openaiKey := os.Getenv("OPENAI_API_KEY"); openaiKey != "" {
		llmProviderRegistry.Register(llmprovider.NewOpenAIClient(llmprovider.OpenAIConfig{
			BaseURL:      os.Getenv("OPENAI_BASE_URL"),
			APIKey:       openaiKey,
			DefaultModel: "gpt-4o-mini",
		}))
	}
	if anthropicKey := os.Getenv("ANTHROPIC_API_KEY"); anthropicKey != "" {
		llmProviderRegistry.Register(llmprovider.NewAnthropicClient(llmprovider.AnthropicConfig{
			BaseURL:      os.Getenv("ANTHROPIC_BASE_URL"),
			APIKey:       anthropicKey,
			DefaultModel: "claude-3-haiku-20240307",
		}))
	}
	// ai-decisions services
	aiDecisionsRepo := aiDecisions_repo.NewRepository(infra.db.DB)
	aiDecisionsSvc := aiDecisions_service.NewService(aiDecisionsRepo)
	aiDecisionsSvc.WithLLMProvider(llmProviderRegistry)
	aiDecisionsH = aiDecisions_handler.NewHandler(aiDecisionsSvc)
	// ai-agent-run services
	aiAgentRunRepo := ai_agent_run_repo.NewRepository(infra.db.DB)
	aiAgentRunSvc := ai_agent_run_service.NewService(aiAgentRunRepo)
	aiAgentRunH = ai_agent_run_handler.NewHandler(aiAgentRunSvc)
	// plugin-marketplace services
	pmRepo := pm_repo.NewRepository(infra.db.DB)
	pmSvc := pm_service.NewService(pmRepo)
	pluginMarketplaceH = pm_handler.NewHandler(pmSvc)
	// ai-gateway services
	aiGatewayRepo := aiGateway_repo.NewRepository(infra.db.DB)
	aiGatewaySvc := aiGateway_service.NewService(aiGatewayRepo)
	aiGatewaySvc.WithLLMProvider(llmProviderRegistry)
	aiGatewayH = aiGateway_handler.NewHandler(aiGatewaySvc)
	// P0-6: Agent sandbox (isolated code execution)
	sandboxRepo := sandbox_repo.NewRepository(infra.db.DB)
	sandboxSvc := sandbox_service.NewService(sandboxRepo, infra.logger)
	sandboxH = sandbox_handler.NewHandler(sandboxSvc)
	// P0-9: Centralized logging service
	loggingRepo := logging_repo.NewRepository(infra.db.DB)
	loggingSvc := logging_service.NewService(loggingRepo)
	loggingH = logging_handler.NewHandler(loggingSvc)
	// P0-5: Object storage metadata (S3/MinIO abstraction)
	storageRepo := storage_repo.NewRepository(infra.db.DB)
	storageSvc := storage_service.NewService(storageRepo)
	storageH = storage_handler.NewHandler(storageSvc)
	// P0-8: Message queue reliable persistence
	message_queueRepo := message_queue_repo.NewRepository(infra.db.DB)
	message_queueSvc := message_queue_service.NewService(message_queueRepo)
	message_queueH = message_queue_handler.NewHandler(message_queueSvc)
	// P0-18: K8s Provisioner
	clusterRepo := cluster_repo.NewRepository(infra.db.DB)
	clusterSvc := cluster_service.NewService(clusterRepo)
	clusterH = cluster_handler.NewHandler(clusterSvc)
	// P0-4: AI Inference Proxy (HTTP proxy to Python AI service)
	aiInferenceSvc := aiInference_service.NewPythonInferenceService()
	aiInferenceH = aiInference_handler.NewHandler(aiInferenceSvc)
	// P0-20: Network Management Module
	networkRepo := network_repo.NewRepository(infra.db.DB)
	networkSvc := network_service.NewService(networkRepo)
	networkH = network_handler.NewHandler(networkSvc)
	// ai-models services
	aiModelsRepo := aiModels_repo.NewRepository(infra.db.DB)
	aiModelsSvc := aiModels_service.NewService(aiModelsRepo, infra.logger)
	aiModelsH = aiModels_handler.NewHandler(aiModelsSvc)
	// pipeline-budget services
	pipelineBudgetRepo := pipeline_budget_repo.NewRepository(infra.db.DB)
	pipelineBudgetSvc := pipeline_budget_service.NewService(pipelineBudgetRepo)
	pipelineBudgetH = pipeline_budget_handler.NewHandler(pipelineBudgetSvc)
	// pipeline-templates services
	pipelineTemplatesRepo := pipeline_templates_repo.NewRepository(infra.db.DB)
	pipelineTemplatesSvc := pipeline_templates_service.NewService(pipelineTemplatesRepo)
	pipelineTemplatesH = pipeline_templates_handler.NewHandler(pipelineTemplatesSvc)
	// pipeline-versions services
	pipelineVersionsRepo := pipeline_versions_repo.NewRepository(infra.db.DB)
	pipelineVersionsSvc := pipeline_versions_service.NewService(pipelineVersionsRepo)
	pipelineVersionsH = pipeline_versions_handler.NewHandler(pipelineVersionsSvc)
	// resilience-score services
	resilienceScoreRepo := resilience_score_repo.NewRepository(infra.db.DB)
	resilienceScoreSvc := resilience_score_service.NewService(resilienceScoreRepo, infra.db.DB)
	resilienceScoreH = resilience_score_handler.NewHandler(resilienceScoreSvc)
	// sbom services
	sbomRepo := sbom_repo.NewRepository(infra.db.DB)
	sbomSvc := sbom_service.NewService(sbomRepo)
	sbomH = sbom_handler.NewHandler(sbomSvc)
	// ---- Blueprint CI-CD merge: wire subdomain handlers ----
	// artifact-registry: repo -> service -> handler
	ciArtRegRepo := ciArtReg_repo.NewArtifactRegistryRepository(infra.db.DB.DB)
	ciArtRegSvc := ciArtReg_service.NewArtifactRegistryService(ciArtRegRepo, infra.logger)
	ciArtRegH = ciArtReg_handler.NewArtifactRegistryHandler(ciArtRegSvc)
	// artifact-version: repo -> service -> handler
	ciArtVerSvc := ciArtVer_service.NewArtifactVersionServiceWithRepo(ciArtVer_repo.NewArtifactVersionRepository(infra.db.DB), infra.logger)
	ciArtVerH = ciArtVer_handler.NewArtifactVersionHandler(ciArtVerSvc)
	// build: repo -> service -> handler (requires db + logger)
	ciBuildH = ciBuild_handler.New(infra.db, infra.logger)
	// canary: repo -> service -> handler (commented: undefined NewRepository + signature mismatch)
	// ciCanaryH = ciCanary_handler.NewHandler(ciCanarySvc)
	// deploy: repo -> service -> handler (requires db + logger)
	ciDeployH = ciDeploy_handler.New(infra.db, infra.logger)
	// pipeline: repo -> service -> handler (commented: undefined NewRepository + signature mismatch)
	// ciPipelineH = ciPipeline_handler.NewHandler(ciPipelineSvc)
	// pipeline-template: repo -> service -> handler
	ciPTmplRepo := ciPTmpl_repo.NewRepository(infra.db.DB)
	ciPTmplSvc := ciPTmpl_service.NewService(ciPTmplRepo)
	ciPTmplH = ciPTmpl_handler.NewHandler(ciPTmplSvc)
	// runner: repo -> service -> handler
	ciRunnerRepo := ciRunner_repo.NewRepository(infra.db.DB)
	ciRunnerSvc := ciRunner_service.NewService(ciRunnerRepo)
	ciRunnerH = ciRunner_handler.NewHandler(ciRunnerSvc)
	// ---- Blueprint InfraOps merge: wire infrastructure subdomain handlers ----
	// capacity: repo -> service -> handler
	// dr: repo -> service -> handler
	infraDrRepo := infraDr_repo.NewRepository(infra.db.DB)
	infraDrSvc := infraDr_service.NewService(infraDrRepo)
	infraDrH = infraDr_handler.NewHandler(infraDrSvc)
	// ephemeral-env: repo -> service -> handler
	infraEERepo := infraEE_repo.NewRepository(infra.db.DB)
	infraEESvc := infraEE_service.NewService(infraEERepo)
	infraEEH = infraEE_handler.NewHandler(infraEESvc)
	// middleware-ops: repo -> service -> handler
	// backup: repo -> 2 services (BackupService + RecoveryService) -> handler
	infraBackupRepo := infraBackup_repo.NewBackupRepository(infra.db)
	infraBackupSvc := infraBackup_service.NewBackupService(infraBackupRepo, infra.logger)
	infraRecoverySvc := infraBackup_service.NewRecoveryService(infraBackupRepo, infra.logger)
	infraBackupH = infraBackup_handler.New(infraBackupSvc, infraRecoverySvc, infra.logger)
	// chaos: repo -> service -> handler
	infraChaosRepo := infraChaos_repo.NewChaosRepository(infra.db.DB)
	infraChaosSvc := infraChaos_service.NewChaosService(infraChaosRepo)
	infraChaosH = infraChaos_handler.NewHandler(infraChaosSvc)
	// dba: repo -> service -> handler
	infraDbaRepo := infraDba_repo.NewRepository(infra.db.DB)
	infraDbaSvc := infraDba_service.NewService(infraDbaRepo)
	infraDbaH = infraDba_handler.NewHandler(infraDbaSvc)
	// degradation: repo -> service -> handler
	infraDegRepo := infraDegradation_repo.NewRepository(infra.db.DB)
	infraDegSvc := infraDegradation_service.NewService(infraDegRepo)
	infraDegH = infraDegradation_handler.NewHandler(infraDegSvc)
	// digital-twin: repo -> service -> handler
	infraDTwinRepo := infraDTwin_repo.NewRepository(infra.db.DB)
	infraDTwinSvc := infraDTwin_service.NewService(infraDTwinRepo)
	infraDTwinH = infraDTwin_handler.NewHandler(infraDTwinSvc)
	// iac: repo -> service -> handler
	infraIacRepo := infraIac_repo.NewRepository(infra.db.DB)
	infraIacSvc := infraIac_service.NewService(infraIacRepo)
	infraIacH = infraIac_handler.NewHandler(infraIacSvc)
	// maintenance-window: repo -> service -> handler
	infraMWnRepo := infraMWn_repo.NewRepository(infra.db.DB)
	infraMWnSvc := infraMWn_service.NewService(infraMWnRepo)
	infraMWnH = infraMWn_handler.NewHandler(infraMWnSvc)
	// multicloud: repo -> service -> handler
	infraMultiRepo := infraMulti_repo.NewRepository(infra.db.DB)
	infraMultiSvc := infraMulti_service.NewService(infraMultiRepo)
	infraMultiH = infraMulti_handler.NewHandler(infraMultiSvc)
	// oci-registry: repo -> service -> handler
	infraOCIRepo := infraOCI_repo.NewRepository(infra.db.DB)
	infraOCISvc := infraOCI_service.NewService(infraOCIRepo)
	infraOCIH = infraOCI_handler.NewHandler(infraOCISvc)
	// serverless: repo -> service -> handler
	infraServerlessRepo := infraServerless_repo.NewRepository(infra.db.DB)
	infraServerlessSvc := infraServerless_service.NewService(infraServerlessRepo)
	infraServerlessH = infraServerless_handler.NewHandler(infraServerlessSvc)
	// ---- AI modules (internal/ai/) ----
	wireAIModules(db, logger)
		// Prompt Security: repo -> service -> handler
		// ---- Event Infrastructure: Incident + Self-Healing NATS Subscribers ----
		wireNatsSubscribers(logger)
		// ---- Wire unassigned handlers (repo → service → handler) ----
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
		// defer to infrastructure layer wiring.
		selfhealingH = sh_handler.NewSelfHealingHandler(nil)
		peH = pe_handler.NewHandler(&pe_service.PipelineEngine{})
		infraCapPoolRepo := infraCap_repo.NewPoolRepository(db.DB)
		infraCapForecastRepo := infraCap_repo.NewForecastRepository(db.DB)
		infraCapPolicyRepo := infraCap_repo.NewPolicyRepository(db.DB)
		infraCapMetricRepo := infraCap_repo.NewMetricRepository(db.DB)
		infraCapAlertRepo := infraCap_repo.NewAlertRepository(db.DB)
		infraCapReportRepo := infraCap_repo.NewReportRepository(db.DB)
		infraCapSvc := infraCap_service.NewService(infraCapPoolRepo, infraCapForecastRepo, infraCapPolicyRepo, infraCapMetricRepo, infraCapAlertRepo, infraCapReportRepo)
		infraCapH = infraCap_handler.NewHandler(infraCapSvc)
		// Group C: Duplicate - psH shares the same handler as promptSecurityH
		psH = promptSecurityH
	
}
// wireNatsSubscribers initializes the Incident and Self-Healing NATS JetStream
// subscribers. Graceful no-op when NATS is unreachable (async event-driven pipeline).
func wireNatsSubscribers(logger *zap.Logger) {
	natsAddr := os.Getenv("NATS_ADDR")
	if natsAddr == "" {
		natsAddr = "nats://localhost:4222"
	}
	natsStream := os.Getenv("NATS_STREAM")
	if natsStream == "" {
		natsStream = "ORION_EVENTS"
	}
	// --- Incident NATS Subscriber ---
	// incidentSvc is wired via wireCICDModules and exported as package-level global.
	if incidentSvc != nil {
		incidentHandler := &incidentEventHandlerStub{logger: logger}
		incSub, err := incident_nats.NewNATSSubscriber(natsAddr, natsStream, logger, incidentHandler)
		if err != nil {
			logger.Warn("incident NATS subscriber init failed (event-driven disabled)", zap.Error(err))
		} else {
			ctx := context.Background()
			if startErr := incSub.Start(ctx); startErr != nil {
				logger.Warn("incident NATS subscriber start failed", zap.Error(startErr))
			} else {
				logger.Info("incident NATS subscriber started")
			}
		}
	} else {
		logger.Debug("incident service not available, skipping NATS subscriber")
	}
	// --- Self-Healing NATS Subscriber ---
	// SelfHealingService needs *zap.Logger and *repository.SelfHealingRepository;
	// the repo requires pgxpool which is not currently wired at this layer.
	// Register a no-op handler to keep the NATS subject consumed even without full repo wiring.
	// TODO: wire pgxpool and pass real selfHealingRepo once core_infra_wiring exposes it.
	if selfhealingH != nil {
		// service already wired via external wiring — handler is available
	}
	shSub, err := sh_nats.NewNATSSubscriber(natsAddr, natsStream, logger, &selfHealingNatsHandler{})
	if err != nil {
		logger.Warn("self-healing NATS subscriber init failed (event-driven disabled)", zap.Error(err))
	} else {
		ctx := context.Background()
		if startErr := shSub.Start(ctx); startErr != nil {
			logger.Warn("self-healing NATS subscriber start failed", zap.Error(startErr))
		} else {
			logger.Info("self-healing NATS subscriber started")
		}
	}
}
// selfHealingNatsHandler is a no-op EventHandler for the self-healing NATS subscriber
// until the full SelfHealingService is wired. Keeps the NATS subject consumed and
// logged while pgxpool-based repository wiring is pending.
type selfHealingNatsHandler struct{}
func (h *selfHealingNatsHandler) HandleSelfHealingEvent(ctx context.Context, event *sh_nats.SelfHealingEvent) error {
	return nil
}
// incidentEventHandlerStub adapts to the NATS EventHandler interface.
type incidentEventHandlerStub struct {
	logger *zap.Logger
}
func (h *incidentEventHandlerStub) HandleIncidentEvent(ctx context.Context, event *incident_nats.EventBusEvent) error {
	h.logger.Info("incident event received", zap.String("id", event.ID), zap.String("type", event.Type))
	_ = ctx
	return nil
}
