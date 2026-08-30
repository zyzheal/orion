package main

import (
	"fmt"
	"os"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	cqrs_commands "orion/platform-svc-go/internal/application/commands"
	cqrs_http "orion/platform-svc-go/internal/application/http"
	ticket_handler "orion/platform-svc-go/internal/ticket/handler"
)

// TestDumpRoutesPerHandler registers every handler into its OWN engine so Gin
// reports the exact (method, path) set each handler owns. Registering handlers
// one at a time removes the masking that panics cause in the shared-engine scan
// (a panic aborts the rest of that handler's RegisterRoutes, hiding every
// conflict behind it).
//
// The entry list mirrors cmd/server/router.go by hand; keep it in sync
// whenever router.go changes (no generator script exists yet).
// Output: /tmp/perhandler.tsv (handler<TAB>routerLine<TAB>method<TAB>path<TAB>ginHandler)
func TestDumpRoutesPerHandler(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("REDIS_ADDR", "localhost:6379")
	t.Setenv("DB_USER", "postgres")
	t.Setenv("DB_PASSWORD", "postgres")
	gin.SetMode(gin.TestMode)

	initWiring(stubInfrastructure(zap.NewNop()), zap.NewNop())

	out, err := os.Create("/tmp/perhandler.tsv")
	if err != nil {
		t.Fatal(err)
	}
	defer out.Close()

	entries := buildDumpEntries()
	var mu sync.Mutex
	var wg sync.WaitGroup
	wg.Add(len(entries))
	for _, e := range entries {
		go func(e dumpEntry) {
			defer wg.Done()
			r := gin.New()
			func() {
				defer func() {
					if p := recover(); p != nil {
						mu.Lock()
						fmt.Fprintf(out, "%s\t%d\tPANIC\t\t%s\n", e.name, e.rline, p)
						mu.Unlock()
					}
				}()
				e.fn(r.Group("/api/v1"))
			}()
			mu.Lock()
			defer mu.Unlock()
			for _, rt := range r.Routes() {
				fmt.Fprintf(out, "%s\t%d\t%s\t%s\t%s\n", e.name, e.rline, rt.Method, rt.Path, rt.Handler)
			}
		}(e)
	}
	wg.Wait()

	// authH takes (public, protected) and is registered outside the loop above.
	if authH != nil {
		r := gin.New()
		authH.RegisterRoutes(r.Group("/auth"), r.Group("/api/v1").Group("/auth"))
		for _, rt := range r.Routes() {
			fmt.Fprintf(out, "authH\t118\t%s\t%s\t%s\n", rt.Method, rt.Path, rt.Handler)
		}
	}

	t.Logf("dumped per-handler route sets for %d handlers", len(entries))
}

type dumpEntry struct {
	name  string
	rline int
	fn    func(*gin.RouterGroup)
}

