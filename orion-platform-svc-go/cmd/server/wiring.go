package main

import (
	"context"
	"go.uber.org/zap"
	llmprovider "orion/platform-svc-go/internal/ai/llm-provider"
	auth_handler "orion/platform-svc-go/internal/auth/handler"
	auth_repo "orion/platform-svc-go/internal/auth/repository"
	auth_service "orion/platform-svc-go/internal/auth/service"
	perm_handler "orion/platform-svc-go/internal/permission/handler"
	perm_repo "orion/platform-svc-go/internal/permission/repository"
	perm_service "orion/platform-svc-go/internal/permission/service"
	pipeline_service "orion/platform-svc-go/internal/pipeline/service"
	sh_handler "orion/platform-svc-go/internal/self-healing/handler"
	user_handler "orion/platform-svc-go/internal/user/handler"
	user_repo "orion/platform-svc-go/internal/user/repository"
	user_service "orion/platform-svc-go/internal/user/service"
	"os"
	// NATS subscribers for incident + self-healing domains
	incident_nats "orion/platform-svc-go/internal/incident/nats"
	sh_nats "orion/platform-svc-go/internal/self-healing/nats"
)

var (
	authH             *auth_handler.Handler
	pipelineRunnerSvc *pipeline_service.Service // unused — retained for backward compatibility
	selfhealingH      *sh_handler.SelfHealingHandler
)

func initWiring(infra *infrastructure, logger *zap.Logger) {
	db := infra.db
	_ = logger
	// ---- Delegated domain wiring (split for readability) ----
	// P0-09: Alert pipeline handler
	wireAlertPipeline(db, logger)
	// P0-05~08: Alert adapter/correlation/deduplication/silence wiring
	wireAlertAdapter(db, logger)
	wireAlertCorrelation(db, logger)
	wireAlertDeduplication(db, logger)
	wireAlertSilence(db, logger)
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
	// P0-10~22: Notification/CMDB/Chaos/Circuit wiring
	wireCmdbCollector(db, logger)
	wireCmdbValidator(db, logger)
	wireCmdbImport(db, logger)
	wireCmdbRelationship(db, logger)
	wireChannel(db, logger)
	wireDoNotDisturb(db)
	wireChaosEngine(db, logger)
	wireCircuitBreaker(db, logger)
	// CI/CD & domain modules: chatops, code-repo, approval, audit, incident,
	// build-env, build, pipeline, dba, deploy, deploy-enhanced, digital-twin,
	// finops, knowledge, security-compliance, tenant, ticketing, change, skill,
	// sla, visor, change-request, report-designer, oncall, diagnostic, api-market,
	// ci-type, backup, lowcode
	wireCICDModules(db)
	wireDomainModules(db)
	wireCoreDomains(db, logger)
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
	// Data modules: catalog (with introspector override), quality, pipeline
	wireDataModules(db, logger)
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
	// ---- P0-23~30: Core business modules (un-wired standalone wiring files) ----
	wireForm(db, logger)
	wireImportExport(db, logger)
	wireExtensionPoint(db, logger)
	wirePipelineExecutor(db, logger)
	wireParamTypes(db, logger)
	wireSLAEngine(db, logger)
	wireEscalation(db, logger)
	wireRunbook(db, logger)
	wireCondition(db, logger)
	wireConfigMgmtEnhanced(db, logger)
	wireSaga(db, logger)
	wireApplication(db, logger)
	// ---- P0-31~40: Tool/Platform modules ----
	wirePandawiki(db, logger)
	wirecachemgmt(db, logger)
	wiredistributedconfig(db, logger)
	wirelowcodesigner(db, logger)
	wirealertescalation(db, logger)
	wiretenantquota(db, logger)
	wiresmartdeploy(db, logger)
	wirePipelineErrorDetail(db, logger)
	wireStartup(db, logger)
	wireTaskTimeout(db, logger)
	wireDigitalTwinSimulation(db, logger)
	wireTestSelector(db, logger)
	wireEventTriggerRegistry(db, logger)
	wireExecutionModeEngine(db, logger)
	wireJobProcessor(db, logger)
	wireDataMasking(db, logger)
	// ---- P0-41~47: Community/User/Security/Infra modules ----
	wireUcommunity(db, logger)
	wireCommunityAdvanced(db, logger)
	wireUmcp(db, logger)
	wireUmodule(db, logger)
	wireUobservability(db, logger)
	wireUvector(db, logger)
	wireuseractivity(db, logger)
	wireuserprofile(db, logger)
	wireuserstatus(db, logger)
	wireusertoken(db, logger)
	wireVulnerability(db, logger)
	// ---- Phase 2: DBA extension modules (approval/query/aireview/osc) ----
	wireDbaExtensions(db, logger)
	wireTerminalAudit(db, logger)
	wireTenantGateway(db, logger)
	wireApkUploadHistory(db, logger)
	wireartifactlifecycle(db, logger)
	wireAutonomousPipeline(db, logger)
	wireAutoExec(db, logger)
	wireReleaseManagement(db, logger)
	wiredisasterrecovery(db, logger)
	wirellmtrace(db, logger)
	wireVisorCore(db, logger)
	wireVisorExec(db, logger)
	wireTestExecutionEngine(db, logger)
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
	// AI inline services: decisions, agent-run, plugin-marketplace, gateway (LLM-registry-aware)
	wireAIInlineServices(db, logger, llmProviderRegistry)
	// P0 core modules: sandbox, logging, crossover, storage, message-queue,
	// cluster, ai-inference, network, ai-models
	wireP0Modules(db, logger)
	// Pipeline modules: budget, templates, versions, resilience-score, sbom
	wirePipelineModules(db, logger)
	// ---- Blueprint CI-CD merge: wire subdomain handlers ----
	wireBlueprintCICD(db, logger)
	// ---- Blueprint InfraOps merge: wire infrastructure subdomain handlers ----
	wireBlueprintInfraOps(db, logger)
	// ---- AI modules (internal/ai/) ----
	wireAIModules(db, logger)
	// ---- Event Infrastructure: Incident + Self-Healing NATS Subscribers ----
	wireNatsSubscribers(logger)
	// Inline handlers: Group A (crud), Group B (pe, infra-cap), Group C (psH alias),
	// P1 (agents, dbdevops, gw-routes, rate-limit, test-reports)
	wireInlineHandlers(db, logger)
	// Blueprint modules: middleware, statistics, roweditor, api-component, alert-rule-engine
	wireMiddleware(db, logger)
	wireStatistics(db, logger)
	wireRoweditor(db, logger)
	wireAPIComponent(db, logger)
	wireAlertRuleEngine(db, logger)
	// P3-02: Service Catalog
	wireServiceCatalog(db, logger)
	// Wave 4: wire 6 previously unwired SQL-repo modules
	wireAlertAdapterV2(db, logger)
	wireAutoRecovery(db, logger)
	wireCapacity(db, logger)
	wireMiddlewareOps(db, logger)
	wireOrchestration(db, logger)
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
