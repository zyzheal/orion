// Package server provides the command-line entry point for the platform service.
package main

import (
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/observability"
	ticket_handler "orion/platform-svc-go/internal/ticket/handler"

	"go.uber.org/zap"
)

// setupRouter creates the Gin engine, registers middleware, and wires all
// handlers to their routes. Each handler's RegisterRoutes is called with the
// shared /api/v1 RouterGroup, so the handler itself controls its route prefix
// and middleware.
func setupRouter(infra *infrastructure, logger *zap.Logger) *gin.Engine {
	r := gin.New()

	// Global middleware
	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(middleware.RateLimit(middleware.DefaultRateLimitConfig()))
	r.Use(middleware.Timeout(middleware.DefaultTimeoutConfig()))
	r.Use(middleware.SecurityHeaders())
	r.Use(middleware.Prometheus())
	r.Use(middleware.CircuitBreaker(middleware.CircuitBreakerConfig{
		FailureThreshold:    10,
		SuccessThreshold:    3,
		Timeout:             30 * time.Second,
		MaxHalfOpenRequests: 5,
		Name:                "platform-api",
	}))

	// Prometheus metrics endpoint (unprotected)
	r.GET("/metrics", middleware.MetricsHandler())

	// Circuit breaker status endpoint (unprotected)
	r.GET("/circuit-breakers/status", middleware.CircuitBreakerStatusHandler(middleware.DefaultManager()))

	// Create /api/v1 group for all platform routes
	api := r.Group("/api/v1")
	{
	// PERM-8 phase 1: optional (non-blocking) authentication, OFF by default.
	//
	// Nothing in this chain ever called c.Set("role", ...), so all 3640
	// auth.RequirePermission guards answered 403 "no role assigned" to every
	// caller — the guards were dead code, not authorisation. OptionalAuth
	// authenticates callers who present a valid token and lets everyone else
	// through anonymously, so the guards become real authorisation for
	// authenticated callers while no unauthenticated caller can be newly 401'd.
	//
	// Strict mode is auth.Auth; it is deliberately NOT mounted here because it
	// aborts on a missing header and on a missing tenant_id claim, which would
	// 401 the entire token-less client base overnight. Switching to it is the
	// remaining PERM-8 work and needs a client-migration plan, not a commit.
	if os.Getenv("AUTH_OPTIONAL_ENABLED") == "1" || os.Getenv("AUTH_OPTIONAL_ENABLED") == "true" {
		api.Use(auth.OptionalAuth(auth.AuthConfig{
			JWTSecret:   infra.ffCfg.JWTSecret,
			RedisClient: infra.rdb,
		}))
	}

  if abacH != nil {
    abacH.RegisterRoutes(api)
  }
  if alertEscH != nil {
    alertEscH.RegisterRoutes(api)
  }
  if dcH != nil {
    dcH.RegisterRoutes(api)
  }
  if lcH != nil {
    lcH.RegisterRoutes(api)
  }
  if tqH != nil {
    tqH.RegisterRoutes(api)
  }
  if agH != nil {
    agH.RegisterRoutes(api)
  }
  if aiAgentsH != nil {
    aiAgentsH.RegisterRoutes(api)
  }
  if aiCostH != nil {
    aiCostH.RegisterRoutes(api)
  }
  if aiDecisionsH != nil {
    aiDecisionsH.RegisterRoutes(api)
  }
  if aiGatewayH != nil {
    aiGatewayH.RegisterRoutes(api)
  }
  if aiReviewH != nil {
    aiReviewH.RegisterRoutes(api)
  }
  if alertH != nil {
    alertH.RegisterRoutes(api)
  }
  if alert_breakerH != nil {
    alert_breakerH.RegisterRoutes(api)
  }
  if amH != nil {
    amH.RegisterRoutes(api)
  }
  if amfaH != nil {
    amfaH.RegisterRoutes(api)
  }
  if apiConsumptionH != nil {
    apiConsumptionH.RegisterRoutes(api)
  }
  if apikeyH != nil {
    apikeyH.RegisterRoutes(api)
  }
  if apmH != nil {
    apmH.RegisterRoutes(api)
  }
  if approvalH != nil {
    approvalH.RegisterRoutes(api)
  }
  if artifactH != nil {
    artifactH.RegisterRoutes(api)
  }
  if artifactVersionH != nil {
    artifactVersionH.RegisterRoutes(api)
  }
  if artifactopsH != nil {
    artifactopsH.RegisterRoutes(api)
  }
  if auditH != nil {
    auditH.RegisterRoutes(api)
  }
  if authH != nil {
    public := r.Group("/auth")
    protected := api.Group("/auth")
    authH.RegisterRoutes(public, protected)
  }
  if cacheModH != nil {
    cacheModH.RegisterRoutes(api)
  }
  if cacheCleanupH != nil {
    cacheCleanupH.RegisterRoutes(api)
  }
  // cacheMgmtH is namespaced under /cache-mgmt: its bare /cache/configs set
  // is already claimed by ciBuildH (build cache configs) and /cache/:id by
  // cacheModH above, so a second registration would panic Gin.
  if cacheMgmtH != nil {
    cacheMgmtH.RegisterRoutes(api.Group("/cache-mgmt"))
  }
  // CQRS command dispatch endpoints. Constructed in setupInfra and held on
  // infrastructure (infra.cqrsHandler); this was the only handler wired into
  // the object graph but never mounted, so /api/v1/commands/* was unreachable.
  if infra.cqrsHandler != nil {
    infra.cqrsHandler.RegisterRoutes(api)
  }
  if bi_dashboardH != nil {
    bi_dashboardH.RegisterRoutes(api)
  }
  if billingH != nil {
    billingH.RegisterRoutes(api)
  }
  if buildH != nil {
    buildH.RegisterRoutes(api)
  }
  if build_envH != nil {
    build_envH.RegisterRoutes(api)
  }
  if canary_analysisH != nil {
    canary_analysisH.RegisterRoutes(api)
  }
  if canary_trafficH != nil {
    canary_trafficH.RegisterRoutes(api)
  }
  if capabilityH != nil {
    capabilityH.RegisterRoutes(api)
  }
  if changeH != nil {
    changeH.RegisterRoutes(api)
  }
  if chaosEngineH != nil {
    chaosEngineH.RegisterRoutes(api)
  }
  // chaosH, chaos_enhancedH and chaosGatewayH are NOT registered: chaosEngineH
  // above is a merged facade that delegates to all three of their handlers under
  // the same /chaos paths, so mounting them again would register every
  // (method, path) pair twice and panic Gin.
  if chatopsH != nil {
    chatopsH.RegisterRoutes(api)
  }
  if ciH != nil {
    ciH.RegisterRoutes(api)
  }
  if citH != nil {
    citH.RegisterRoutes(api)
  }
  if channelH != nil {
    channelH.RegisterRoutes(api)
  }
  if cmdbH != nil {
    cmdbH.RegisterRoutes(api)
  }
  if code_repoH != nil {
    code_repoH.RegisterRoutes(api)
  }
  // compliance: merged into governance/compliance (P2-01)
  // governanceComplianceH registered below
  if configH != nil {
    configH.RegisterRoutes(api)
  }
  if contractH != nil {
    contractH.RegisterRoutes(api)
  }
  if costallocH != nil {
    costallocH.RegisterRoutes(api)
  }
  if crH != nil {
    crH.RegisterRoutes(api)
  }
  if cronH != nil {
    cronH.RegisterRoutes(api)
  }
  if cross_domainH != nil {
    cross_domainH.RegisterRoutes(api)
  }
  if dataLineageH != nil {
    dataLineageH.RegisterRoutes(api)
  }
  if dataCatalogH != nil {
    dataCatalogH.RegisterRoutes(api)
  }
  if dataQualityH != nil {
    dataQualityH.RegisterRoutes(api)
  }
  if dataPipelineH != nil {
    dataPipelineH.RegisterRoutes(api)
  }
  if dbaH != nil {
    dbaH.RegisterRoutes(api)
  }
  if decision_explanationH != nil {
    decision_explanationH.RegisterRoutes(api)
  }
  if degradationH != nil {
    degradationH.RegisterRoutes(api)
  }
  if dependency_coordinationH != nil {
    dependency_coordinationH.RegisterRoutes(api)
  }
  if deployH != nil {
    deployH.RegisterRoutes(api)
  }
  if deploy_enhancedH != nil {
    deploy_enhancedH.RegisterRoutes(api)
  }
  if deployment_triggerH != nil {
    deployment_triggerH.RegisterRoutes(api)
  }
  if developerportalH != nil {
    // Namespaced under /developer-portal: this handler registers bare
    // relative paths ("" and ":id"). At the API root those become
    // GET/POST /api/v1 and /api/v1/:id, and the depth-1 wildcard
    // swallows every sibling route in the API.
    developerportalH.RegisterRoutes(api.Group("/developer-portal"))
  }
  if diagnosticH != nil {
    diagnosticH.RegisterRoutes(api)
  }
  if digital_twinH != nil {
    digital_twinH.RegisterRoutes(api)
  }
  if dual_engineH != nil {
    dual_engineH.RegisterRoutes(api)
  }
  if escalationH != nil {
    escalationH.RegisterRoutes(api)
  }
  if efficiencyH != nil {
    // Namespaced under /efficiency: this handler declares its TS source paths
    // as /api/v1/efficiency/{path}, the frontend calls /efficiency/..., and
    // at the API root its bare /reports, /teams/:teamId and
    // /projects/:projectId collide with report-designerH, teamH and projH.
    efficiencyH.RegisterRoutes(api.Group("/efficiency"))
  }
  if envH != nil {
    envH.RegisterRoutes(api)
  }
  if env_lifecycleH != nil {
    env_lifecycleH.RegisterRoutes(api)
  }
  if env_profileH != nil {
    env_profileH.RegisterRoutes(api)
  }
  if eventbusH != nil {
    eventbusH.RegisterRoutes(api)
  }
  if fedH != nil {
    fedH.RegisterRoutes(api)
  }
  if ffH != nil {
    ffH.RegisterRoutes(api)
  }
  if finopsH != nil {
    finopsH.RegisterRoutes(api)
  }
  if finops_v2H != nil {
    finops_v2H.RegisterRoutes(api)
  }
  if gatewaydynamicH != nil {
    // Namespaced under /gateway: this handler registers rg.Group("/routes"),
    // whose unnamespaced form is GET /api/v1/routes and collides with the
    // route-discovery endpoint registered near the end of this function. Its
    // TS source path (and the frontend's /gateway/routes client) use the
    // /gateway prefix.
    gatewaydynamicH.RegisterRoutes(api.Group("/gateway"))
  }
  if gdGrayH != nil {
    gdGrayH.RegisterRoutes(api)
  }
  if global_paramH != nil {
    global_paramH.RegisterRoutes(api)
  }
  if handlerregistryH != nil {
    handlerregistryH.RegisterRoutes(api)
  }
  if hcH != nil {
    hcH.RegisterRoutes(api)
  }
  if hookH != nil {
    hookH.RegisterRoutes(api)
  }
  if i18nH != nil {
    i18nH.RegisterRoutes(api)
  }
  if iacH != nil {
    iacH.RegisterRoutes(api)
  }
  if incH != nil {
    incH.RegisterRoutes(api)
  }
  if incidentH != nil {
    incidentH.RegisterRoutes(api)
  }
  if incident_actionH != nil {
    incident_actionH.RegisterRoutes(api)
  }
  if infraH != nil {
    infraH.RegisterRoutes(api)
  }
  if integrationH != nil {
    integrationH.RegisterRoutes(api)
  }
  if internallibraryH != nil {
    internallibraryH.RegisterRoutes(api)
  }
  if assistantH != nil {
    assistantH.RegisterRoutes(api)
  }
  if knowledgeH != nil {
    knowledgeH.RegisterRoutes(api)
  }
  if lowcodeH != nil {
    lowcodeH.RegisterRoutes(api)
  }
  if maintenance_windowH != nil {
    maintenance_windowH.RegisterRoutes(api)
  }
  if message_queueH != nil {
    message_queueH.RegisterRoutes(api)
  }
  if metricsH != nil {
    metricsH.RegisterRoutes(api)
  }
  if monitoringH != nil {
    monitoringH.RegisterRoutes(api)
  }
  if multi_modal_triggerH != nil {
    multi_modal_triggerH.RegisterRoutes(api)
  }
  if multicloudH != nil {
    multicloudH.RegisterRoutes(api)
  }
  if notificationH != nil {
    notificationH.RegisterRoutes(api)
  }
  if notification_mgmtH != nil {
    notification_mgmtH.RegisterRoutes(api)
  }
  if notification_policyH != nil {
    notification_policyH.RegisterRoutes(api)
  }
  if notification_templateH != nil {
    notification_templateH.RegisterRoutes(api)
  }
  if oci_registryH != nil {
    oci_registryH.RegisterRoutes(api)
  }
  if oncallH != nil {
    oncallH.RegisterRoutes(api)
  }
  if pageregistryH != nil {
    // Namespaced under /page-registry: at the API root a depth-1
    // ":path" wildcard shadows every other first-segment route and
    // cannot coexist with any other root-level wildcard in Gin.
    pageregistryH.RegisterRoutes(api.Group("/page-registry"))
  }
  if palH != nil {
    palH.RegisterRoutes(api)
  }
  if pauditH != nil {
    pauditH.RegisterRoutes(api)
  }
  if pbH != nil {
    pbH.RegisterRoutes(api)
  }
  if pboH != nil {
    pboH.RegisterRoutes(api)
  }
  if pecH != nil {
    pecH.RegisterRoutes(api)
  }
  if perfH != nil {
    perfH.RegisterRoutes(api)
  }
  if permH != nil {
    permH.RegisterRoutes(api)
  }
  if pgraphH != nil {
    pgraphH.RegisterRoutes(api)
  }
  if phistH != nil {
    phistH.RegisterRoutes(api)
  }
  if peH != nil {
    peH.RegisterRoutes(api)
  }
  if pipelineH != nil {
    pipelineH.RegisterRoutes(api)
  }
  if pluginH != nil {
    pluginH.RegisterRoutes(api)
  }
  if plugin_hotreloadH != nil {
    plugin_hotreloadH.RegisterRoutes(api)
  }
  if policyH != nil {
    policyH.RegisterRoutes(api)
  }
  if problemH != nil {
    problemH.RegisterRoutes(api)
  }
  if process_stepH != nil {
    process_stepH.RegisterRoutes(api)
  }
  if productlineH != nil {
    productlineH.RegisterRoutes(api)
  }
  if progessiveH != nil {
    progessiveH.RegisterRoutes(api)
  }
  if projH != nil {
    projH.RegisterRoutes(api)
  }
  if projectmemberH != nil {
    projectmemberH.RegisterRoutes(api)
  }
  if psseH != nil {
    psseH.RegisterRoutes(api)
  }
  if promptSecurityH != nil {
    promptSecurityH.RegisterRoutes(api)
  }
  if cacheMonitorH != nil {
    cacheMonitorH.RegisterRoutes(api)
  }
  if codeEmbeddingH != nil {
    codeEmbeddingH.RegisterRoutes(api)
  }
  if dataClassificationH != nil {
    dataClassificationH.RegisterRoutes(api)
  }
  if fileHandlerH != nil {
    fileHandlerH.RegisterRoutes(api)
  }
  if jobActionsH != nil {
    jobActionsH.RegisterRoutes(api)
  }
  if rcaH != nil {
    rcaH.RegisterRoutes(api)
  }
  if ruleEngineH != nil {
    ruleEngineH.RegisterRoutes(api)
  }
  if semanticSearchH != nil {
    semanticSearchH.RegisterRoutes(api)
  }
  if taskExecutorH != nil {
    taskExecutorH.RegisterRoutes(api)
  }
  if toolH != nil {
    toolH.RegisterRoutes(api)
  }
  if ptmplH != nil {
    ptmplH.RegisterRoutes(api)
  }
  if ptrendH != nil {
    ptrendH.RegisterRoutes(api)
  }
  if pverH != nil {
    pverH.RegisterRoutes(api)
  }
  if queue_modH != nil {
    queue_modH.RegisterRoutes(api)
  }
  if rdH != nil {
    rdH.RegisterRoutes(api)
  }
  if riskH != nil {
    riskH.RegisterRoutes(api)
  }
  if roleH != nil {
    roleH.RegisterRoutes(api)
  }
  if runbookH != nil {
    runbookH.RegisterRoutes(api)
  }
  if scheduled_notificationH != nil {
    scheduled_notificationH.RegisterRoutes(api)
  }
  if script_libraryH != nil {
    script_libraryH.RegisterRoutes(api)
  }
  if script_modH != nil {
    script_modH.RegisterRoutes(api)
  }
  if script_versionH != nil {
    script_versionH.RegisterRoutes(api)
  }
  if secretH != nil {
    secretH.RegisterRoutes(api)
  }
  if security_complianceH != nil {
    security_complianceH.RegisterRoutes(api)
  }
  if code_scanH != nil {
    code_scanH.RegisterRoutes(api.Group("/security"))
  }
  if self_serviceH != nil {
    self_serviceH.RegisterRoutes(api)
  }
  if selfhealingH != nil {
    selfhealingH.RegisterRoutes(api)
  }
  if serverlessH != nil {
    serverlessH.RegisterRoutes(api)
  }
  if service_catalogH != nil {
    service_catalogH.RegisterRoutes(api)
  }
  if service_healthH != nil {
    service_healthH.RegisterRoutes(api)
  }
  if service_topologyH != nil {
    service_topologyH.RegisterRoutes(api)
  }
  if serviceregistryH != nil {
    serviceregistryH.RegisterRoutes(api)
  }
  if sessionH != nil {
    sessionH.RegisterRoutes(api)
  }
  if slaH != nil {
    slaH.RegisterRoutes(api)
  }
  if sloH != nil {
    // Namespaced: at the API root SLO would own GET/POST "" and /:id,
    // colliding with the root-level wildcard taken by page-registry.
    sloH.RegisterRoutes(api.Group("/slo"))
  }
  if sprintH != nil {
    sprintH.RegisterRoutes(api)
  }
  if ssopH != nil {
    ssopH.RegisterRoutes(api)
  }
  if ssouH != nil {
    ssouH.RegisterRoutes(api)
  }
  if subappH != nil {
    subappH.RegisterRoutes(api)
  }
  if supply_chainH != nil {
    supply_chainH.RegisterRoutes(api)
  }
  if teamH != nil {
    // Namespaced: at the API root teams would own GET/POST "" and
    // /:id, colliding with the root-level wildcard (see page-registry).
    teamH.RegisterRoutes(api.Group("/teams"))
  }
  if tenantH != nil {
    tenantH.RegisterRoutes(api)
  }
  if ticket_automationH != nil {
    ticket_automationH.RegisterRoutes(api)
  }
  if ticket_knowledgeH != nil {
    ticket_knowledgeH.RegisterRoutes(api)
  }
  if ticketingH != nil {
    ticketingH.RegisterRoutes(api)
  }
  // internal/ticket/handler handlers with no RegisterRoutes of their own.
  // RegisterTicketDomainRoutes only claims the paths ticketingH above does not
  // own (PUT/DELETE /tickets/:id, /tickets/stats, :id/comments, /tickets/sla/*,
  // :id/dispatch/{auto,manual}, the SLA queue, /tickets/dispatch/balancing/*
  // and the transfer queue/config routes), so no (method, path) pair is
  // registered twice. The remaining ticket handlers (workflowModH, relationH,
  // suspendH, analyticsTicketH) are 100% covered by ticketingH and stay
  // unmounted for the same reason.
  if ticketH != nil || slaModH != nil || dispatchH != nil || queueH != nil || loadBalancerH != nil || transferH != nil {
    ticket_handler.RegisterTicketDomainRoutes(api, ticketH, slaModH, dispatchH, queueH, loadBalancerH, transferH)
  }
  if topologyH != nil {
    topologyH.RegisterRoutes(api)
  }
  if tracingH != nil {
    tracingH.RegisterRoutes(api)
  }
  if triggerH != nil {
    triggerH.RegisterRoutes(api)
  }
  if uebaH != nil {
    uebaH.RegisterRoutes(api)
  }
  if unified_configH != nil {
    unified_configH.RegisterRoutes(api)
  }
  if userH != nil {
    userH.RegisterRoutes(api)
  }
  if vector_storeH != nil {
    vector_storeH.RegisterRoutes(api)
  }
  if vectorize_rulesH != nil {
    vectorize_rulesH.RegisterRoutes(api)
  }
  if version_archiveH != nil {
    version_archiveH.RegisterRoutes(api)
  }
  if visorH != nil {
    visorH.RegisterRoutes(api)
  }
  if webhookH != nil {
    webhookH.RegisterRoutes(api)
  }
  if workbenchH != nil {
    workbenchH.RegisterRoutes(api)
  }
  if workflowH != nil {
    workflowH.RegisterRoutes(api)
  }
  // workflowExtraH is wired independently of workflowH (see wiring.go), so it
  // needs its own nil guard — piggy-backing on workflowH != nil would nil-panic
  // whenever only one of the two is constructed.
  if workflowExtraH != nil {
    workflowExtraH.RegisterRoutes(api)
  }
  if workflow_depH != nil {
    workflow_depH.RegisterRoutes(api)
  }
  if workflow_taskH != nil {
    workflow_taskH.RegisterRoutes(api)
  }
  if workflow_triggerH != nil {
    workflow_triggerH.RegisterRoutes(api)
  }
  if workflow_webhookH != nil {
    workflow_webhookH.RegisterRoutes(api)
  }
  if sandboxH != nil {
    sandboxH.RegisterRoutes(api)
  }
  if loggingH != nil {
    loggingH.RegisterRoutes(api)
  }
  if crossoverH != nil {
    crossoverH.RegisterRoutes(api)
  }
  if storageH != nil {
    storageH.RegisterRoutes(api)
  }
  if clusterH != nil {
    clusterH.RegisterRoutes(api)
  }
  if aiInferenceH != nil {
    aiInferenceH.RegisterRoutes(api)
  }
  // ---- AI modules (internal/ai/) ----
  if ai_llmH != nil {
    ai_llmH.RegisterRoutes(api)
  }
  if ai_aiagentH != nil {
    ai_aiagentH.RegisterRoutes(api)
  }
  if ai_aicostH != nil {
    ai_aicostH.RegisterRoutes(api)
  }
  // ai_aigatewayH is NOT registered: its entire route set is a duplicate of
  // aiGatewayH above. Gin keeps the first registration and panics on the second.
  // ai_aireviewH is NOT registered: identical route set to aiReviewH above.
  // Gin keeps the first registration and panics on the second.
  if ai_aisecurityH != nil {
    ai_aisecurityH.RegisterRoutes(api)
  }
  if ai_orchestrationH != nil {
    ai_orchestrationH.RegisterRoutes(api)
  }
  if ai_autorecoveryH != nil {
    ai_autorecoveryH.RegisterRoutes(api)
  }
  if ai_skillH != nil {
    ai_skillH.RegisterRoutes(api)
  }
  // ai_skillH owns /skills; ai_knowledgeH owns /knowledge/bases + /knowledge/search
  // (knowledgeH above uses /knowledge/spaces|docs|sync|eval, so no path is shared).
  if ai_knowledgeH != nil {
    ai_knowledgeH.RegisterRoutes(api)
  }
  if ai_intelligenceH != nil {
    ai_intelligenceH.RegisterRoutes(api)
  }
  if ai_llmtraceH != nil {
    ai_llmtraceH.RegisterRoutes(api)
  }
  if networkH != nil {
    networkH.RegisterRoutes(api)
  }
  if visorExecH != nil {
    visorExecH.RegisterRoutes(api)
  }
  if applicationH != nil {
    applicationH.RegisterRoutes(api)
  }
  if aeH != nil {
    aeH.RegisterRoutes(api)
  }
  if sagaH != nil {
    sagaH.RegisterRoutes(api)
  }
  if alertAdapterH != nil {
    alertAdapterH.RegisterRoutes(api)
  }
  if alertCorrelationH != nil {
    alertCorrelationH.RegisterRoutes(api)
  }
  if alertDeduplicationH != nil {
    alertDeduplicationH.RegisterRoutes(api)
  }
  if alertSilenceH != nil {
    alertSilenceH.RegisterRoutes(api)
  }
  if alertPipelineH != nil {
    alertPipelineH.RegisterRoutes(api)
  }
  if domainCqrsH != nil {
    domainCqrsH.RegisterRoutes(api)
  }
  // pipelineAuditLogH is NOT registered: identical route set to palH above
  // (and to ai_skillH's audit-log routes). Gin panics on a second registration.
  // pipelineRunHistoryH is NOT registered: identical route set to phistH above.




  if dndH != nil {
    dndH.RegisterRoutes(api)
  }
    if circuitBreakerH != nil {
    circuitBreakerH.RegisterRoutes(api)
  }
  if importExportH != nil {
    importExportH.RegisterRoutes(api)
  }
  if extensionPointH != nil {
    extensionPointH.RegisterRoutes(api)
  }
  if smartDeployH != nil {
    smartDeployH.RegisterRoutes(api)
  }
  if testSelectorH != nil {
    testSelectorH.RegisterRoutes(api)
  }
  if slaEngineH != nil {
    slaEngineH.RegisterRoutes(api)
  }
  if formH != nil {
    formH.RegisterRoutes(api)
  }
  if paramTypesH != nil {
    paramTypesH.RegisterRoutes(api)
  }
  if pandawikiH != nil {
    pandawikiH.RegisterRoutes(api)
  }
  if metadataH != nil {
    metadataH.RegisterRoutes(api)
  }
  if mlopsH != nil {
    mlopsH.RegisterRoutes(api)
  }
  if testGenH != nil {
    testGenH.RegisterRoutes(api)
  }
  if inspectionH != nil {
    inspectionH.RegisterRoutes(api)
  }
  if cmdbCollectorH != nil {
    cmdbCollectorH.RegisterRoutes(api)
  }
  if cmdbDriftH != nil {
    cmdbDriftH.RegisterRoutes(api)
  }
  if apkUploadHistoryH != nil {
    apkUploadHistoryH.RegisterRoutes(api)
  }
  if artifactlifecycleH != nil {
    artifactlifecycleH.RegisterRoutes(api)
  }
  if autoExecH != nil {
    autoExecH.RegisterRoutes(api)
  }
  if autonomousPipelineH != nil {
    autonomousPipelineH.RegisterRoutes(api)
  }
  if communityAdvancedH != nil {
    communityAdvancedH.RegisterRoutes(api)
  }
  if communityH != nil {
    communityH.RegisterRoutes(api)
  }
  if conditionH != nil {
    conditionH.RegisterRoutes(api)
  }
  if configMgmtEnhancedH != nil {
    configMgmtEnhancedH.RegisterRoutes(api)
  }
  if dataMaskingH != nil {
    dataMaskingH.RegisterRoutes(api)
  }
  if digitalTwinSimulationH != nil {
    digitalTwinSimulationH.RegisterRoutes(api)
  }
  if disasterrecoveryH != nil {
    disasterrecoveryH.RegisterRoutes(api)
  }
  if eventTriggerRegistryH != nil {
    eventTriggerRegistryH.RegisterRoutes(api)
  }
  if executionModeEngineH != nil {
    executionModeEngineH.RegisterRoutes(api)
  }
  if jobProcessorH != nil {
    jobProcessorH.RegisterRoutes(api)
  }
  if mcpH != nil {
    mcpH.RegisterRoutes(api)
  }
  if moduleH != nil {
    moduleH.RegisterRoutes(api)
  }
  if observabilityH != nil {
    observabilityH.RegisterRoutes(api)
  }
  // Web Vitals receiver — receives frontend Core Web Vitals (LCP/CLS/INP/FID/TTFB/FCP)
  // and exposes them as Prometheus metrics. Public endpoint, no auth required.
  api.POST("/performance/vitals", observability.WebVitalsHandler)
  if pipelineErrorDetailH != nil {
    pipelineErrorDetailH.RegisterRoutes(api)
  }
  if releaseMgmtH != nil {
    releaseMgmtH.RegisterRoutes(api)
  }
  if startupH != nil {
    startupH.RegisterRoutes(api)
  }
  if taskTimeoutH != nil {
    taskTimeoutH.RegisterRoutes(api)
  }
  if tenantGatewayH != nil {
    tenantGatewayH.RegisterRoutes(api)
  }
  if terminalAuditH != nil {
    terminalAuditH.RegisterRoutes(api)
  }
  if testExecEngineH != nil {
    testExecEngineH.RegisterRoutes(api)
  }
  if useractivityH != nil {
    useractivityH.RegisterRoutes(api)
  }
  if userprofileH != nil {
    userprofileH.RegisterRoutes(api)
  }
  if userstatusH != nil {
    userstatusH.RegisterRoutes(api)
  }
  if usertokenH != nil {
    usertokenH.RegisterRoutes(api)
  }
  if vectorH != nil {
    vectorH.RegisterRoutes(api)
  }
  if vulnerabilityH != nil {
    vulnerabilityH.RegisterRoutes(api)
  }
  if alertAdapterV2H != nil {
    alertAdapterV2H.RegisterRoutes(api)
  }
  // autoRecoveryH is NOT registered: identical route set to ai_autorecoveryH above.
  if capacityH != nil {
    capacityH.RegisterRoutes(api)
  }
  if middlewareOpsH != nil {
    middlewareOpsH.RegisterRoutes(api)
  }
  // orchestrationH is NOT registered: identical route set to ai_orchestrationH
  // above, plus its own routes contain a trie conflict (`:id` vs `:orch_id`
  // under /api/v1/orchestration) that Gin would panic on.

  // serviceControlH and automationRuleTicketH are NOT registered: their
  // /ticketing/start|stop|health and /ticketing/automation/rules sets are
  // already claimed by ticketingH above, and Gin panics on a second
  // (method, path) pair.
  if cmdb_importH != nil {
    cmdb_importH.RegisterRoutes(api)
  }
  if cmdb_relationshipH != nil {
    cmdb_relationshipH.RegisterRoutes(api)
  }
  if cmdb_validatorH != nil {
    cmdb_validatorH.RegisterRoutes(api)
  }
  if governanceComplianceH != nil {
    // Namespaced: this handler declares its routes as bare /reports,
    // /schedules and /policies, which are already owned by report-designerH
    // and policyH. Its TS package is internal/governance/compliance.
    governanceComplianceH.RegisterRoutes(api.Group("/governance/compliance"))
  }
  if identityConfirmationH != nil {
    identityConfirmationH.RegisterRoutes(api)
  }
  if infraCapH != nil {
    infraCapH.RegisterRoutes(api)
  }
  // infraServerlessH is NOT registered: identical route set to serverlessH above.
  // psH is NOT registered: it is the same handler object as promptSecurityH
  // (psH = promptSecurityH in wiring.go), already registered above.
  if securityBranchPolicyH != nil {
    securityBranchPolicyH.RegisterRoutes(api)
  }

  // ---- Wired but unregistered handlers (batch registration) ----
  // Note: 10 handlers skipped - no RegisterRoutes method:
  //   analyticsTicketH (AnalyticsHandler), dispatchH (DispatchHandler),
  //   loadBalancerH (LoadBalancerHandler), queueH (QueueHandler),
  //   relationH (RelationHandler), slaModH (SLAHandler),
  //   suspendH (SuspendHandler), transferH (TransferHandler),
  //   ticketH (TicketHandler), workflowModH (WorkflowHandler)
  if aiAgentRunH != nil {
    aiAgentRunH.RegisterRoutes(api)
  }
  if aiModelsH != nil {
    aiModelsH.RegisterRoutes(api)
  }
  if ciArtRegH != nil {
    ciArtRegH.RegisterRoutes(api)
  }
  if ciArtVerH != nil {
    ciArtVerH.RegisterRoutes(api)
  }
  if ciBuildH != nil {
    ciBuildH.RegisterRoutes(api)
  }
  if ciDeployH != nil {
    ciDeployH.RegisterRoutes(api)
  }
  if ciPTmplH != nil {
    ciPTmplH.RegisterRoutes(api)
  }
  if ciRunnerH != nil {
    ciRunnerH.RegisterRoutes(api)
  }
  if governanceH != nil {
    // Namespaced: this handler owns /policies, already taken by policyH.
    governanceH.RegisterRoutes(api.Group("/governance"))
  }
  if governancePolicyH != nil {
    // Namespaced: /policies is owned by policyH, and /governance/policies by
    // governanceH above.
    governancePolicyH.RegisterRoutes(api.Group("/governance/policy"))
  }
  if governanceRiskH != nil {
    governanceRiskH.RegisterRoutes(api)
  }
  if graphH != nil {
    graphH.RegisterRoutes(api)
  }
  if identitySsoH != nil {
    identitySsoH.RegisterRoutes(api)
  }
  if infraBackupH != nil {
    infraBackupH.RegisterRoutes(api)
  }
  if infraArchiveH != nil {
    infraArchiveH.RegisterRoutes(api)
  }
  if infraChaosH != nil {
    infraChaosH.RegisterRoutes(api)
  }
  if infraSchemaRegH != nil {
    infraSchemaRegH.RegisterRoutes(api)
  }
  // infraDbaH is NOT registered: identical route set to dbaH above.
  if infraDegH != nil {
    infraDegH.RegisterRoutes(api)
  }
  if infraDrH != nil {
    infraDrH.RegisterRoutes(api)
  }
  if infraDTwinH != nil {
    infraDTwinH.RegisterRoutes(api)
  }
  if infraEEH != nil {
    infraEEH.RegisterRoutes(api)
  }
  // infraIacH is NOT registered: identical route set to iacH above, and its
  // own registration contains a trie conflict (`:id` vs `:workspaceId` under
  // /api/v1/iac/workspaces) that Gin would panic on.
  if infraMultiH != nil {
    infraMultiH.RegisterRoutes(api)
  }
  if infraMWnH != nil {
    infraMWnH.RegisterRoutes(api)
  }
  if infraOCIH != nil {
    infraOCIH.RegisterRoutes(api)
  }
  if jobsourceH != nil {
    jobsourceH.RegisterRoutes(api)
  }
  if pipelineBudgetH != nil {
    pipelineBudgetH.RegisterRoutes(api)
  }
  if pipelineExecutorH != nil {
    pipelineExecutorH.RegisterRoutes(api)
  }
  if pipelineTemplatesH != nil {
    pipelineTemplatesH.RegisterRoutes(api)
  }
  if pipelineVersionsH != nil {
    pipelineVersionsH.RegisterRoutes(api)
  }
  if pluginMarketplaceH != nil {
    pluginMarketplaceH.RegisterRoutes(api)
  }
  if resilienceScoreH != nil {
    resilienceScoreH.RegisterRoutes(api)
  }
  if runnerH != nil {
    runnerH.RegisterRoutes(api)
  }
  if sbomH != nil {
    sbomH.RegisterRoutes(api)
  }
  if securityH != nil {
    // Namespaced: this handler owns /audit/plans, already taken by
    // security_complianceH, and /scans and /findings collide with other
    // scan-oriented handlers. code_scanH already uses /security/code-scan.
    securityH.RegisterRoutes(api.Group("/security"))
  }
  if securityPrivacyH != nil {
    securityPrivacyH.RegisterRoutes(api)
  }
  if securitySecretH != nil {
    // Namespaced: this handler's /secrets set is a full duplicate of
    // secretH's, and Gin panics on the second registration.
    securitySecretH.RegisterRoutes(api.Group("/security"))
  }
  // slaPolicyTicketH (/ticketing/sla/policies*) and ticketSourceTicketH
  // (POST /tickets/from-alert, /tickets/from-incident) are NOT registered:
  // ticketingH above already owns those paths.
  // P1: agents, database-devops, gateway-routes, rate-limiting, test-reports
  if agentsH != nil {
    agentsH.RegisterRoutes(api)
  }
  if dbdevopsH != nil {
    dbdevopsH.RegisterRoutes(api)
  }
  // internal/datasource owns /data-sources at the /api/v1 level; dbdevopsH
  // keeps its own nested /database-devops/data-sources pair above.
  if datasourceH != nil {
    datasourceH.RegisterRoutes(api)
  }
  // internal/skill owns /skill; ai_skillH above owns the plural /skills.
  if skillH != nil {
    skillH.RegisterRoutes(api)
  }
  if gwRoutesH != nil {
    gwRoutesH.RegisterRoutes(api)
  }
  if rateLimitH != nil {
    rateLimitH.RegisterRoutes(api)
  }
  if testReportsH != nil {
    testReportsH.RegisterRoutes(api)
  }
  if middlewareH != nil {
    middlewareH.RegisterRoutes(api)
  }
  if statisticsH != nil {
    statisticsH.RegisterRoutes(api)
  }
  if roweditorH != nil {
    roweditorH.RegisterRoutes(api)
  }
  if apiComponentH != nil {
    apiComponentH.RegisterRoutes(api)
  }
  if alertRuleEngineH != nil {
    alertRuleEngineH.RegisterRoutes(api)
  }
  // serviceCatalogH is NOT registered: a second service-catalog handler object
  // (wiring-service-catalog.go) whose route set duplicates service_catalogH above.

	// Route discovery endpoint — returns all registered routes for DocumentationGenerator
	api.GET("/routes", func(c *gin.Context) {
		var routes []gin.RouteInfo
		for _, route := range r.Routes() {
			if strings.HasPrefix(route.Path, "/api/v1") {
				routes = append(routes, route)
			}
		}
		c.JSON(200, gin.H{
			"data":  routes,
			"total": len(routes),
		})
	})
	}

	// OpenAPI 3.0 spec generation and healthcheck endpoints
	registerOpenAPIRoutes(r)

	return r
}