func buildDumpEntries() []dumpEntry {
	return []dumpEntry{
		{"abacH", 47, func(api *gin.RouterGroup) {
			if abacH != nil {
				abacH.RegisterRoutes(api)
			}
		}},
		{"alertEscH", 50, func(api *gin.RouterGroup) {
			if alertEscH != nil {
				alertEscH.RegisterRoutes(api)
			}
		}},
		{"dcH", 53, func(api *gin.RouterGroup) {
			if dcH != nil {
				dcH.RegisterRoutes(api)
			}
		}},
		{"lcH", 56, func(api *gin.RouterGroup) {
			if lcH != nil {
				lcH.RegisterRoutes(api)
			}
		}},
		{"tqH", 59, func(api *gin.RouterGroup) {
			if tqH != nil {
				tqH.RegisterRoutes(api)
			}
		}},
		{"agH", 62, func(api *gin.RouterGroup) {
			if agH != nil {
				agH.RegisterRoutes(api)
			}
		}},
		{"aiAgentsH", 65, func(api *gin.RouterGroup) {
			if aiAgentsH != nil {
				aiAgentsH.RegisterRoutes(api)
			}
		}},
		{"aiCostH", 68, func(api *gin.RouterGroup) {
			if aiCostH != nil {
				aiCostH.RegisterRoutes(api)
			}
		}},
		{"aiDecisionsH", 71, func(api *gin.RouterGroup) {
			if aiDecisionsH != nil {
				aiDecisionsH.RegisterRoutes(api)
			}
		}},
		{"aiGatewayH", 74, func(api *gin.RouterGroup) {
			if aiGatewayH != nil {
				aiGatewayH.RegisterRoutes(api)
			}
		}},
		{"aiReviewH", 77, func(api *gin.RouterGroup) {
			if aiReviewH != nil {
				aiReviewH.RegisterRoutes(api)
			}
		}},
		{"alertH", 80, func(api *gin.RouterGroup) {
			if alertH != nil {
				alertH.RegisterRoutes(api)
			}
		}},
		{"alert_breakerH", 83, func(api *gin.RouterGroup) {
			if alert_breakerH != nil {
				alert_breakerH.RegisterRoutes(api)
			}
		}},
		{"amH", 86, func(api *gin.RouterGroup) {
			if amH != nil {
				amH.RegisterRoutes(api)
			}
		}},
		{"amfaH", 89, func(api *gin.RouterGroup) {
			if amfaH != nil {
				amfaH.RegisterRoutes(api)
			}
		}},
		{"apiConsumptionH", 92, func(api *gin.RouterGroup) {
			if apiConsumptionH != nil {
				apiConsumptionH.RegisterRoutes(api)
			}
		}},
		{"apikeyH", 95, func(api *gin.RouterGroup) {
			if apikeyH != nil {
				apikeyH.RegisterRoutes(api)
			}
		}},
		{"apmH", 98, func(api *gin.RouterGroup) {
			if apmH != nil {
				apmH.RegisterRoutes(api)
			}
		}},
		{"approvalH", 101, func(api *gin.RouterGroup) {
			if approvalH != nil {
				approvalH.RegisterRoutes(api)
			}
		}},
		{"artifactH", 104, func(api *gin.RouterGroup) {
			if artifactH != nil {
				artifactH.RegisterRoutes(api)
			}
		}},
		{"artifactVersionH", 107, func(api *gin.RouterGroup) {
			if artifactVersionH != nil {
				artifactVersionH.RegisterRoutes(api)
			}
		}},
		{"artifactopsH", 110, func(api *gin.RouterGroup) {
			if artifactopsH != nil {
				artifactopsH.RegisterRoutes(api)
			}
		}},
		{"auditH", 113, func(api *gin.RouterGroup) {
			if auditH != nil {
				auditH.RegisterRoutes(api)
			}
		}},
		// authH (118): skipped, non-standard args 'public, protected'
		{"cacheModH", 124, func(api *gin.RouterGroup) {
			if cacheModH != nil {
				cacheModH.RegisterRoutes(api)
			}
		}},
		// infra.cqrsHandler is not a package-global; build it the same way
		// setupRouter does (config.go) so the dump covers /commands/*.
		{"cqrsHandler", 139, func(api *gin.RouterGroup) {
			cqrs_http.NewHandler(cqrs_commands.NewCommandBus()).RegisterRoutes(api)
		}},
		{"cacheCleanupH", 127, func(api *gin.RouterGroup) {
			if cacheCleanupH != nil {
				cacheCleanupH.RegisterRoutes(api)
			}
		}},
		{"cacheMgmtH", 133, func(api *gin.RouterGroup) {
			if cacheMgmtH != nil {
				cacheMgmtH.RegisterRoutes(api.Group("/cache-mgmt"))
			}
		}},
		{"bi_dashboardH", 130, func(api *gin.RouterGroup) {
			if bi_dashboardH != nil {
				bi_dashboardH.RegisterRoutes(api)
			}
		}},
		{"billingH", 133, func(api *gin.RouterGroup) {
			if billingH != nil {
				billingH.RegisterRoutes(api)
			}
		}},
		{"buildH", 136, func(api *gin.RouterGroup) {
			if buildH != nil {
				buildH.RegisterRoutes(api)
			}
		}},
		{"build_envH", 139, func(api *gin.RouterGroup) {
			if build_envH != nil {
				build_envH.RegisterRoutes(api)
			}
		}},
		{"canary_analysisH", 142, func(api *gin.RouterGroup) {
			if canary_analysisH != nil {
				canary_analysisH.RegisterRoutes(api)
			}
		}},
		{"canary_trafficH", 145, func(api *gin.RouterGroup) {
			if canary_trafficH != nil {
				canary_trafficH.RegisterRoutes(api)
			}
		}},
		{"capabilityH", 148, func(api *gin.RouterGroup) {
			if capabilityH != nil {
				capabilityH.RegisterRoutes(api)
			}
		}},
		{"changeH", 151, func(api *gin.RouterGroup) {
			if changeH != nil {
				changeH.RegisterRoutes(api)
			}
		}},
		{"chaosEngineH", 154, func(api *gin.RouterGroup) {
			if chaosEngineH != nil {
				chaosEngineH.RegisterRoutes(api)
			}
		}},
		{"chatopsH", 157, func(api *gin.RouterGroup) {
			if chatopsH != nil {
				chatopsH.RegisterRoutes(api)
			}
		}},
		{"ciH", 160, func(api *gin.RouterGroup) {
			if ciH != nil {
				ciH.RegisterRoutes(api)
			}
		}},
		{"citH", 163, func(api *gin.RouterGroup) {
			if citH != nil {
				citH.RegisterRoutes(api)
			}
		}},
		{"channelH", 166, func(api *gin.RouterGroup) {
			if channelH != nil {
				channelH.RegisterRoutes(api)
			}
		}},
		{"cmdbH", 169, func(api *gin.RouterGroup) {
			if cmdbH != nil {
				cmdbH.RegisterRoutes(api)
			}
		}},
		{"code_repoH", 172, func(api *gin.RouterGroup) {
			if code_repoH != nil {
				code_repoH.RegisterRoutes(api)
			}
		}},
		{"configH", 177, func(api *gin.RouterGroup) {
			if configH != nil {
				configH.RegisterRoutes(api)
			}
		}},
		{"contractH", 180, func(api *gin.RouterGroup) {
			if contractH != nil {
				contractH.RegisterRoutes(api)
			}
		}},
		{"costallocH", 183, func(api *gin.RouterGroup) {
			if costallocH != nil {
				costallocH.RegisterRoutes(api)
			}
		}},
		{"crH", 186, func(api *gin.RouterGroup) {
			if crH != nil {
				crH.RegisterRoutes(api)
			}
		}},
		{"cronH", 189, func(api *gin.RouterGroup) {
			if cronH != nil {
				cronH.RegisterRoutes(api)
			}
		}},
		{"cross_domainH", 192, func(api *gin.RouterGroup) {
			if cross_domainH != nil {
				cross_domainH.RegisterRoutes(api)
			}
		}},
		{"dataLineageH", 195, func(api *gin.RouterGroup) {
			if dataLineageH != nil {
				dataLineageH.RegisterRoutes(api)
			}
		}},
		{"dataCatalogH", 198, func(api *gin.RouterGroup) {
			if dataCatalogH != nil {
				dataCatalogH.RegisterRoutes(api)
			}
		}},
		{"dataQualityH", 201, func(api *gin.RouterGroup) {
			if dataQualityH != nil {
				dataQualityH.RegisterRoutes(api)
			}
		}},
		{"dataPipelineH", 204, func(api *gin.RouterGroup) {
			if dataPipelineH != nil {
				dataPipelineH.RegisterRoutes(api)
			}
		}},
		{"dbaH", 207, func(api *gin.RouterGroup) {
			if dbaH != nil {
				dbaH.RegisterRoutes(api)
			}
		}},
		{"decision_explanationH", 210, func(api *gin.RouterGroup) {
			if decision_explanationH != nil {
				decision_explanationH.RegisterRoutes(api)
			}
		}},
		{"degradationH", 213, func(api *gin.RouterGroup) {
			if degradationH != nil {
				degradationH.RegisterRoutes(api)
			}
		}},
		{"dependency_coordinationH", 216, func(api *gin.RouterGroup) {
			if dependency_coordinationH != nil {
				dependency_coordinationH.RegisterRoutes(api)
			}
		}},
		{"deployH", 219, func(api *gin.RouterGroup) {
			if deployH != nil {
				deployH.RegisterRoutes(api)
			}
		}},
		{"deploy_enhancedH", 222, func(api *gin.RouterGroup) {
			if deploy_enhancedH != nil {
				deploy_enhancedH.RegisterRoutes(api)
			}
		}},
		{"deployment_triggerH", 225, func(api *gin.RouterGroup) {
			if deployment_triggerH != nil {
				deployment_triggerH.RegisterRoutes(api)
			}
		}},
		{"developerportalH", 232, func(api *gin.RouterGroup) {
			if developerportalH != nil {
				developerportalH.RegisterRoutes(api.Group("/developer-portal"))
			}
		}},
		{"diagnosticH", 235, func(api *gin.RouterGroup) {
			if diagnosticH != nil {
				diagnosticH.RegisterRoutes(api)
			}
		}},
		{"digital_twinH", 238, func(api *gin.RouterGroup) {
			if digital_twinH != nil {
				digital_twinH.RegisterRoutes(api)
			}
		}},
		{"dual_engineH", 241, func(api *gin.RouterGroup) {
			if dual_engineH != nil {
				dual_engineH.RegisterRoutes(api)
			}
		}},
		{"escalationH", 254, func(api *gin.RouterGroup) {
			if escalationH != nil {
				escalationH.RegisterRoutes(api)
			}
		}},
		{"efficiencyH", 244, func(api *gin.RouterGroup) {
			if efficiencyH != nil {
				efficiencyH.RegisterRoutes(api.Group("/efficiency"))
			}
		}},
		{"envH", 247, func(api *gin.RouterGroup) {
			if envH != nil {
				envH.RegisterRoutes(api)
			}
		}},
		{"env_lifecycleH", 250, func(api *gin.RouterGroup) {
			if env_lifecycleH != nil {
				env_lifecycleH.RegisterRoutes(api)
			}
		}},
		{"env_profileH", 253, func(api *gin.RouterGroup) {
			if env_profileH != nil {
				env_profileH.RegisterRoutes(api)
			}
		}},
		{"eventbusH", 256, func(api *gin.RouterGroup) {
			if eventbusH != nil {
				eventbusH.RegisterRoutes(api)
			}
		}},
		{"fedH", 259, func(api *gin.RouterGroup) {
			if fedH != nil {
				fedH.RegisterRoutes(api)
			}
		}},
		{"ffH", 262, func(api *gin.RouterGroup) {
			if ffH != nil {
				ffH.RegisterRoutes(api)
			}
		}},
		{"finopsH", 265, func(api *gin.RouterGroup) {
			if finopsH != nil {
				finopsH.RegisterRoutes(api)
			}
		}},
		{"finops_v2H", 268, func(api *gin.RouterGroup) {
			if finops_v2H != nil {
				finops_v2H.RegisterRoutes(api)
			}
		}},
		{"gatewaydynamicH", 271, func(api *gin.RouterGroup) {
			if gatewaydynamicH != nil {
				gatewaydynamicH.RegisterRoutes(api)
			}
		}},
		{"gdGrayH", 274, func(api *gin.RouterGroup) {
			if gdGrayH != nil {
				gdGrayH.RegisterRoutes(api)
			}
		}},
		{"global_paramH", 277, func(api *gin.RouterGroup) {
			if global_paramH != nil {
				global_paramH.RegisterRoutes(api)
			}
		}},
		{"handlerregistryH", 280, func(api *gin.RouterGroup) {
			if handlerregistryH != nil {
				handlerregistryH.RegisterRoutes(api)
			}
		}},
		{"hcH", 283, func(api *gin.RouterGroup) {
			if hcH != nil {
				hcH.RegisterRoutes(api)
			}
		}},
		{"hookH", 286, func(api *gin.RouterGroup) {
			if hookH != nil {
				hookH.RegisterRoutes(api)
			}
		}},
		{"i18nH", 289, func(api *gin.RouterGroup) {
			if i18nH != nil {
				i18nH.RegisterRoutes(api)
			}
		}},
		{"iacH", 292, func(api *gin.RouterGroup) {
			if iacH != nil {
				iacH.RegisterRoutes(api)
			}
		}},
		{"incH", 295, func(api *gin.RouterGroup) {
			if incH != nil {
				incH.RegisterRoutes(api)
			}
		}},
		{"incidentH", 298, func(api *gin.RouterGroup) {
			if incidentH != nil {
				incidentH.RegisterRoutes(api)
			}
		}},
		{"incident_actionH", 301, func(api *gin.RouterGroup) {
			if incident_actionH != nil {
				incident_actionH.RegisterRoutes(api)
			}
		}},
		{"infraH", 304, func(api *gin.RouterGroup) {
			if infraH != nil {
				infraH.RegisterRoutes(api)
			}
		}},
		{"integrationH", 307, func(api *gin.RouterGroup) {
			if integrationH != nil {
				integrationH.RegisterRoutes(api)
			}
		}},
		{"internallibraryH", 310, func(api *gin.RouterGroup) {
			if internallibraryH != nil {
				internallibraryH.RegisterRoutes(api)
			}
		}},
		{"assistantH", 313, func(api *gin.RouterGroup) {
			if assistantH != nil {
				assistantH.RegisterRoutes(api)
			}
		}},
		{"knowledgeH", 316, func(api *gin.RouterGroup) {
			if knowledgeH != nil {
				knowledgeH.RegisterRoutes(api)
			}
		}},
		{"lowcodeH", 319, func(api *gin.RouterGroup) {
			if lowcodeH != nil {
				lowcodeH.RegisterRoutes(api)
			}
		}},
		{"maintenance_windowH", 322, func(api *gin.RouterGroup) {
			if maintenance_windowH != nil {
				maintenance_windowH.RegisterRoutes(api)
			}
		}},
		{"message_queueH", 325, func(api *gin.RouterGroup) {
			if message_queueH != nil {
				message_queueH.RegisterRoutes(api)
			}
		}},
		{"metricsH", 328, func(api *gin.RouterGroup) {
			if metricsH != nil {
				metricsH.RegisterRoutes(api)
			}
		}},
		{"monitoringH", 331, func(api *gin.RouterGroup) {
			if monitoringH != nil {
				monitoringH.RegisterRoutes(api)
			}
		}},
		{"multi_modal_triggerH", 334, func(api *gin.RouterGroup) {
			if multi_modal_triggerH != nil {
				multi_modal_triggerH.RegisterRoutes(api)
			}
		}},
		{"multicloudH", 337, func(api *gin.RouterGroup) {
			if multicloudH != nil {
				multicloudH.RegisterRoutes(api)
			}
		}},
		{"notificationH", 340, func(api *gin.RouterGroup) {
			if notificationH != nil {
				notificationH.RegisterRoutes(api)
			}
		}},
		{"notification_mgmtH", 343, func(api *gin.RouterGroup) {
			if notification_mgmtH != nil {
				notification_mgmtH.RegisterRoutes(api)
			}
		}},
		{"notification_policyH", 346, func(api *gin.RouterGroup) {
			if notification_policyH != nil {
				notification_policyH.RegisterRoutes(api)
			}
		}},
		{"notification_templateH", 349, func(api *gin.RouterGroup) {
			if notification_templateH != nil {
				notification_templateH.RegisterRoutes(api)
			}
		}},
		{"oci_registryH", 352, func(api *gin.RouterGroup) {
			if oci_registryH != nil {
				oci_registryH.RegisterRoutes(api)
			}
		}},
		{"oncallH", 355, func(api *gin.RouterGroup) {
			if oncallH != nil {
				oncallH.RegisterRoutes(api)
			}
		}},
		{"pageregistryH", 361, func(api *gin.RouterGroup) {
			if pageregistryH != nil {
				pageregistryH.RegisterRoutes(api.Group("/page-registry"))
			}
		}},
		{"palH", 364, func(api *gin.RouterGroup) {
			if palH != nil {
				palH.RegisterRoutes(api)
			}
		}},
		{"pauditH", 367, func(api *gin.RouterGroup) {
			if pauditH != nil {
				pauditH.RegisterRoutes(api)
			}
		}},
		{"pbH", 370, func(api *gin.RouterGroup) {
			if pbH != nil {
				pbH.RegisterRoutes(api)
			}
		}},
		{"pboH", 373, func(api *gin.RouterGroup) {
			if pboH != nil {
				pboH.RegisterRoutes(api)
			}
		}},
		{"pecH", 376, func(api *gin.RouterGroup) {
			if pecH != nil {
				pecH.RegisterRoutes(api)
			}
		}},
		{"perfH", 379, func(api *gin.RouterGroup) {
			if perfH != nil {
				perfH.RegisterRoutes(api)
			}
		}},
		{"permH", 382, func(api *gin.RouterGroup) {
			if permH != nil {
				permH.RegisterRoutes(api)
			}
		}},
		{"pgraphH", 385, func(api *gin.RouterGroup) {
			if pgraphH != nil {
				pgraphH.RegisterRoutes(api)
			}
		}},
		{"phistH", 388, func(api *gin.RouterGroup) {
			if phistH != nil {
				phistH.RegisterRoutes(api)
			}
		}},
		{"peH", 391, func(api *gin.RouterGroup) {
			if peH != nil {
				peH.RegisterRoutes(api)
			}
		}},
		{"pipelineH", 394, func(api *gin.RouterGroup) {
			if pipelineH != nil {
				pipelineH.RegisterRoutes(api)
			}
		}},
		{"pluginH", 397, func(api *gin.RouterGroup) {
			if pluginH != nil {
				pluginH.RegisterRoutes(api)
			}
		}},
		{"plugin_hotreloadH", 400, func(api *gin.RouterGroup) {
			if plugin_hotreloadH != nil {
				plugin_hotreloadH.RegisterRoutes(api)
			}
		}},
		{"policyH", 403, func(api *gin.RouterGroup) {
			if policyH != nil {
				policyH.RegisterRoutes(api)
			}
		}},
		{"problemH", 406, func(api *gin.RouterGroup) {
			if problemH != nil {
				problemH.RegisterRoutes(api)
			}
		}},
		{"process_stepH", 409, func(api *gin.RouterGroup) {
			if process_stepH != nil {
				process_stepH.RegisterRoutes(api)
			}
		}},
		{"productlineH", 412, func(api *gin.RouterGroup) {
			if productlineH != nil {
				productlineH.RegisterRoutes(api)
			}
		}},
		{"progessiveH", 415, func(api *gin.RouterGroup) {
			if progessiveH != nil {
				progessiveH.RegisterRoutes(api)
			}
		}},
		{"projH", 418, func(api *gin.RouterGroup) {
			if projH != nil {
				projH.RegisterRoutes(api)
			}
		}},
		{"projectmemberH", 421, func(api *gin.RouterGroup) {
			if projectmemberH != nil {
				projectmemberH.RegisterRoutes(api)
			}
		}},
		{"psseH", 424, func(api *gin.RouterGroup) {
			if psseH != nil {
				psseH.RegisterRoutes(api)
			}
		}},
		{"promptSecurityH", 427, func(api *gin.RouterGroup) {
			if promptSecurityH != nil {
				promptSecurityH.RegisterRoutes(api)
			}
		}},
		{"cacheMonitorH", 430, func(api *gin.RouterGroup) {
			if cacheMonitorH != nil {
				cacheMonitorH.RegisterRoutes(api)
			}
		}},
		{"codeEmbeddingH", 433, func(api *gin.RouterGroup) {
			if codeEmbeddingH != nil {
				codeEmbeddingH.RegisterRoutes(api)
			}
		}},
		{"dataClassificationH", 436, func(api *gin.RouterGroup) {
			if dataClassificationH != nil {
				dataClassificationH.RegisterRoutes(api)
			}
		}},
		{"fileHandlerH", 439, func(api *gin.RouterGroup) {
			if fileHandlerH != nil {
				fileHandlerH.RegisterRoutes(api)
			}
		}},
		{"jobActionsH", 442, func(api *gin.RouterGroup) {
			if jobActionsH != nil {
				jobActionsH.RegisterRoutes(api)
			}
		}},
		{"rcaH", 445, func(api *gin.RouterGroup) {
			if rcaH != nil {
				rcaH.RegisterRoutes(api)
			}
		}},
		{"ruleEngineH", 448, func(api *gin.RouterGroup) {
			if ruleEngineH != nil {
				ruleEngineH.RegisterRoutes(api)
			}
		}},
		{"semanticSearchH", 451, func(api *gin.RouterGroup) {
			if semanticSearchH != nil {
				semanticSearchH.RegisterRoutes(api)
			}
		}},
		{"taskExecutorH", 454, func(api *gin.RouterGroup) {
			if taskExecutorH != nil {
				taskExecutorH.RegisterRoutes(api)
			}
		}},
		{"toolH", 457, func(api *gin.RouterGroup) {
			if toolH != nil {
				toolH.RegisterRoutes(api)
			}
		}},
		{"ptmplH", 460, func(api *gin.RouterGroup) {
			if ptmplH != nil {
				ptmplH.RegisterRoutes(api)
			}
		}},
		{"ptrendH", 463, func(api *gin.RouterGroup) {
			if ptrendH != nil {
				ptrendH.RegisterRoutes(api)
			}
		}},
		{"pverH", 466, func(api *gin.RouterGroup) {
			if pverH != nil {
				pverH.RegisterRoutes(api)
			}
		}},
		{"queue_modH", 469, func(api *gin.RouterGroup) {
			if queue_modH != nil {
				queue_modH.RegisterRoutes(api)
			}
		}},
		{"rdH", 472, func(api *gin.RouterGroup) {
			if rdH != nil {
				rdH.RegisterRoutes(api)
			}
		}},
		{"riskH", 475, func(api *gin.RouterGroup) {
			if riskH != nil {
				riskH.RegisterRoutes(api)
			}
		}},
		{"roleH", 478, func(api *gin.RouterGroup) {
			if roleH != nil {
				roleH.RegisterRoutes(api)
			}
		}},
		{"runbookH", 481, func(api *gin.RouterGroup) {
			if runbookH != nil {
				runbookH.RegisterRoutes(api)
			}
		}},
		{"scheduled_notificationH", 484, func(api *gin.RouterGroup) {
			if scheduled_notificationH != nil {
				scheduled_notificationH.RegisterRoutes(api)
			}
		}},
		{"script_libraryH", 487, func(api *gin.RouterGroup) {
			if script_libraryH != nil {
				script_libraryH.RegisterRoutes(api)
			}
		}},
		{"script_modH", 490, func(api *gin.RouterGroup) {
			if script_modH != nil {
				script_modH.RegisterRoutes(api)
			}
		}},
		{"script_versionH", 493, func(api *gin.RouterGroup) {
			if script_versionH != nil {
				script_versionH.RegisterRoutes(api)
			}
		}},
		{"secretH", 496, func(api *gin.RouterGroup) {
			if secretH != nil {
				secretH.RegisterRoutes(api)
			}
		}},
		{"security_complianceH", 499, func(api *gin.RouterGroup) {
			if security_complianceH != nil {
				security_complianceH.RegisterRoutes(api)
			}
		}},
		{"code_scanH", 502, func(api *gin.RouterGroup) {
			if code_scanH != nil {
				code_scanH.RegisterRoutes(api.Group("/security"))
			}
		}},
		{"self_serviceH", 505, func(api *gin.RouterGroup) {
			if self_serviceH != nil {
				self_serviceH.RegisterRoutes(api)
			}
		}},
		{"selfhealingH", 508, func(api *gin.RouterGroup) {
			if selfhealingH != nil {
				selfhealingH.RegisterRoutes(api)
			}
		}},
		{"serverlessH", 511, func(api *gin.RouterGroup) {
			if serverlessH != nil {
				serverlessH.RegisterRoutes(api)
			}
		}},
		{"service_catalogH", 514, func(api *gin.RouterGroup) {
			if service_catalogH != nil {
				service_catalogH.RegisterRoutes(api)
			}
		}},
		{"service_healthH", 517, func(api *gin.RouterGroup) {
			if service_healthH != nil {
				service_healthH.RegisterRoutes(api)
			}
		}},
		{"service_topologyH", 520, func(api *gin.RouterGroup) {
			if service_topologyH != nil {
				service_topologyH.RegisterRoutes(api)
			}
		}},
		{"serviceregistryH", 523, func(api *gin.RouterGroup) {
			if serviceregistryH != nil {
				serviceregistryH.RegisterRoutes(api)
			}
		}},
		{"sessionH", 526, func(api *gin.RouterGroup) {
			if sessionH != nil {
				sessionH.RegisterRoutes(api)
			}
		}},
		{"slaH", 529, func(api *gin.RouterGroup) {
			if slaH != nil {
				slaH.RegisterRoutes(api)
			}
		}},
		{"sloH", 534, func(api *gin.RouterGroup) {
			if sloH != nil {
				sloH.RegisterRoutes(api.Group("/slo"))
			}
		}},
		{"sprintH", 537, func(api *gin.RouterGroup) {
			if sprintH != nil {
				sprintH.RegisterRoutes(api)
			}
		}},
		{"ssopH", 540, func(api *gin.RouterGroup) {
			if ssopH != nil {
				ssopH.RegisterRoutes(api)
			}
		}},
		{"ssouH", 543, func(api *gin.RouterGroup) {
			if ssouH != nil {
				ssouH.RegisterRoutes(api)
			}
		}},
		{"subappH", 546, func(api *gin.RouterGroup) {
			if subappH != nil {
				subappH.RegisterRoutes(api)
			}
		}},
		{"supply_chainH", 549, func(api *gin.RouterGroup) {
			if supply_chainH != nil {
				supply_chainH.RegisterRoutes(api)
			}
		}},
		{"teamH", 554, func(api *gin.RouterGroup) {
			if teamH != nil {
				teamH.RegisterRoutes(api.Group("/teams"))
			}
		}},
		{"tenantH", 557, func(api *gin.RouterGroup) {
			if tenantH != nil {
				tenantH.RegisterRoutes(api)
			}
		}},
		{"ticket_automationH", 560, func(api *gin.RouterGroup) {
			if ticket_automationH != nil {
				ticket_automationH.RegisterRoutes(api)
			}
		}},
		{"ticket_knowledgeH", 563, func(api *gin.RouterGroup) {
			if ticket_knowledgeH != nil {
				ticket_knowledgeH.RegisterRoutes(api)
			}
		}},
		{"ticketingH", 566, func(api *gin.RouterGroup) {
			if ticketingH != nil {
				ticketingH.RegisterRoutes(api)
			}
		}},
		{"ticket-domain", 585, func(api *gin.RouterGroup) {
			ticket_handler.RegisterTicketDomainRoutes(api, ticketH, slaModH, dispatchH, queueH, loadBalancerH, transferH)
		}},
		{"topologyH", 569, func(api *gin.RouterGroup) {
			if topologyH != nil {
				topologyH.RegisterRoutes(api)
			}
		}},
		{"tracingH", 572, func(api *gin.RouterGroup) {
			if tracingH != nil {
				tracingH.RegisterRoutes(api)
			}
		}},
		{"triggerH", 575, func(api *gin.RouterGroup) {
			if triggerH != nil {
				triggerH.RegisterRoutes(api)
			}
		}},
		{"uebaH", 578, func(api *gin.RouterGroup) {
			if uebaH != nil {
				uebaH.RegisterRoutes(api)
			}
		}},
		{"unified_configH", 581, func(api *gin.RouterGroup) {
			if unified_configH != nil {
				unified_configH.RegisterRoutes(api)
			}
		}},
		{"userH", 584, func(api *gin.RouterGroup) {
			if userH != nil {
				userH.RegisterRoutes(api)
			}
		}},
		{"vector_storeH", 587, func(api *gin.RouterGroup) {
			if vector_storeH != nil {
				vector_storeH.RegisterRoutes(api)
			}
		}},
		{"vectorize_rulesH", 590, func(api *gin.RouterGroup) {
			if vectorize_rulesH != nil {
				vectorize_rulesH.RegisterRoutes(api)
			}
		}},
		{"version_archiveH", 593, func(api *gin.RouterGroup) {
			if version_archiveH != nil {
				version_archiveH.RegisterRoutes(api)
			}
		}},
		{"visorH", 596, func(api *gin.RouterGroup) {
			if visorH != nil {
				visorH.RegisterRoutes(api)
			}
		}},
		{"webhookH", 599, func(api *gin.RouterGroup) {
			if webhookH != nil {
				webhookH.RegisterRoutes(api)
			}
		}},
		{"workbenchH", 602, func(api *gin.RouterGroup) {
			if workbenchH != nil {
				workbenchH.RegisterRoutes(api)
			}
		}},
		{"workflowH", 605, func(api *gin.RouterGroup) {
			if workflowH != nil {
				workflowH.RegisterRoutes(api)
			}
		}},
		{"workflowExtraH", 606, func(api *gin.RouterGroup) {
			if workflowExtraH != nil {
				workflowExtraH.RegisterRoutes(api)
			}
		}},
		{"workflow_depH", 609, func(api *gin.RouterGroup) {
			if workflow_depH != nil {
				workflow_depH.RegisterRoutes(api)
			}
		}},
		{"workflow_taskH", 612, func(api *gin.RouterGroup) {
			if workflow_taskH != nil {
				workflow_taskH.RegisterRoutes(api)
			}
		}},
		{"workflow_triggerH", 615, func(api *gin.RouterGroup) {
			if workflow_triggerH != nil {
				workflow_triggerH.RegisterRoutes(api)
			}
		}},
		{"workflow_webhookH", 618, func(api *gin.RouterGroup) {
			if workflow_webhookH != nil {
				workflow_webhookH.RegisterRoutes(api)
			}
		}},
		{"sandboxH", 621, func(api *gin.RouterGroup) {
			if sandboxH != nil {
				sandboxH.RegisterRoutes(api)
			}
		}},
		{"loggingH", 624, func(api *gin.RouterGroup) {
			if loggingH != nil {
				loggingH.RegisterRoutes(api)
			}
		}},
		{"crossoverH", 627, func(api *gin.RouterGroup) {
			if crossoverH != nil {
				crossoverH.RegisterRoutes(api)
			}
		}},
		{"storageH", 630, func(api *gin.RouterGroup) {
			if storageH != nil {
				storageH.RegisterRoutes(api)
			}
		}},
		{"clusterH", 633, func(api *gin.RouterGroup) {
			if clusterH != nil {
				clusterH.RegisterRoutes(api)
			}
		}},
		{"aiInferenceH", 636, func(api *gin.RouterGroup) {
			if aiInferenceH != nil {
				aiInferenceH.RegisterRoutes(api)
			}
		}},
		{"ai_llmH", 640, func(api *gin.RouterGroup) {
			if ai_llmH != nil {
				ai_llmH.RegisterRoutes(api)
			}
		}},
		{"ai_aiagentH", 643, func(api *gin.RouterGroup) {
			if ai_aiagentH != nil {
				ai_aiagentH.RegisterRoutes(api)
			}
		}},
		{"ai_aicostH", 646, func(api *gin.RouterGroup) {
			if ai_aicostH != nil {
				ai_aicostH.RegisterRoutes(api)
			}
		}},
		{"ai_aisecurityH", 655, func(api *gin.RouterGroup) {
			if ai_aisecurityH != nil {
				ai_aisecurityH.RegisterRoutes(api)
			}
		}},
		{"ai_orchestrationH", 658, func(api *gin.RouterGroup) {
			if ai_orchestrationH != nil {
				ai_orchestrationH.RegisterRoutes(api)
			}
		}},
		{"ai_autorecoveryH", 661, func(api *gin.RouterGroup) {
			if ai_autorecoveryH != nil {
				ai_autorecoveryH.RegisterRoutes(api)
			}
		}},
		{"ai_skillH", 664, func(api *gin.RouterGroup) {
			if ai_skillH != nil {
				ai_skillH.RegisterRoutes(api)
			}
		}},
		{"ai_knowledgeH", 711, func(api *gin.RouterGroup) {
			if ai_knowledgeH != nil {
				ai_knowledgeH.RegisterRoutes(api)
			}
		}},
		{"ai_intelligenceH", 667, func(api *gin.RouterGroup) {
			if ai_intelligenceH != nil {
				ai_intelligenceH.RegisterRoutes(api)
			}
		}},
		{"ai_llmtraceH", 670, func(api *gin.RouterGroup) {
			if ai_llmtraceH != nil {
				ai_llmtraceH.RegisterRoutes(api)
			}
		}},
		{"networkH", 673, func(api *gin.RouterGroup) {
			if networkH != nil {
				networkH.RegisterRoutes(api)
			}
		}},
		{"visorExecH", 676, func(api *gin.RouterGroup) {
			if visorExecH != nil {
				visorExecH.RegisterRoutes(api)
			}
		}},
		{"applicationH", 679, func(api *gin.RouterGroup) {
			if applicationH != nil {
				applicationH.RegisterRoutes(api)
			}
		}},
		{"aeH", 682, func(api *gin.RouterGroup) {
			if aeH != nil {
				aeH.RegisterRoutes(api)
			}
		}},
		{"sagaH", 685, func(api *gin.RouterGroup) {
			if sagaH != nil {
				sagaH.RegisterRoutes(api)
			}
		}},
		{"alertAdapterH", 688, func(api *gin.RouterGroup) {
			if alertAdapterH != nil {
				alertAdapterH.RegisterRoutes(api)
			}
		}},
		{"alertCorrelationH", 691, func(api *gin.RouterGroup) {
			if alertCorrelationH != nil {
				alertCorrelationH.RegisterRoutes(api)
			}
		}},
		{"alertDeduplicationH", 694, func(api *gin.RouterGroup) {
			if alertDeduplicationH != nil {
				alertDeduplicationH.RegisterRoutes(api)
			}
		}},
		{"alertSilenceH", 697, func(api *gin.RouterGroup) {
			if alertSilenceH != nil {
				alertSilenceH.RegisterRoutes(api)
			}
		}},
		{"alertPipelineH", 700, func(api *gin.RouterGroup) {
			if alertPipelineH != nil {
				alertPipelineH.RegisterRoutes(api)
			}
		}},
		{"domainCqrsH", 703, func(api *gin.RouterGroup) {
			if domainCqrsH != nil {
				domainCqrsH.RegisterRoutes(api)
			}
		}},
		{"dndH", 716, func(api *gin.RouterGroup) {
			if dndH != nil {
				dndH.RegisterRoutes(api)
			}
		}},
		{"circuitBreakerH", 719, func(api *gin.RouterGroup) {
			if circuitBreakerH != nil {
				circuitBreakerH.RegisterRoutes(api)
			}
		}},
		{"importExportH", 722, func(api *gin.RouterGroup) {
			if importExportH != nil {
				importExportH.RegisterRoutes(api)
			}
		}},
		{"extensionPointH", 725, func(api *gin.RouterGroup) {
			if extensionPointH != nil {
				extensionPointH.RegisterRoutes(api)
			}
		}},
		{"smartDeployH", 728, func(api *gin.RouterGroup) {
			if smartDeployH != nil {
				smartDeployH.RegisterRoutes(api)
			}
		}},
		{"testSelectorH", 731, func(api *gin.RouterGroup) {
			if testSelectorH != nil {
				testSelectorH.RegisterRoutes(api)
			}
		}},
		{"slaEngineH", 734, func(api *gin.RouterGroup) {
			if slaEngineH != nil {
				slaEngineH.RegisterRoutes(api)
			}
		}},
		{"formH", 737, func(api *gin.RouterGroup) {
			if formH != nil {
				formH.RegisterRoutes(api)
			}
		}},
		{"paramTypesH", 740, func(api *gin.RouterGroup) {
			if paramTypesH != nil {
				paramTypesH.RegisterRoutes(api)
			}
		}},
		{"pandawikiH", 743, func(api *gin.RouterGroup) {
			if pandawikiH != nil {
				pandawikiH.RegisterRoutes(api)
			}
		}},
		{"metadataH", 746, func(api *gin.RouterGroup) {
			if metadataH != nil {
				metadataH.RegisterRoutes(api)
			}
		}},
		{"mlopsH", 749, func(api *gin.RouterGroup) {
			if mlopsH != nil {
				mlopsH.RegisterRoutes(api)
			}
		}},
		{"testGenH", 752, func(api *gin.RouterGroup) {
			if testGenH != nil {
				testGenH.RegisterRoutes(api)
			}
		}},
		{"inspectionH", 755, func(api *gin.RouterGroup) {
			if inspectionH != nil {
				inspectionH.RegisterRoutes(api)
			}
		}},
		{"cmdbCollectorH", 758, func(api *gin.RouterGroup) {
			if cmdbCollectorH != nil {
				cmdbCollectorH.RegisterRoutes(api)
			}
		}},
		{"cmdbDriftH", 761, func(api *gin.RouterGroup) {
			if cmdbDriftH != nil {
				cmdbDriftH.RegisterRoutes(api)
			}
		}},
		{"apkUploadHistoryH", 764, func(api *gin.RouterGroup) {
			if apkUploadHistoryH != nil {
				apkUploadHistoryH.RegisterRoutes(api)
			}
		}},
		{"artifactlifecycleH", 767, func(api *gin.RouterGroup) {
			if artifactlifecycleH != nil {
				artifactlifecycleH.RegisterRoutes(api)
			}
		}},
		{"autoExecH", 770, func(api *gin.RouterGroup) {
			if autoExecH != nil {
				autoExecH.RegisterRoutes(api)
			}
		}},
		{"autonomousPipelineH", 773, func(api *gin.RouterGroup) {
			if autonomousPipelineH != nil {
				autonomousPipelineH.RegisterRoutes(api)
			}
		}},
		{"communityAdvancedH", 776, func(api *gin.RouterGroup) {
			if communityAdvancedH != nil {
				communityAdvancedH.RegisterRoutes(api)
			}
		}},
		{"communityH", 779, func(api *gin.RouterGroup) {
			if communityH != nil {
				communityH.RegisterRoutes(api)
			}
		}},
		{"conditionH", 782, func(api *gin.RouterGroup) {
			if conditionH != nil {
				conditionH.RegisterRoutes(api)
			}
		}},
		{"configMgmtEnhancedH", 785, func(api *gin.RouterGroup) {
			if configMgmtEnhancedH != nil {
				configMgmtEnhancedH.RegisterRoutes(api)
			}
		}},
		{"dataMaskingH", 788, func(api *gin.RouterGroup) {
			if dataMaskingH != nil {
				dataMaskingH.RegisterRoutes(api)
			}
		}},
		{"digitalTwinSimulationH", 791, func(api *gin.RouterGroup) {
			if digitalTwinSimulationH != nil {
				digitalTwinSimulationH.RegisterRoutes(api)
			}
		}},
		{"disasterrecoveryH", 794, func(api *gin.RouterGroup) {
			if disasterrecoveryH != nil {
				disasterrecoveryH.RegisterRoutes(api)
			}
		}},
		{"eventTriggerRegistryH", 797, func(api *gin.RouterGroup) {
			if eventTriggerRegistryH != nil {
				eventTriggerRegistryH.RegisterRoutes(api)
			}
		}},
		{"executionModeEngineH", 800, func(api *gin.RouterGroup) {
			if executionModeEngineH != nil {
				executionModeEngineH.RegisterRoutes(api)
			}
		}},
		{"jobProcessorH", 803, func(api *gin.RouterGroup) {
			if jobProcessorH != nil {
				jobProcessorH.RegisterRoutes(api)
			}
		}},
		{"mcpH", 806, func(api *gin.RouterGroup) {
			if mcpH != nil {
				mcpH.RegisterRoutes(api)
			}
		}},
		{"moduleH", 809, func(api *gin.RouterGroup) {
			if moduleH != nil {
				moduleH.RegisterRoutes(api)
			}
		}},
		{"observabilityH", 812, func(api *gin.RouterGroup) {
			if observabilityH != nil {
				observabilityH.RegisterRoutes(api)
			}
		}},
		{"pipelineErrorDetailH", 818, func(api *gin.RouterGroup) {
			if pipelineErrorDetailH != nil {
				pipelineErrorDetailH.RegisterRoutes(api)
			}
		}},
		{"releaseMgmtH", 821, func(api *gin.RouterGroup) {
			if releaseMgmtH != nil {
				releaseMgmtH.RegisterRoutes(api)
			}
		}},
		{"startupH", 824, func(api *gin.RouterGroup) {
			if startupH != nil {
				startupH.RegisterRoutes(api)
			}
		}},
		{"taskTimeoutH", 827, func(api *gin.RouterGroup) {
			if taskTimeoutH != nil {
				taskTimeoutH.RegisterRoutes(api)
			}
		}},
		{"tenantGatewayH", 830, func(api *gin.RouterGroup) {
			if tenantGatewayH != nil {
				tenantGatewayH.RegisterRoutes(api)
			}
		}},
		{"terminalAuditH", 833, func(api *gin.RouterGroup) {
			if terminalAuditH != nil {
				terminalAuditH.RegisterRoutes(api)
			}
		}},
		{"testExecEngineH", 836, func(api *gin.RouterGroup) {
			if testExecEngineH != nil {
				testExecEngineH.RegisterRoutes(api)
			}
		}},
		{"useractivityH", 839, func(api *gin.RouterGroup) {
			if useractivityH != nil {
				useractivityH.RegisterRoutes(api)
			}
		}},
		{"userprofileH", 842, func(api *gin.RouterGroup) {
			if userprofileH != nil {
				userprofileH.RegisterRoutes(api)
			}
		}},
		{"userstatusH", 845, func(api *gin.RouterGroup) {
			if userstatusH != nil {
				userstatusH.RegisterRoutes(api)
			}
		}},
		{"usertokenH", 848, func(api *gin.RouterGroup) {
			if usertokenH != nil {
				usertokenH.RegisterRoutes(api)
			}
		}},
		{"vectorH", 851, func(api *gin.RouterGroup) {
			if vectorH != nil {
				vectorH.RegisterRoutes(api)
			}
		}},
		{"vulnerabilityH", 854, func(api *gin.RouterGroup) {
			if vulnerabilityH != nil {
				vulnerabilityH.RegisterRoutes(api)
			}
		}},
		{"alertAdapterV2H", 857, func(api *gin.RouterGroup) {
			if alertAdapterV2H != nil {
				alertAdapterV2H.RegisterRoutes(api)
			}
		}},
		{"capacityH", 863, func(api *gin.RouterGroup) {
			if capacityH != nil {
				capacityH.RegisterRoutes(api)
			}
		}},
		{"middlewareOpsH", 866, func(api *gin.RouterGroup) {
			if middlewareOpsH != nil {
				middlewareOpsH.RegisterRoutes(api)
			}
		}},

		{"cmdb_importH", 880, func(api *gin.RouterGroup) {
			if cmdb_importH != nil {
				cmdb_importH.RegisterRoutes(api)
			}
		}},
		{"cmdb_relationshipH", 883, func(api *gin.RouterGroup) {
			if cmdb_relationshipH != nil {
				cmdb_relationshipH.RegisterRoutes(api)
			}
		}},
		{"cmdb_validatorH", 886, func(api *gin.RouterGroup) {
			if cmdb_validatorH != nil {
				cmdb_validatorH.RegisterRoutes(api)
			}
		}},
		{"governanceComplianceH", 889, func(api *gin.RouterGroup) {
			if governanceComplianceH != nil {
				governanceComplianceH.RegisterRoutes(api.Group("/governance/compliance"))
			}
		}},
		{"identityConfirmationH", 892, func(api *gin.RouterGroup) {
			if identityConfirmationH != nil {
				identityConfirmationH.RegisterRoutes(api)
			}
		}},
		{"infraCapH", 895, func(api *gin.RouterGroup) {
			if infraCapH != nil {
				infraCapH.RegisterRoutes(api)
			}
		}},
		{"securityBranchPolicyH", 904, func(api *gin.RouterGroup) {
			if securityBranchPolicyH != nil {
				securityBranchPolicyH.RegisterRoutes(api)
			}
		}},
		{"aiAgentRunH", 915, func(api *gin.RouterGroup) {
			if aiAgentRunH != nil {
				aiAgentRunH.RegisterRoutes(api)
			}
		}},
		{"aiModelsH", 918, func(api *gin.RouterGroup) {
			if aiModelsH != nil {
				aiModelsH.RegisterRoutes(api)
			}
		}},
		{"ciArtRegH", 921, func(api *gin.RouterGroup) {
			if ciArtRegH != nil {
				ciArtRegH.RegisterRoutes(api)
			}
		}},
		{"ciArtVerH", 924, func(api *gin.RouterGroup) {
			if ciArtVerH != nil {
				ciArtVerH.RegisterRoutes(api)
			}
		}},
		{"ciBuildH", 927, func(api *gin.RouterGroup) {
			if ciBuildH != nil {
				ciBuildH.RegisterRoutes(api)
			}
		}},
		{"ciDeployH", 930, func(api *gin.RouterGroup) {
			if ciDeployH != nil {
				ciDeployH.RegisterRoutes(api)
			}
		}},
		{"ciPTmplH", 933, func(api *gin.RouterGroup) {
			if ciPTmplH != nil {
				ciPTmplH.RegisterRoutes(api)
			}
		}},
		{"ciRunnerH", 936, func(api *gin.RouterGroup) {
			if ciRunnerH != nil {
				ciRunnerH.RegisterRoutes(api)
			}
		}},
		{"governanceH", 939, func(api *gin.RouterGroup) {
			if governanceH != nil {
				governanceH.RegisterRoutes(api.Group("/governance"))
			}
		}},
		{"governancePolicyH", 942, func(api *gin.RouterGroup) {
			if governancePolicyH != nil {
				governancePolicyH.RegisterRoutes(api.Group("/governance/policy"))
			}
		}},
		{"governanceRiskH", 945, func(api *gin.RouterGroup) {
			if governanceRiskH != nil {
				governanceRiskH.RegisterRoutes(api)
			}
		}},
		{"graphH", 948, func(api *gin.RouterGroup) {
			if graphH != nil {
				graphH.RegisterRoutes(api)
			}
		}},
		{"identitySsoH", 951, func(api *gin.RouterGroup) {
			if identitySsoH != nil {
				identitySsoH.RegisterRoutes(api)
			}
		}},
		{"infraBackupH", 954, func(api *gin.RouterGroup) {
			if infraBackupH != nil {
				infraBackupH.RegisterRoutes(api)
			}
		}},
		{"infraChaosH", 957, func(api *gin.RouterGroup) {
			if infraChaosH != nil {
				infraChaosH.RegisterRoutes(api)
			}
		}},
		{"infraDegH", 963, func(api *gin.RouterGroup) {
			if infraDegH != nil {
				infraDegH.RegisterRoutes(api)
			}
		}},
		{"infraDrH", 966, func(api *gin.RouterGroup) {
			if infraDrH != nil {
				infraDrH.RegisterRoutes(api)
			}
		}},
		{"infraDTwinH", 969, func(api *gin.RouterGroup) {
			if infraDTwinH != nil {
				infraDTwinH.RegisterRoutes(api)
			}
		}},
		{"infraEEH", 972, func(api *gin.RouterGroup) {
			if infraEEH != nil {
				infraEEH.RegisterRoutes(api)
			}
		}},
		{"infraMultiH", 978, func(api *gin.RouterGroup) {
			if infraMultiH != nil {
				infraMultiH.RegisterRoutes(api)
			}
		}},
		{"infraMWnH", 981, func(api *gin.RouterGroup) {
			if infraMWnH != nil {
				infraMWnH.RegisterRoutes(api)
			}
		}},
		{"infraOCIH", 984, func(api *gin.RouterGroup) {
			if infraOCIH != nil {
				infraOCIH.RegisterRoutes(api)
			}
		}},
		{"jobsourceH", 987, func(api *gin.RouterGroup) {
			if jobsourceH != nil {
				jobsourceH.RegisterRoutes(api)
			}
		}},
		{"pipelineBudgetH", 990, func(api *gin.RouterGroup) {
			if pipelineBudgetH != nil {
				pipelineBudgetH.RegisterRoutes(api)
			}
		}},
		{"pipelineExecutorH", 1017, func(api *gin.RouterGroup) {
			if pipelineExecutorH != nil {
				pipelineExecutorH.RegisterRoutes(api)
			}
		}},
		{"pipelineTemplatesH", 993, func(api *gin.RouterGroup) {
			if pipelineTemplatesH != nil {
				pipelineTemplatesH.RegisterRoutes(api)
			}
		}},
		{"pipelineVersionsH", 996, func(api *gin.RouterGroup) {
			if pipelineVersionsH != nil {
				pipelineVersionsH.RegisterRoutes(api)
			}
		}},
		{"pluginMarketplaceH", 999, func(api *gin.RouterGroup) {
			if pluginMarketplaceH != nil {
				pluginMarketplaceH.RegisterRoutes(api)
			}
		}},
		{"resilienceScoreH", 1002, func(api *gin.RouterGroup) {
			if resilienceScoreH != nil {
				resilienceScoreH.RegisterRoutes(api)
			}
		}},
		{"runnerH", 1005, func(api *gin.RouterGroup) {
			if runnerH != nil {
				runnerH.RegisterRoutes(api)
			}
		}},
		{"sbomH", 1008, func(api *gin.RouterGroup) {
			if sbomH != nil {
				sbomH.RegisterRoutes(api)
			}
		}},
		{"securityH", 1011, func(api *gin.RouterGroup) {
			if securityH != nil {
				securityH.RegisterRoutes(api.Group("/security"))
			}
		}},
		{"securityPrivacyH", 1014, func(api *gin.RouterGroup) {
			if securityPrivacyH != nil {
				securityPrivacyH.RegisterRoutes(api)
			}
		}},
		{"securitySecretH", 1017, func(api *gin.RouterGroup) {
			if securitySecretH != nil {
				securitySecretH.RegisterRoutes(api.Group("/security"))
			}
		}},

		{"agentsH", 1027, func(api *gin.RouterGroup) {
			if agentsH != nil {
				agentsH.RegisterRoutes(api)
			}
		}},
		{"dbdevopsH", 1030, func(api *gin.RouterGroup) {
			if dbdevopsH != nil {
				dbdevopsH.RegisterRoutes(api)
			}
		}},
		{"datasourceH", 1075, func(api *gin.RouterGroup) {
			if datasourceH != nil {
				datasourceH.RegisterRoutes(api)
			}
		}},
		{"skillH", 1084, func(api *gin.RouterGroup) {
			if skillH != nil {
				skillH.RegisterRoutes(api)
			}
		}},
		{"gwRoutesH", 1033, func(api *gin.RouterGroup) {
			if gwRoutesH != nil {
				gwRoutesH.RegisterRoutes(api)
			}
		}},
		{"rateLimitH", 1036, func(api *gin.RouterGroup) {
			if rateLimitH != nil {
				rateLimitH.RegisterRoutes(api)
			}
		}},
		{"testReportsH", 1039, func(api *gin.RouterGroup) {
			if testReportsH != nil {
				testReportsH.RegisterRoutes(api)
			}
		}},
		{"middlewareH", 1042, func(api *gin.RouterGroup) {
			if middlewareH != nil {
				middlewareH.RegisterRoutes(api)
			}
		}},
		{"statisticsH", 1045, func(api *gin.RouterGroup) {
			if statisticsH != nil {
				statisticsH.RegisterRoutes(api)
			}
		}},
		{"roweditorH", 1048, func(api *gin.RouterGroup) {
			if roweditorH != nil {
				roweditorH.RegisterRoutes(api)
			}
		}},
		{"apiComponentH", 1051, func(api *gin.RouterGroup) {
			if apiComponentH != nil {
				apiComponentH.RegisterRoutes(api)
			}
		}},
		{"alertRuleEngineH", 1054, func(api *gin.RouterGroup) {
			if alertRuleEngineH != nil {
				alertRuleEngineH.RegisterRoutes(api)
			}
		}},
	}
}
