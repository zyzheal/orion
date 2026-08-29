package main

import (
	"fmt"
	"regexp"
	"testing"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	cqrs_commands "orion/platform-svc-go/internal/application/commands"
	cqrs_http "orion/platform-svc-go/internal/application/http"
	ticket_handler "orion/platform-svc-go/internal/ticket/handler"
)

// TestRouteConflictScan registers every handler independently, recovering from
// each Gin panic so that ALL duplicate-registration and static-vs-wildcard trie
// conflicts are reported in a single run instead of one at a time.
//
// This is the diagnostic companion to TestSetupRouterFullRegistration: the boot
// test proves the assembled router is panic-free; this one enumerates the
// offending registrations while conflicts still exist.
func TestRouteConflictScan(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("REDIS_ADDR", "localhost:6379")
	t.Setenv("DB_USER", "postgres")
	t.Setenv("DB_PASSWORD", "postgres")
	gin.SetMode(gin.TestMode)

	logger := zap.NewNop()
	initWiring(stubInfrastructure(logger), logger)

	r := gin.New()
	api := r.Group("/api/v1")
	public := r.Group("/auth")
	protected := api.Group("/auth")
	sec := api.Group("/security")

	reg := []struct {
		name string
		fn   func()
	}{
		{"abacH", func() {
			if abacH != nil {
				abacH.RegisterRoutes(api)
			}
		}},
		{"alertEscH", func() {
			if alertEscH != nil {
				alertEscH.RegisterRoutes(api)
			}
		}},
		{"dcH", func() {
			if dcH != nil {
				dcH.RegisterRoutes(api)
			}
		}},
		{"lcH", func() {
			if lcH != nil {
				lcH.RegisterRoutes(api)
			}
		}},
		{"tqH", func() {
			if tqH != nil {
				tqH.RegisterRoutes(api)
			}
		}},
		{"agH", func() {
			if agH != nil {
				agH.RegisterRoutes(api)
			}
		}},
		{"aiAgentsH", func() {
			if aiAgentsH != nil {
				aiAgentsH.RegisterRoutes(api)
			}
		}},
		{"aiCostH", func() {
			if aiCostH != nil {
				aiCostH.RegisterRoutes(api)
			}
		}},
		{"aiDecisionsH", func() {
			if aiDecisionsH != nil {
				aiDecisionsH.RegisterRoutes(api)
			}
		}},
		{"aiGatewayH", func() {
			if aiGatewayH != nil {
				aiGatewayH.RegisterRoutes(api)
			}
		}},
		{"aiReviewH", func() {
			if aiReviewH != nil {
				aiReviewH.RegisterRoutes(api)
			}
		}},
		{"alertH", func() {
			if alertH != nil {
				alertH.RegisterRoutes(api)
			}
		}},
		{"alert_breakerH", func() {
			if alert_breakerH != nil {
				alert_breakerH.RegisterRoutes(api)
			}
		}},
		{"amH", func() {
			if amH != nil {
				amH.RegisterRoutes(api)
			}
		}},
		{"amfaH", func() {
			if amfaH != nil {
				amfaH.RegisterRoutes(api)
			}
		}},
		{"apiConsumptionH", func() {
			if apiConsumptionH != nil {
				apiConsumptionH.RegisterRoutes(api)
			}
		}},
		{"apikeyH", func() {
			if apikeyH != nil {
				apikeyH.RegisterRoutes(api)
			}
		}},
		{"apmH", func() {
			if apmH != nil {
				apmH.RegisterRoutes(api)
			}
		}},
		{"approvalH", func() {
			if approvalH != nil {
				approvalH.RegisterRoutes(api)
			}
		}},
		{"artifactH", func() {
			if artifactH != nil {
				artifactH.RegisterRoutes(api)
			}
		}},
		{"artifactVersionH", func() {
			if artifactVersionH != nil {
				artifactVersionH.RegisterRoutes(api)
			}
		}},
		{"artifactopsH", func() {
			if artifactopsH != nil {
				artifactopsH.RegisterRoutes(api)
			}
		}},
		{"auditH", func() {
			if auditH != nil {
				auditH.RegisterRoutes(api)
			}
		}},
		{"authH", func() {
			if authH != nil {
				authH.RegisterRoutes(public, protected)
			}
		}},
		{"backupH", func() {
			if backupH != nil {
				backupH.RegisterRoutes(api)
			}
		}},
		{"cacheModH", func() {
			if cacheModH != nil {
				cacheModH.RegisterRoutes(api)
			}
		}},
		// infra.cqrsHandler is not a package-global; build the handler the same
		// way setupRouter does (config.go) so the replay covers /commands/*.
		{"cqrsHandler", func() {
			cqrs_http.NewHandler(cqrs_commands.NewCommandBus()).RegisterRoutes(api)
		}},
		{"cacheCleanupH", func() {
			if cacheCleanupH != nil {
				cacheCleanupH.RegisterRoutes(api)
			}
		}},
		{"cacheMgmtH", func() {
			if cacheMgmtH != nil {
				cacheMgmtH.RegisterRoutes(api.Group("/cache-mgmt"))
			}
		}},
		{"bi_dashboardH", func() {
			if bi_dashboardH != nil {
				bi_dashboardH.RegisterRoutes(api)
			}
		}},
		{"billingH", func() {
			if billingH != nil {
				billingH.RegisterRoutes(api)
			}
		}},
		{"buildH", func() {
			if buildH != nil {
				buildH.RegisterRoutes(api)
			}
		}},
		{"build_envH", func() {
			if build_envH != nil {
				build_envH.RegisterRoutes(api)
			}
		}},
		{"canary_analysisH", func() {
			if canary_analysisH != nil {
				canary_analysisH.RegisterRoutes(api)
			}
		}},
		{"canary_trafficH", func() {
			if canary_trafficH != nil {
				canary_trafficH.RegisterRoutes(api)
			}
		}},
		{"capabilityH", func() {
			if capabilityH != nil {
				capabilityH.RegisterRoutes(api)
			}
		}},
		{"changeH", func() {
			if changeH != nil {
				changeH.RegisterRoutes(api)
			}
		}},
		{"chaosEngineH", func() {
			if chaosEngineH != nil {
				chaosEngineH.RegisterRoutes(api)
			}
		}},
		{"chatopsH", func() {
			if chatopsH != nil {
				chatopsH.RegisterRoutes(api)
			}
		}},
		{"ciH", func() {
			if ciH != nil {
				ciH.RegisterRoutes(api)
			}
		}},
		{"citH", func() {
			if citH != nil {
				citH.RegisterRoutes(api)
			}
		}},
		{"channelH", func() {
			if channelH != nil {
				channelH.RegisterRoutes(api)
			}
		}},
		{"cmdbH", func() {
			if cmdbH != nil {
				cmdbH.RegisterRoutes(api)
			}
		}},
		{"code_repoH", func() {
			if code_repoH != nil {
				code_repoH.RegisterRoutes(api)
			}
		}},
		{"configH", func() {
			if configH != nil {
				configH.RegisterRoutes(api)
			}
		}},
		{"contractH", func() {
			if contractH != nil {
				contractH.RegisterRoutes(api)
			}
		}},
		{"costallocH", func() {
			if costallocH != nil {
				costallocH.RegisterRoutes(api)
			}
		}},
		{"crH", func() {
			if crH != nil {
				crH.RegisterRoutes(api)
			}
		}},
		{"cronH", func() {
			if cronH != nil {
				cronH.RegisterRoutes(api)
			}
		}},
		{"cross_domainH", func() {
			if cross_domainH != nil {
				cross_domainH.RegisterRoutes(api)
			}
		}},
		{"dataLineageH", func() {
			if dataLineageH != nil {
				dataLineageH.RegisterRoutes(api)
			}
		}},
		{"dataCatalogH", func() {
			if dataCatalogH != nil {
				dataCatalogH.RegisterRoutes(api)
			}
		}},
		{"dataQualityH", func() {
			if dataQualityH != nil {
				dataQualityH.RegisterRoutes(api)
			}
		}},
		{"dataPipelineH", func() {
			if dataPipelineH != nil {
				dataPipelineH.RegisterRoutes(api)
			}
		}},
		{"dbaH", func() {
			if dbaH != nil {
				dbaH.RegisterRoutes(api)
			}
		}},
		{"decision_explanationH", func() {
			if decision_explanationH != nil {
				decision_explanationH.RegisterRoutes(api)
			}
		}},
		{"degradationH", func() {
			if degradationH != nil {
				degradationH.RegisterRoutes(api)
			}
		}},
		{"dependency_coordinationH", func() {
			if dependency_coordinationH != nil {
				dependency_coordinationH.RegisterRoutes(api)
			}
		}},
		{"deployH", func() {
			if deployH != nil {
				deployH.RegisterRoutes(api)
			}
		}},
		{"deploy_enhancedH", func() {
			if deploy_enhancedH != nil {
				deploy_enhancedH.RegisterRoutes(api)
			}
		}},
		{"deployment_triggerH", func() {
			if deployment_triggerH != nil {
				deployment_triggerH.RegisterRoutes(api)
			}
		}},
		{"developerportalH", func() {
			if developerportalH != nil {
				developerportalH.RegisterRoutes(api.Group("/developer-portal"))
			}
		}},
		{"diagnosticH", func() {
			if diagnosticH != nil {
				diagnosticH.RegisterRoutes(api)
			}
		}},
		{"digital_twinH", func() {
			if digital_twinH != nil {
				digital_twinH.RegisterRoutes(api)
			}
		}},
		{"dual_engineH", func() {
			if dual_engineH != nil {
				dual_engineH.RegisterRoutes(api)
			}
		}},
		{"escalationH", func() {
			if escalationH != nil {
				escalationH.RegisterRoutes(api)
			}
		}},
		{"efficiencyH", func() {
			if efficiencyH != nil {
				efficiencyH.RegisterRoutes(api.Group("/efficiency"))
			}
		}},
		{"envH", func() {
			if envH != nil {
				envH.RegisterRoutes(api)
			}
		}},
		{"env_lifecycleH", func() {
			if env_lifecycleH != nil {
				env_lifecycleH.RegisterRoutes(api)
			}
		}},
		{"env_profileH", func() {
			if env_profileH != nil {
				env_profileH.RegisterRoutes(api)
			}
		}},
		{"eventbusH", func() {
			if eventbusH != nil {
				eventbusH.RegisterRoutes(api)
			}
		}},
		{"fedH", func() {
			if fedH != nil {
				fedH.RegisterRoutes(api)
			}
		}},
		{"ffH", func() {
			if ffH != nil {
				ffH.RegisterRoutes(api)
			}
		}},
		{"finopsH", func() {
			if finopsH != nil {
				finopsH.RegisterRoutes(api)
			}
		}},
		{"finops_v2H", func() {
			if finops_v2H != nil {
				finops_v2H.RegisterRoutes(api)
			}
		}},
		{"gatewaydynamicH", func() {
			if gatewaydynamicH != nil {
				gatewaydynamicH.RegisterRoutes(api.Group("/gateway"))
			}
		}},
		{"gdGrayH", func() {
			if gdGrayH != nil {
				gdGrayH.RegisterRoutes(api)
			}
		}},
		{"global_paramH", func() {
			if global_paramH != nil {
				global_paramH.RegisterRoutes(api)
			}
		}},
		{"handlerregistryH", func() {
			if handlerregistryH != nil {
				handlerregistryH.RegisterRoutes(api)
			}
		}},
		{"hcH", func() {
			if hcH != nil {
				hcH.RegisterRoutes(api)
			}
		}},
		{"hookH", func() {
			if hookH != nil {
				hookH.RegisterRoutes(api)
			}
		}},
		{"i18nH", func() {
			if i18nH != nil {
				i18nH.RegisterRoutes(api)
			}
		}},
		{"iacH", func() {
			if iacH != nil {
				iacH.RegisterRoutes(api)
			}
		}},
		{"incH", func() {
			if incH != nil {
				incH.RegisterRoutes(api)
			}
		}},
		{"incidentH", func() {
			if incidentH != nil {
				incidentH.RegisterRoutes(api)
			}
		}},
		{"incident_actionH", func() {
			if incident_actionH != nil {
				incident_actionH.RegisterRoutes(api)
			}
		}},
		{"infraH", func() {
			if infraH != nil {
				infraH.RegisterRoutes(api)
			}
		}},
		{"integrationH", func() {
			if integrationH != nil {
				integrationH.RegisterRoutes(api)
			}
		}},
		{"internallibraryH", func() {
			if internallibraryH != nil {
				internallibraryH.RegisterRoutes(api)
			}
		}},
		{"assistantH", func() {
			if assistantH != nil {
				assistantH.RegisterRoutes(api)
			}
		}},
		{"knowledgeH", func() {
			if knowledgeH != nil {
				knowledgeH.RegisterRoutes(api)
			}
		}},
		{"lowcodeH", func() {
			if lowcodeH != nil {
				lowcodeH.RegisterRoutes(api)
			}
		}},
		{"maintenance_windowH", func() {
			if maintenance_windowH != nil {
				maintenance_windowH.RegisterRoutes(api)
			}
		}},
		{"message_queueH", func() {
			if message_queueH != nil {
				message_queueH.RegisterRoutes(api)
			}
		}},
		{"metricsH", func() {
			if metricsH != nil {
				metricsH.RegisterRoutes(api)
			}
		}},
		{"monitoringH", func() {
			if monitoringH != nil {
				monitoringH.RegisterRoutes(api)
			}
		}},
		{"multi_modal_triggerH", func() {
			if multi_modal_triggerH != nil {
				multi_modal_triggerH.RegisterRoutes(api)
			}
		}},
		{"multicloudH", func() {
			if multicloudH != nil {
				multicloudH.RegisterRoutes(api)
			}
		}},
		{"notificationH", func() {
			if notificationH != nil {
				notificationH.RegisterRoutes(api)
			}
		}},
		{"notification_mgmtH", func() {
			if notification_mgmtH != nil {
				notification_mgmtH.RegisterRoutes(api)
			}
		}},
		{"notification_policyH", func() {
			if notification_policyH != nil {
				notification_policyH.RegisterRoutes(api)
			}
		}},
		{"notification_templateH", func() {
			if notification_templateH != nil {
				notification_templateH.RegisterRoutes(api)
			}
		}},
		{"oci_registryH", func() {
			if oci_registryH != nil {
				oci_registryH.RegisterRoutes(api)
			}
		}},
		{"oncallH", func() {
			if oncallH != nil {
				oncallH.RegisterRoutes(api)
			}
		}},
		{"pageregistryH", func() {
			if pageregistryH != nil {
				pageregistryH.RegisterRoutes(api.Group("/page-registry"))
			}
		}},
		{"palH", func() {
			if palH != nil {
				palH.RegisterRoutes(api)
			}
		}},
		{"pauditH", func() {
			if pauditH != nil {
				pauditH.RegisterRoutes(api)
			}
		}},
		{"pbH", func() {
			if pbH != nil {
				pbH.RegisterRoutes(api)
			}
		}},
		{"pboH", func() {
			if pboH != nil {
				pboH.RegisterRoutes(api)
			}
		}},
		{"pecH", func() {
			if pecH != nil {
				pecH.RegisterRoutes(api)
			}
		}},
		{"perfH", func() {
			if perfH != nil {
				perfH.RegisterRoutes(api)
			}
		}},
		{"permH", func() {
			if permH != nil {
				permH.RegisterRoutes(api)
			}
		}},
		{"pgraphH", func() {
			if pgraphH != nil {
				pgraphH.RegisterRoutes(api)
			}
		}},
		{"phistH", func() {
			if phistH != nil {
				phistH.RegisterRoutes(api)
			}
		}},
		{"peH", func() {
			if peH != nil {
				peH.RegisterRoutes(api)
			}
		}},
		{"pipelineH", func() {
			if pipelineH != nil {
				pipelineH.RegisterRoutes(api)
			}
		}},
		{"pluginH", func() {
			if pluginH != nil {
				pluginH.RegisterRoutes(api)
			}
		}},
		{"plugin_hotreloadH", func() {
			if plugin_hotreloadH != nil {
				plugin_hotreloadH.RegisterRoutes(api)
			}
		}},
		{"policyH", func() {
			if policyH != nil {
				policyH.RegisterRoutes(api)
			}
		}},
		{"problemH", func() {
			if problemH != nil {
				problemH.RegisterRoutes(api)
			}
		}},
		{"process_stepH", func() {
			if process_stepH != nil {
				process_stepH.RegisterRoutes(api)
			}
		}},
		{"productlineH", func() {
			if productlineH != nil {
				productlineH.RegisterRoutes(api)
			}
		}},
		{"progessiveH", func() {
			if progessiveH != nil {
				progessiveH.RegisterRoutes(api)
			}
		}},
		{"projH", func() {
			if projH != nil {
				projH.RegisterRoutes(api)
			}
		}},
		{"projectmemberH", func() {
			if projectmemberH != nil {
				projectmemberH.RegisterRoutes(api)
			}
		}},
		{"psseH", func() {
			if psseH != nil {
				psseH.RegisterRoutes(api)
			}
		}},
		{"promptSecurityH", func() {
			if promptSecurityH != nil {
				promptSecurityH.RegisterRoutes(api)
			}
		}},
		{"cacheMonitorH", func() {
			if cacheMonitorH != nil {
				cacheMonitorH.RegisterRoutes(api)
			}
		}},
		{"codeEmbeddingH", func() {
			if codeEmbeddingH != nil {
				codeEmbeddingH.RegisterRoutes(api)
			}
		}},
		{"dataClassificationH", func() {
			if dataClassificationH != nil {
				dataClassificationH.RegisterRoutes(api)
			}
		}},
		{"fileHandlerH", func() {
			if fileHandlerH != nil {
				fileHandlerH.RegisterRoutes(api)
			}
		}},
		{"jobActionsH", func() {
			if jobActionsH != nil {
				jobActionsH.RegisterRoutes(api)
			}
		}},
		{"rcaH", func() {
			if rcaH != nil {
				rcaH.RegisterRoutes(api)
			}
		}},
		{"ruleEngineH", func() {
			if ruleEngineH != nil {
				ruleEngineH.RegisterRoutes(api)
			}
		}},
		{"semanticSearchH", func() {
			if semanticSearchH != nil {
				semanticSearchH.RegisterRoutes(api)
			}
		}},
		{"taskExecutorH", func() {
			if taskExecutorH != nil {
				taskExecutorH.RegisterRoutes(api)
			}
		}},
		{"toolH", func() {
			if toolH != nil {
				toolH.RegisterRoutes(api)
			}
		}},
		{"ptmplH", func() {
			if ptmplH != nil {
				ptmplH.RegisterRoutes(api)
			}
		}},
		{"ptrendH", func() {
			if ptrendH != nil {
				ptrendH.RegisterRoutes(api)
			}
		}},
		{"pverH", func() {
			if pverH != nil {
				pverH.RegisterRoutes(api)
			}
		}},
		{"queue_modH", func() {
			if queue_modH != nil {
				queue_modH.RegisterRoutes(api)
			}
		}},
		{"rdH", func() {
			if rdH != nil {
				rdH.RegisterRoutes(api)
			}
		}},
		{"riskH", func() {
			if riskH != nil {
				riskH.RegisterRoutes(api)
			}
		}},
		{"roleH", func() {
			if roleH != nil {
				roleH.RegisterRoutes(api)
			}
		}},
		{"runbookH", func() {
			if runbookH != nil {
				runbookH.RegisterRoutes(api)
			}
		}},
		{"scheduled_notificationH", func() {
			if scheduled_notificationH != nil {
				scheduled_notificationH.RegisterRoutes(api)
			}
		}},
		{"script_libraryH", func() {
			if script_libraryH != nil {
				script_libraryH.RegisterRoutes(api)
			}
		}},
		{"script_modH", func() {
			if script_modH != nil {
				script_modH.RegisterRoutes(api)
			}
		}},
		{"script_versionH", func() {
			if script_versionH != nil {
				script_versionH.RegisterRoutes(api)
			}
		}},
		{"secretH", func() {
			if secretH != nil {
				secretH.RegisterRoutes(api)
			}
		}},
		{"security_complianceH", func() {
			if security_complianceH != nil {
				security_complianceH.RegisterRoutes(api)
			}
		}},
		{"code_scanH", func() {
			if code_scanH != nil {
				code_scanH.RegisterRoutes(sec)
			}
		}},
		{"self_serviceH", func() {
			if self_serviceH != nil {
				self_serviceH.RegisterRoutes(api)
			}
		}},
		{"selfhealingH", func() {
			if selfhealingH != nil {
				selfhealingH.RegisterRoutes(api)
			}
		}},
		{"serverlessH", func() {
			if serverlessH != nil {
				serverlessH.RegisterRoutes(api)
			}
		}},
		{"service_catalogH", func() {
			if service_catalogH != nil {
				service_catalogH.RegisterRoutes(api)
			}
		}},
		{"service_healthH", func() {
			if service_healthH != nil {
				service_healthH.RegisterRoutes(api)
			}
		}},
		{"service_topologyH", func() {
			if service_topologyH != nil {
				service_topologyH.RegisterRoutes(api)
			}
		}},
		{"serviceregistryH", func() {
			if serviceregistryH != nil {
				serviceregistryH.RegisterRoutes(api)
			}
		}},
		{"sessionH", func() {
			if sessionH != nil {
				sessionH.RegisterRoutes(api)
			}
		}},
		{"slaH", func() {
			if slaH != nil {
				slaH.RegisterRoutes(api)
			}
		}},
		{"sloH", func() {
			if sloH != nil {
				sloH.RegisterRoutes(api.Group("/slo"))
			}
		}},
		{"sprintH", func() {
			if sprintH != nil {
				sprintH.RegisterRoutes(api)
			}
		}},
		{"ssopH", func() {
			if ssopH != nil {
				ssopH.RegisterRoutes(api)
			}
		}},
		{"ssouH", func() {
			if ssouH != nil {
				ssouH.RegisterRoutes(api)
			}
		}},
		{"subappH", func() {
			if subappH != nil {
				subappH.RegisterRoutes(api)
			}
		}},
		{"supply_chainH", func() {
			if supply_chainH != nil {
				supply_chainH.RegisterRoutes(api)
			}
		}},
		{"teamH", func() {
			if teamH != nil {
				teamH.RegisterRoutes(api.Group("/teams"))
			}
		}},
		{"tenantH", func() {
			if tenantH != nil {
				tenantH.RegisterRoutes(api)
			}
		}},
		{"ticket_automationH", func() {
			if ticket_automationH != nil {
				ticket_automationH.RegisterRoutes(api)
			}
		}},
		{"ticket_knowledgeH", func() {
			if ticket_knowledgeH != nil {
				ticket_knowledgeH.RegisterRoutes(api)
			}
		}},
		{"ticketingH", func() {
			if ticketingH != nil {
				ticketingH.RegisterRoutes(api)
			}
		}},
		{"ticket-domain", func() {
			ticket_handler.RegisterTicketDomainRoutes(api, ticketH, slaModH, dispatchH, queueH, loadBalancerH, transferH)
		}},
		{"topologyH", func() {
			if topologyH != nil {
				topologyH.RegisterRoutes(api)
			}
		}},
		{"tracingH", func() {
			if tracingH != nil {
				tracingH.RegisterRoutes(api)
			}
		}},
		{"triggerH", func() {
			if triggerH != nil {
				triggerH.RegisterRoutes(api)
			}
		}},
		{"uebaH", func() {
			if uebaH != nil {
				uebaH.RegisterRoutes(api)
			}
		}},
		{"unified_configH", func() {
			if unified_configH != nil {
				unified_configH.RegisterRoutes(api)
			}
		}},
		{"userH", func() {
			if userH != nil {
				userH.RegisterRoutes(api)
			}
		}},
		{"vector_storeH", func() {
			if vector_storeH != nil {
				vector_storeH.RegisterRoutes(api)
			}
		}},
		{"vectorize_rulesH", func() {
			if vectorize_rulesH != nil {
				vectorize_rulesH.RegisterRoutes(api)
			}
		}},
		{"version_archiveH", func() {
			if version_archiveH != nil {
				version_archiveH.RegisterRoutes(api)
			}
		}},
		{"visorH", func() {
			if visorH != nil {
				visorH.RegisterRoutes(api)
			}
		}},
		{"webhookH", func() {
			if webhookH != nil {
				webhookH.RegisterRoutes(api)
			}
		}},
		{"workbenchH", func() {
			if workbenchH != nil {
				workbenchH.RegisterRoutes(api)
			}
		}},
		{"workflowH", func() {
			if workflowH != nil {
				workflowH.RegisterRoutes(api)
			}
		}},
		{"workflowExtraH", func() {
			if workflowExtraH != nil {
				workflowExtraH.RegisterRoutes(api)
			}
		}},
		{"workflow_depH", func() {
			if workflow_depH != nil {
				workflow_depH.RegisterRoutes(api)
			}
		}},
		{"workflow_taskH", func() {
			if workflow_taskH != nil {
				workflow_taskH.RegisterRoutes(api)
			}
		}},
		{"workflow_triggerH", func() {
			if workflow_triggerH != nil {
				workflow_triggerH.RegisterRoutes(api)
			}
		}},
		{"workflow_webhookH", func() {
			if workflow_webhookH != nil {
				workflow_webhookH.RegisterRoutes(api)
			}
		}},
		{"sandboxH", func() {
			if sandboxH != nil {
				sandboxH.RegisterRoutes(api)
			}
		}},
		{"loggingH", func() {
			if loggingH != nil {
				loggingH.RegisterRoutes(api)
			}
		}},
		{"crossoverH", func() {
			if crossoverH != nil {
				crossoverH.RegisterRoutes(api)
			}
		}},
		{"storageH", func() {
			if storageH != nil {
				storageH.RegisterRoutes(api)
			}
		}},
		{"clusterH", func() {
			if clusterH != nil {
				clusterH.RegisterRoutes(api)
			}
		}},
		{"aiInferenceH", func() {
			if aiInferenceH != nil {
				aiInferenceH.RegisterRoutes(api)
			}
		}},
		{"ai_llmH", func() {
			if ai_llmH != nil {
				ai_llmH.RegisterRoutes(api)
			}
		}},
		{"ai_aiagentH", func() {
			if ai_aiagentH != nil {
				ai_aiagentH.RegisterRoutes(api)
			}
		}},
		{"ai_aicostH", func() {
			if ai_aicostH != nil {
				ai_aicostH.RegisterRoutes(api)
			}
		}},
		{"ai_aisecurityH", func() {
			if ai_aisecurityH != nil {
				ai_aisecurityH.RegisterRoutes(api)
			}
		}},
		{"ai_orchestrationH", func() {
			if ai_orchestrationH != nil {
				ai_orchestrationH.RegisterRoutes(api)
			}
		}},
		{"ai_autorecoveryH", func() {
			if ai_autorecoveryH != nil {
				ai_autorecoveryH.RegisterRoutes(api)
			}
		}},
		{"ai_skillH", func() {
			if ai_skillH != nil {
				ai_skillH.RegisterRoutes(api)
			}
		}},
		{"ai_intelligenceH", func() {
			if ai_intelligenceH != nil {
				ai_intelligenceH.RegisterRoutes(api)
			}
		}},
		{"ai_llmtraceH", func() {
			if ai_llmtraceH != nil {
				ai_llmtraceH.RegisterRoutes(api)
			}
		}},
		{"networkH", func() {
			if networkH != nil {
				networkH.RegisterRoutes(api)
			}
		}},
		{"visorExecH", func() {
			if visorExecH != nil {
				visorExecH.RegisterRoutes(api)
			}
		}},
		{"applicationH", func() {
			if applicationH != nil {
				applicationH.RegisterRoutes(api)
			}
		}},
		{"aeH", func() {
			if aeH != nil {
				aeH.RegisterRoutes(api)
			}
		}},
		{"sagaH", func() {
			if sagaH != nil {
				sagaH.RegisterRoutes(api)
			}
		}},
		{"alertAdapterH", func() {
			if alertAdapterH != nil {
				alertAdapterH.RegisterRoutes(api)
			}
		}},
		{"alertCorrelationH", func() {
			if alertCorrelationH != nil {
				alertCorrelationH.RegisterRoutes(api)
			}
		}},
		{"alertDeduplicationH", func() {
			if alertDeduplicationH != nil {
				alertDeduplicationH.RegisterRoutes(api)
			}
		}},
		{"alertSilenceH", func() {
			if alertSilenceH != nil {
				alertSilenceH.RegisterRoutes(api)
			}
		}},
		{"alertPipelineH", func() {
			if alertPipelineH != nil {
				alertPipelineH.RegisterRoutes(api)
			}
		}},
		{"domainCqrsH", func() {
			if domainCqrsH != nil {
				domainCqrsH.RegisterRoutes(api)
			}
		}},
		{"dndH", func() {
			if dndH != nil {
				dndH.RegisterRoutes(api)
			}
		}},
		{"circuitBreakerH", func() {
			if circuitBreakerH != nil {
				circuitBreakerH.RegisterRoutes(api)
			}
		}},
		{"importExportH", func() {
			if importExportH != nil {
				importExportH.RegisterRoutes(api)
			}
		}},
		{"extensionPointH", func() {
			if extensionPointH != nil {
				extensionPointH.RegisterRoutes(api)
			}
		}},
		{"smartDeployH", func() {
			if smartDeployH != nil {
				smartDeployH.RegisterRoutes(api)
			}
		}},
		{"testSelectorH", func() {
			if testSelectorH != nil {
				testSelectorH.RegisterRoutes(api)
			}
		}},
		{"slaEngineH", func() {
			if slaEngineH != nil {
				slaEngineH.RegisterRoutes(api)
			}
		}},
		{"formH", func() {
			if formH != nil {
				formH.RegisterRoutes(api)
			}
		}},
		{"paramTypesH", func() {
			if paramTypesH != nil {
				paramTypesH.RegisterRoutes(api)
			}
		}},
		{"pandawikiH", func() {
			if pandawikiH != nil {
				pandawikiH.RegisterRoutes(api)
			}
		}},
		{"metadataH", func() {
			if metadataH != nil {
				metadataH.RegisterRoutes(api)
			}
		}},
		{"mlopsH", func() {
			if mlopsH != nil {
				mlopsH.RegisterRoutes(api)
			}
		}},
		{"testGenH", func() {
			if testGenH != nil {
				testGenH.RegisterRoutes(api)
			}
		}},
		{"inspectionH", func() {
			if inspectionH != nil {
				inspectionH.RegisterRoutes(api)
			}
		}},
		{"cmdbCollectorH", func() {
			if cmdbCollectorH != nil {
				cmdbCollectorH.RegisterRoutes(api)
			}
		}},
		{"cmdbDriftH", func() {
			if cmdbDriftH != nil {
				cmdbDriftH.RegisterRoutes(api)
			}
		}},
		{"apkUploadHistoryH", func() {
			if apkUploadHistoryH != nil {
				apkUploadHistoryH.RegisterRoutes(api)
			}
		}},
		{"artifactlifecycleH", func() {
			if artifactlifecycleH != nil {
				artifactlifecycleH.RegisterRoutes(api)
			}
		}},
		{"autoExecH", func() {
			if autoExecH != nil {
				autoExecH.RegisterRoutes(api)
			}
		}},
		{"autonomousPipelineH", func() {
			if autonomousPipelineH != nil {
				autonomousPipelineH.RegisterRoutes(api)
			}
		}},
		{"communityAdvancedH", func() {
			if communityAdvancedH != nil {
				communityAdvancedH.RegisterRoutes(api)
			}
		}},
		{"communityH", func() {
			if communityH != nil {
				communityH.RegisterRoutes(api)
			}
		}},
		{"conditionH", func() {
			if conditionH != nil {
				conditionH.RegisterRoutes(api)
			}
		}},
		{"configMgmtEnhancedH", func() {
			if configMgmtEnhancedH != nil {
				configMgmtEnhancedH.RegisterRoutes(api)
			}
		}},
		{"dataMaskingH", func() {
			if dataMaskingH != nil {
				dataMaskingH.RegisterRoutes(api)
			}
		}},
		{"digitalTwinSimulationH", func() {
			if digitalTwinSimulationH != nil {
				digitalTwinSimulationH.RegisterRoutes(api)
			}
		}},
		{"disasterrecoveryH", func() {
			if disasterrecoveryH != nil {
				disasterrecoveryH.RegisterRoutes(api)
			}
		}},
		{"eventTriggerRegistryH", func() {
			if eventTriggerRegistryH != nil {
				eventTriggerRegistryH.RegisterRoutes(api)
			}
		}},
		{"executionModeEngineH", func() {
			if executionModeEngineH != nil {
				executionModeEngineH.RegisterRoutes(api)
			}
		}},
		{"jobProcessorH", func() {
			if jobProcessorH != nil {
				jobProcessorH.RegisterRoutes(api)
			}
		}},
		{"mcpH", func() {
			if mcpH != nil {
				mcpH.RegisterRoutes(api)
			}
		}},
		{"moduleH", func() {
			if moduleH != nil {
				moduleH.RegisterRoutes(api)
			}
		}},
		{"observabilityH", func() {
			if observabilityH != nil {
				observabilityH.RegisterRoutes(api)
			}
		}},
		{"pipelineErrorDetailH", func() {
			if pipelineErrorDetailH != nil {
				pipelineErrorDetailH.RegisterRoutes(api)
			}
		}},
		{"releaseMgmtH", func() {
			if releaseMgmtH != nil {
				releaseMgmtH.RegisterRoutes(api)
			}
		}},
		{"startupH", func() {
			if startupH != nil {
				startupH.RegisterRoutes(api)
			}
		}},
		{"taskTimeoutH", func() {
			if taskTimeoutH != nil {
				taskTimeoutH.RegisterRoutes(api)
			}
		}},
		{"tenantGatewayH", func() {
			if tenantGatewayH != nil {
				tenantGatewayH.RegisterRoutes(api)
			}
		}},
		{"terminalAuditH", func() {
			if terminalAuditH != nil {
				terminalAuditH.RegisterRoutes(api)
			}
		}},
		{"testExecEngineH", func() {
			if testExecEngineH != nil {
				testExecEngineH.RegisterRoutes(api)
			}
		}},
		{"useractivityH", func() {
			if useractivityH != nil {
				useractivityH.RegisterRoutes(api)
			}
		}},
		{"userprofileH", func() {
			if userprofileH != nil {
				userprofileH.RegisterRoutes(api)
			}
		}},
		{"userstatusH", func() {
			if userstatusH != nil {
				userstatusH.RegisterRoutes(api)
			}
		}},
		{"usertokenH", func() {
			if usertokenH != nil {
				usertokenH.RegisterRoutes(api)
			}
		}},
		{"vectorH", func() {
			if vectorH != nil {
				vectorH.RegisterRoutes(api)
			}
		}},
		{"vulnerabilityH", func() {
			if vulnerabilityH != nil {
				vulnerabilityH.RegisterRoutes(api)
			}
		}},
		{"alertAdapterV2H", func() {
			if alertAdapterV2H != nil {
				alertAdapterV2H.RegisterRoutes(api)
			}
		}},
		{"capacityH", func() {
			if capacityH != nil {
				capacityH.RegisterRoutes(api)
			}
		}},
		{"middlewareOpsH", func() {
			if middlewareOpsH != nil {
				middlewareOpsH.RegisterRoutes(api)
			}
		}},
		{"cmdb_importH", func() {
			if cmdb_importH != nil {
				cmdb_importH.RegisterRoutes(api)
			}
		}},
		{"cmdb_relationshipH", func() {
			if cmdb_relationshipH != nil {
				cmdb_relationshipH.RegisterRoutes(api)
			}
		}},
		{"cmdb_validatorH", func() {
			if cmdb_validatorH != nil {
				cmdb_validatorH.RegisterRoutes(api)
			}
		}},
		{"governanceComplianceH", func() {
			if governanceComplianceH != nil {
				governanceComplianceH.RegisterRoutes(api.Group("/governance/compliance"))
			}
		}},
		{"identityConfirmationH", func() {
			if identityConfirmationH != nil {
				identityConfirmationH.RegisterRoutes(api)
			}
		}},
		{"infraCapH", func() {
			if infraCapH != nil {
				infraCapH.RegisterRoutes(api)
			}
		}},
		{"securityBranchPolicyH", func() {
			if securityBranchPolicyH != nil {
				securityBranchPolicyH.RegisterRoutes(api)
			}
		}},
		{"aiAgentRunH", func() {
			if aiAgentRunH != nil {
				aiAgentRunH.RegisterRoutes(api)
			}
		}},
		{"aiModelsH", func() {
			if aiModelsH != nil {
				aiModelsH.RegisterRoutes(api)
			}
		}},
		{"ciArtRegH", func() {
			if ciArtRegH != nil {
				ciArtRegH.RegisterRoutes(api)
			}
		}},
		{"ciArtVerH", func() {
			if ciArtVerH != nil {
				ciArtVerH.RegisterRoutes(api)
			}
		}},
		{"ciBuildH", func() {
			if ciBuildH != nil {
				ciBuildH.RegisterRoutes(api)
			}
		}},
		{"ciDeployH", func() {
			if ciDeployH != nil {
				ciDeployH.RegisterRoutes(api)
			}
		}},
		{"ciPTmplH", func() {
			if ciPTmplH != nil {
				ciPTmplH.RegisterRoutes(api)
			}
		}},
		{"ciRunnerH", func() {
			if ciRunnerH != nil {
				ciRunnerH.RegisterRoutes(api)
			}
		}},
		{"governanceH", func() {
			if governanceH != nil {
				governanceH.RegisterRoutes(api.Group("/governance"))
			}
		}},
		{"governancePolicyH", func() {
			if governancePolicyH != nil {
				governancePolicyH.RegisterRoutes(api.Group("/governance/policy"))
			}
		}},
		{"governanceRiskH", func() {
			if governanceRiskH != nil {
				governanceRiskH.RegisterRoutes(api)
			}
		}},
		{"graphH", func() {
			if graphH != nil {
				graphH.RegisterRoutes(api)
			}
		}},
		{"identitySsoH", func() {
			if identitySsoH != nil {
				identitySsoH.RegisterRoutes(api)
			}
		}},
		{"infraBackupH", func() {
			if infraBackupH != nil {
				infraBackupH.RegisterRoutes(api)
			}
		}},
		{"infraChaosH", func() {
			if infraChaosH != nil {
				infraChaosH.RegisterRoutes(api)
			}
		}},
		{"infraDegH", func() {
			if infraDegH != nil {
				infraDegH.RegisterRoutes(api)
			}
		}},
		{"infraDrH", func() {
			if infraDrH != nil {
				infraDrH.RegisterRoutes(api)
			}
		}},
		{"infraDTwinH", func() {
			if infraDTwinH != nil {
				infraDTwinH.RegisterRoutes(api)
			}
		}},
		{"infraEEH", func() {
			if infraEEH != nil {
				infraEEH.RegisterRoutes(api)
			}
		}},
		{"infraMultiH", func() {
			if infraMultiH != nil {
				infraMultiH.RegisterRoutes(api)
			}
		}},
		{"infraMWnH", func() {
			if infraMWnH != nil {
				infraMWnH.RegisterRoutes(api)
			}
		}},
		{"infraOCIH", func() {
			if infraOCIH != nil {
				infraOCIH.RegisterRoutes(api)
			}
		}},
		{"jobsourceH", func() {
			if jobsourceH != nil {
				jobsourceH.RegisterRoutes(api)
			}
		}},
		{"pipelineBudgetH", func() {
			if pipelineBudgetH != nil {
				pipelineBudgetH.RegisterRoutes(api)
			}
		}},
		{"pipelineExecutorH", func() {
			if pipelineExecutorH != nil {
				pipelineExecutorH.RegisterRoutes(api)
			}
		}},
		{"pipelineTemplatesH", func() {
			if pipelineTemplatesH != nil {
				pipelineTemplatesH.RegisterRoutes(api)
			}
		}},
		{"pipelineVersionsH", func() {
			if pipelineVersionsH != nil {
				pipelineVersionsH.RegisterRoutes(api)
			}
		}},
		{"pluginMarketplaceH", func() {
			if pluginMarketplaceH != nil {
				pluginMarketplaceH.RegisterRoutes(api)
			}
		}},
		{"resilienceScoreH", func() {
			if resilienceScoreH != nil {
				resilienceScoreH.RegisterRoutes(api)
			}
		}},
		{"runnerH", func() {
			if runnerH != nil {
				runnerH.RegisterRoutes(api)
			}
		}},
		{"sbomH", func() {
			if sbomH != nil {
				sbomH.RegisterRoutes(api)
			}
		}},
		{"securityH", func() {
			if securityH != nil {
				securityH.RegisterRoutes(api.Group("/security"))
			}
		}},
		{"securityPrivacyH", func() {
			if securityPrivacyH != nil {
				securityPrivacyH.RegisterRoutes(api)
			}
		}},
		{"securitySecretH", func() {
			if securitySecretH != nil {
				securitySecretH.RegisterRoutes(api.Group("/security"))
			}
		}},
		{"agentsH", func() {
			if agentsH != nil {
				agentsH.RegisterRoutes(api)
			}
		}},
		{"dbdevopsH", func() {
			if dbdevopsH != nil {
				dbdevopsH.RegisterRoutes(api)
			}
		}},
		{"gwRoutesH", func() {
			if gwRoutesH != nil {
				gwRoutesH.RegisterRoutes(api)
			}
		}},
		{"rateLimitH", func() {
			if rateLimitH != nil {
				rateLimitH.RegisterRoutes(api)
			}
		}},
		{"testReportsH", func() {
			if testReportsH != nil {
				testReportsH.RegisterRoutes(api)
			}
		}},
		{"middlewareH", func() {
			if middlewareH != nil {
				middlewareH.RegisterRoutes(api)
			}
		}},
		{"statisticsH", func() {
			if statisticsH != nil {
				statisticsH.RegisterRoutes(api)
			}
		}},
		{"roweditorH", func() {
			if roweditorH != nil {
				roweditorH.RegisterRoutes(api)
			}
		}},
		{"apiComponentH", func() {
			if apiComponentH != nil {
				apiComponentH.RegisterRoutes(api)
			}
		}},
		{"alertRuleEngineH", func() {
			if alertRuleEngineH != nil {
				alertRuleEngineH.RegisterRoutes(api)
			}
		}},
		// router.go also registers the inline route-discovery endpoint
		// api.GET("/routes") near the end of setupRouter. Mirror it here so
		// a handler claiming /api/v1/routes is caught, not just by the boot test.
		{"router-inline-routes", func() {
			api.GET("/routes", func(*gin.Context) {})
		}},
	}

	var conflicts int
	for _, entry := range reg {
		// Snapshot the routes present before this registration so that a
		// wildcard conflict can be traced back to the registration that
		// introduced the colliding prefix.
		before := map[string]bool{}
		for _, rt := range r.Routes() {
			before[rt.Method+" "+rt.Path] = true
		}
		func() {
			defer func() {
				if p := recover(); p != nil {
					conflicts++
					msg := fmt.Sprintf("%v", p)
					// Attribute every panic to the registration that already
					// owns the colliding route so the fix (delete this one, or
					// delete that one) is unambiguous.
					if q := regexp.MustCompile("path '([^']+)'").FindStringSubmatch(msg); q != nil {
						for _, rt := range r.Routes() {
							if rt.Path == q[1] {
								t.Errorf("%s: %v   [existing owner: %s %s -> %s]",
									entry.name, p, rt.Method, rt.Path, rt.Handler)
								break
							}
						}
					}
					if q := regexp.MustCompile("existing prefix '([^']+)'").FindStringSubmatch(msg); q != nil {
						pref := q[1]
						for _, rt := range r.Routes() {
							if rt.Path == pref || rt.Path == pref+"/" {
								t.Errorf("%s: %v   [existing owner: %s %s -> %s]",
									entry.name, p, rt.Method, rt.Path, rt.Handler)
								break
							}
						}
					}
					return
				}
				// Report any newly-registered path whose first segment after
				// /api/v1 is a wildcard: such a route swallows every sibling
				// route and is a latent 404 trap for the whole API.
				for _, rt := range r.Routes() {
					if before[rt.Method+" "+rt.Path] {
						continue
					}
					if rt.Path == "/api/v1/:id" || rt.Path == "/api/v1/:path" ||
						len(rt.Path) > 8 && rt.Path[:8] == "/api/v1/:" {
						t.Logf("ROOT WILDCARD %s %s introduced by %s", rt.Method, rt.Path, entry.name)
					}
				}
			}()
			entry.fn()
		}()
	}
	t.Logf("assembled %d routes; %d registration conflicts", len(r.Routes()), conflicts)
}
