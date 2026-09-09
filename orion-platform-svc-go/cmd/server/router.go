// Package server provides the command-line entry point for the platform service.
package main

import (
	"os"
	"strconv"
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
			// Phase H: wire the ZapAnonymousTracker so PERM-8 stage 2 migration
			// has real data — every anonymous hit on /api/v1 is logged at
			// Debug level with a per-second rate cap. Rate limit is tunable via
			// AUTH_OPTIONAL_ANON_LOG_RATE (default 100/s; 0 = unlimited).
			rate := 100
			if v := os.Getenv("AUTH_OPTIONAL_ANON_LOG_RATE"); v != "" {
				if n, err := strconv.Atoi(v); err == nil {
					rate = n
				}
			}
			api.Use(auth.OptionalAuth(auth.AuthConfig{
				JWTSecret:        infra.ffCfg.JWTSecret,
				RedisClient:      infra.rdb,
				AnonymousTracker: auth.NewZapAnonymousTracker(logger, rate),
			}))
		}

		type routeRegistrar interface {
			RegisterRoutes(group *gin.RouterGroup)
		}

		registerRoutes := func(api *gin.RouterGroup, handlers ...any) {
			for _, h := range handlers {
				if h == nil {
					continue
				}
				h.(routeRegistrar).RegisterRoutes(api)
			}
		}

		registerRoutes(api, abacH, alertEscH, dcH, lcH, tqH, agH,
			aiAgentsH, aiCostH, aiDecisionsH, aiGatewayH, aiReviewH, alertH,
			alert_breakerH, amH, amfaH, apiConsumptionH, apikeyH, apmH,
			approvalH, artifactH, artifactVersionH, artifactopsH, auditH, cacheModH,
			cacheCleanupH, bi_dashboardH, billingH, buildH, build_envH, canary_analysisH,
			canary_trafficH, capabilityH, changeH, chaosEngineH, chatopsH, ciH,
			citH, channelH, cmdbH, code_repoH, configH, contractH,
			costallocH, crH, cronH, cross_domainH, dataLineageH, dataCatalogH,
			dataQualityH, dataPipelineH, dbaH, decision_explanationH, degradationH, dependency_coordinationH,
			deployH, deploy_enhancedH, deployment_triggerH, diagnosticH, digital_twinH, dual_engineH,
			escalationH, envH, env_lifecycleH, env_profileH, eventbusH, fedH,
			ffH, finopsH, finops_v2H, gdGrayH, global_paramH, handlerregistryH,
			hcH, hookH, i18nH, iacH, incH, incidentH,
			incident_actionH, infraH, integrationH, internallibraryH, assistantH, knowledgeH,
			lowcodeH, maintenance_windowH, message_queueH, metricsH, monitoringH, multi_modal_triggerH,
			multicloudH, notificationH, notification_mgmtH, notification_policyH, notification_templateH, oci_registryH,
			oncallH, palH, pauditH, pbH, pboH, pecH,
			perfH, permH, pgraphH, phistH, peH, pipelineH,
			pluginH, plugin_hotreloadH, policyH, problemH, process_stepH, productlineH,
			progessiveH, projH, projectmemberH, psseH, promptSecurityH, cacheMonitorH,
			codeEmbeddingH, dataClassificationH, fileHandlerH, jobActionsH, rcaH, ruleEngineH,
			semanticSearchH, taskExecutorH, toolH, ptmplH, ptrendH, pverH,
			queue_modH, rdH, riskH, roleH, runbookH, scheduled_notificationH,
			script_libraryH, script_modH, script_versionH, secretH, security_complianceH, self_serviceH,
			selfhealingH, serverlessH, service_catalogH, service_healthH, service_topologyH, serviceregistryH,
			sessionH, slaH, sprintH, ssopH, ssouH, subappH,
			supply_chainH, tenantH, ticket_automationH, ticket_knowledgeH, ticketingH, topologyH,
			tracingH, triggerH, uebaH, unified_configH, userH, vector_storeH,
			vectorize_rulesH, version_archiveH, visorH, webhookH, workbenchH, workflowH,
			workflowExtraH, workflow_depH, workflow_taskH, workflow_triggerH, workflow_webhookH, sandboxH,
			loggingH, crossoverH, storageH, clusterH, aiInferenceH, ai_llmH,
			ai_aicostH, ai_aisecurityH, ai_orchestrationH, ai_autorecoveryH, ai_skillH, ai_knowledgeH,
			ai_intelligenceH, ai_llmtraceH, networkH, visorExecH, applicationH, aeH,
			sagaH, alertAdapterH, alertCorrelationH, alertDeduplicationH, alertSilenceH, alertPipelineH,
			domainCqrsH, dndH, circuitBreakerH, importExportH, extensionPointH, smartDeployH,
			testSelectorH, slaEngineH, formH, paramTypesH, pandawikiH, metadataH,
			mlopsH, testGenH, inspectionH, cmdbCollectorH, cmdbDriftH, apkUploadHistoryH,
			artifactlifecycleH, autoExecH, autonomousPipelineH, communityAdvancedH, communityH, conditionH,
			configMgmtEnhancedH, dataMaskingH, digitalTwinSimulationH, disasterrecoveryH, eventTriggerRegistryH, executionModeEngineH,
			jobProcessorH, mcpH, moduleH, observabilityH, pipelineErrorDetailH, releaseMgmtH,
			startupH, taskTimeoutH, tenantGatewayH, terminalAuditH, testExecEngineH, useractivityH,
			userprofileH, userstatusH, usertokenH, vectorH, vulnerabilityH, alertAdapterV2H,
			capacityH, middlewareOpsH, cmdb_importH, cmdb_relationshipH, cmdb_validatorH, identityConfirmationH,
			infraCapH, securityBranchPolicyH, aiAgentRunH, aiModelsH, ciArtRegH, ciArtVerH,
			ciBuildH, ciDeployH, ciPTmplH, ciRunnerH, governanceRiskH, graphH,
			identitySsoH, infraBackupH, infraArchiveH, infraArchiveSchedulerH, infraRetentionH, infraChaosH,
			migrationH, infraSchemaRegH, infraDegH, infraDrH, infraDTwinH, infraEEH,
			infraMultiH, infraMWnH, infraOCIH, jobsourceH, pipelineBudgetH, pipelineExecutorH,
			pipelineTemplatesH, pipelineVersionsH, pluginMarketplaceH, resilienceScoreH, runnerH, sbomH,
			securityPrivacyH, agentsH, dbdevopsH, datasourceH, skillH, gwRoutesH,
			rateLimitH, testReportsH, middlewareH, statisticsH, roweditorH, apiComponentH,
			alertRuleEngineH,
			// Phase 2 DBA extension handlers (approval/query/aireview/osc).
			// Each is nil when its wire function failed to initialise; the
			// registerRoutes loop above skips nil handlers.
			dbaApprovalH, dbaQueryH, dbaAirReviewH, dbaOscH, dbaSlowQueryH, dbaExplainH, dbaAdvisorH)

		if authH != nil {
			public := r.Group("/auth")
			protected := api.Group("/auth")
			authH.RegisterRoutes(public, protected)
		}
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
		// chaosH, chaos_enhancedH and chaosGatewayH are NOT registered: chaosEngineH
		// above is a merged facade that delegates to all three of their handlers under
		// the same /chaos paths, so mounting them again would register every
		// (method, path) pair twice and panic Gin.
		// compliance: merged into governance/compliance (P2-01)
		// governanceComplianceH registered below
		if developerportalH != nil {
			// Namespaced under /developer-portal: this handler registers bare
			// relative paths ("" and ":id"). At the API root those become
			// GET/POST /api/v1 and /api/v1/:id, and the depth-1 wildcard
			// swallows every sibling route in the API.
			developerportalH.RegisterRoutes(api.Group("/developer-portal"))
		}
		if efficiencyH != nil {
			// Namespaced under /efficiency: this handler declares its TS source paths
			// as /api/v1/efficiency/{path}, the frontend calls /efficiency/..., and
			// at the API root its bare /reports, /teams/:teamId and
			// /projects/:projectId collide with report-designerH, teamH and projH.
			efficiencyH.RegisterRoutes(api.Group("/efficiency"))
		}
		if gatewaydynamicH != nil {
			// Namespaced under /gateway: this handler registers rg.Group("/routes"),
			// whose unnamespaced form is GET /api/v1/routes and collides with the
			// route-discovery endpoint registered near the end of this function. Its
			// TS source path (and the frontend's /gateway/routes client) use the
			// /gateway prefix.
			gatewaydynamicH.RegisterRoutes(api.Group("/gateway"))
		}
		if pageregistryH != nil {
			// Namespaced under /page-registry: at the API root a depth-1
			// ":path" wildcard shadows every other first-segment route and
			// cannot coexist with any other root-level wildcard in Gin.
			pageregistryH.RegisterRoutes(api.Group("/page-registry"))
		}
		if code_scanH != nil {
			code_scanH.RegisterRoutes(api.Group("/security"))
		}
		if sloH != nil {
			// Namespaced: at the API root SLO would own GET/POST "" and /:id,
			// colliding with the root-level wildcard taken by page-registry.
			sloH.RegisterRoutes(api.Group("/slo"))
		}
		if teamH != nil {
			// Namespaced: at the API root teams would own GET/POST "" and
			// /:id, colliding with the root-level wildcard (see page-registry).
			teamH.RegisterRoutes(api.Group("/teams"))
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
		// workflowExtraH is wired independently of workflowH (see wiring.go), so it
		// needs its own nil guard — piggy-backing on workflowH != nil would nil-panic
		// whenever only one of the two is constructed.
		// ---- AI modules (internal/ai/) ----
		// ai_skillH owns /skills; ai_knowledgeH owns /knowledge/bases + /knowledge/search
		// (knowledgeH above uses /knowledge/spaces|docs|sync|eval, so no path is shared).
		// pipelineAuditLogH is NOT registered: identical route set to palH above
		// (and to ai_skillH's audit-log routes). Gin panics on a second registration.
		// pipelineRunHistoryH is NOT registered: identical route set to phistH above.

		// Web Vitals receiver — receives frontend Core Web Vitals (LCP/CLS/INP/FID/TTFB/FCP)
		// and exposes them as Prometheus metrics. Public endpoint, no auth required.
		api.POST("/performance/vitals", observability.WebVitalsHandler)
		// autoRecoveryH is NOT registered: identical route set to ai_autorecoveryH above.
		// orchestrationH is NOT registered: identical route set to ai_orchestrationH
		// above, plus its own routes contain a trie conflict (`:id` vs `:orch_id`
		// under /api/v1/orchestration) that Gin would panic on.

		// serviceControlH and automationRuleTicketH are NOT registered: their
		// /ticketing/start|stop|health and /ticketing/automation/rules sets are
		// already claimed by ticketingH above, and Gin panics on a second
		// (method, path) pair.
		if governanceComplianceH != nil {
			// Namespaced: this handler declares its routes as bare /reports,
			// /schedules and /policies, which are already owned by report-designerH
			// and policyH. Its TS package is internal/governance/compliance.
			governanceComplianceH.RegisterRoutes(api.Group("/governance/compliance"))
		}
		// infraServerlessH is NOT registered: identical route set to serverlessH above.
		// psH is NOT registered: it is the same handler object as promptSecurityH
		// (psH = promptSecurityH in wiring.go), already registered above.

		// ---- Wired but unregistered handlers (batch registration) ----
		// Note: 10 handlers skipped - no RegisterRoutes method:
		//   analyticsTicketH (AnalyticsHandler), dispatchH (DispatchHandler),
		//   loadBalancerH (LoadBalancerHandler), queueH (QueueHandler),
		//   relationH (RelationHandler), slaModH (SLAHandler),
		//   suspendH (SuspendHandler), transferH (TransferHandler),
		//   ticketH (TicketHandler), workflowModH (WorkflowHandler)
		if governanceH != nil {
			// Namespaced: this handler owns /policies, already taken by policyH.
			governanceH.RegisterRoutes(api.Group("/governance"))
		}
		if governancePolicyH != nil {
			// Namespaced: /policies is owned by policyH, and /governance/policies by
			// governanceH above.
			governancePolicyH.RegisterRoutes(api.Group("/governance/policy"))
		}
		// infraDbaH is NOT registered: identical route set to dbaH above.
		// infraIacH is NOT registered: identical route set to iacH above, and its
		// own registration contains a trie conflict (`:id` vs `:workspaceId` under
		// /api/v1/iac/workspaces) that Gin would panic on.
		if securityH != nil {
			// Namespaced: this handler owns /audit/plans, already taken by
			// security_complianceH, and /scans and /findings collide with other
			// scan-oriented handlers. code_scanH already uses /security/code-scan.
			securityH.RegisterRoutes(api.Group("/security"))
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
		// internal/datasource owns /data-sources at the /api/v1 level; dbdevopsH
		// keeps its own nested /database-devops/data-sources pair above.
		// internal/skill owns /skill; ai_skillH above owns the plural /skills.
		// serviceCatalogH is NOT registered: a second service-catalog handler object
		// (wiring-service-catalog.go) whose route set duplicates service_catalogH above.
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
