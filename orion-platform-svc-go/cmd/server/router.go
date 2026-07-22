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
  if skillH != nil {
    skillH.RegisterRoutes(api)
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
	}

	return r
}
