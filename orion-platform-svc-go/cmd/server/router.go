// Package server provides the command-line entry point for the platform service.
package main

import (
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"

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

	// Prometheus metrics endpoint (unprotected)
	r.GET("/metrics", middleware.MetricsHandler())

	// Create /api/v1 group for all platform routes
	api := r.Group("/api/v1")
	{
  if abacH != nil {
    abacH.RegisterRoutes(api)
  }
  if aeH != nil {
    aeH.RegisterRoutes(api)
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
  if backupH != nil {
    backupH.RegisterRoutes(api)
  }
  if cacheModH != nil {
    cacheModH.RegisterRoutes(api)
  }
  if cacheCleanupH != nil {
    cacheCleanupH.RegisterRoutes(api)
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
  if chanH != nil {
    chanH.RegisterRoutes(api)
  }
  if changeH != nil {
    changeH.RegisterRoutes(api)
  }
  if chaosH != nil {
    chaosH.RegisterRoutes(api)
  }
  if chaos_enhancedH != nil {
    chaos_enhancedH.RegisterRoutes(api)
  }
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
  if complianceH != nil {
    complianceH.RegisterRoutes(api)
  }
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
  if ddH != nil {
    ddH.RegisterRoutes(api)
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
    developerportalH.RegisterRoutes(api)
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
  if efficiencyH != nil {
    efficiencyH.RegisterRoutes(api)
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
    gatewaydynamicH.RegisterRoutes(api)
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
    pageregistryH.RegisterRoutes(api)
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
    sloH.RegisterRoutes(api)
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
    teamH.RegisterRoutes(api)
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
  if storageH != nil {
    storageH.RegisterRoutes(api)
  }
  if message_queueH != nil {
    message_queueH.RegisterRoutes(api)
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
  if ai_aigatewayH != nil {
    ai_aigatewayH.RegisterRoutes(api)
  }
  if ai_aireviewH != nil {
    ai_aireviewH.RegisterRoutes(api)
  }
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
  if ai_intelligenceH != nil {
    ai_intelligenceH.RegisterRoutes(api)
  }
  if ai_llmtraceH != nil {
    ai_llmtraceH.RegisterRoutes(api)
  }
  if networkH != nil {
    networkH.RegisterRoutes(api)
  }
  if visorH != nil {
    visorH.RegisterRoutes(api)
  }
  if visorExecH != nil {
    visorExecH.RegisterRoutes(api)
  }
  if applicationH != nil {
    applicationH.RegisterRoutes(api)
  }
  if escalationH != nil {
    escalationH.RegisterRoutes(api)
  }
  if runbookH != nil {
    runbookH.RegisterRoutes(api)
  }
  if sagaH != nil {
    sagaH.RegisterRoutes(api)
  }
  if pipelineExecutorH != nil {
    pipelineExecutorH.RegisterRoutes(api)
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
  if pipelineAuditLogH != nil {
    pipelineAuditLogH.RegisterRoutes(api)
  }
  if pipelineRunHistoryH != nil {
    pipelineRunHistoryH.RegisterRoutes(api)
  }




  if dndH != nil {
    dndH.RegisterRoutes(api)
  }
  if chaosGatewayH != nil {
    chaosGatewayH.RegisterRoutes(api)
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
  if cacheMgmtH != nil {
    cacheMgmtH.RegisterRoutes(api)
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
  if cacheMgmtH != nil {
    cacheMgmtH.RegisterRoutes(api)
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
  if pipelineErrorDetailH != nil {
    pipelineErrorDetailH.RegisterRoutes(api)
  }
  if pipelineExecutorH != nil {
    pipelineExecutorH.RegisterRoutes(api)
  }
  if releaseMgmtH != nil {
    releaseMgmtH.RegisterRoutes(api)
  }
  if smartDeployH != nil {
    smartDeployH.RegisterRoutes(api)
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

  // ---- Wired but unregistered handlers (Wave 2 parallel execution) ----
  if serviceControlH != nil {
    serviceControlH.RegisterRoutes(api)
  }
  if automationRuleTicketH != nil {
    automationRuleTicketH.RegisterRoutes(api)
  }
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
    governanceComplianceH.RegisterRoutes(api)
  }
  if identityConfirmationH != nil {
    identityConfirmationH.RegisterRoutes(api)
  }
  if infraCapH != nil {
    infraCapH.RegisterRoutes(api)
  }
  if infraServerlessH != nil {
    infraServerlessH.RegisterRoutes(api)
  }
  if psH != nil {
    psH.RegisterRoutes(api)
  }
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
    governanceH.RegisterRoutes(api)
  }
  if governancePolicyH != nil {
    governancePolicyH.RegisterRoutes(api)
  }
  if governanceRiskH != nil {
    governanceRiskH.RegisterRoutes(api)
  }
  if graphH != nil {
    graphH.RegisterRoutes(api)
  }
  if identityApikeyH != nil {
    identityApikeyH.RegisterRoutes(api)
  }
  if identitySessionH != nil {
    identitySessionH.RegisterRoutes(api)
  }
  if identitySsoH != nil {
    identitySsoH.RegisterRoutes(api)
  }
  if identityTenantH != nil {
    identityTenantH.RegisterRoutes(api)
  }
  if infraBackupH != nil {
    infraBackupH.RegisterRoutes(api)
  }
  if infraChaosH != nil {
    infraChaosH.RegisterRoutes(api)
  }
  if infraDbaH != nil {
    infraDbaH.RegisterRoutes(api)
  }
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
  if infraIacH != nil {
    infraIacH.RegisterRoutes(api)
  }
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
  if securityCrossDomainH != nil {
    securityCrossDomainH.RegisterRoutes(api)
  }
  if securityH != nil {
    securityH.RegisterRoutes(api)
  }
  if securityPrivacyH != nil {
    securityPrivacyH.RegisterRoutes(api)
  }
  if securitySecretH != nil {
    securitySecretH.RegisterRoutes(api)
  }
  if securityUebaH != nil {
    securityUebaH.RegisterRoutes(api)
  }
  if slaPolicyTicketH != nil {
    slaPolicyTicketH.RegisterRoutes(api)
  }
  if ticketSourceTicketH != nil {
    ticketSourceTicketH.RegisterRoutes(api)
  }
	}

	return r
}
