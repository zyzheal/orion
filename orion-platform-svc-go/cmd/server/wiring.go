package main

import (
	ff_handler "orion/platform-svc-go/internal/feature-flag/handler"

	role_handler "orion/platform-svc-go/internal/role/handler"

	ag_handler "orion/platform-svc-go/internal/api-governance/handler"

	artifact_handler "orion/platform-svc-go/internal/artifact/handler"

	fed_handler "orion/platform-svc-go/internal/federation/handler"

	plugin_handler "orion/platform-svc-go/internal/plugin/handler"

	inc_handler "orion/platform-svc-go/internal/inception/handler"

	policy_handler "orion/platform-svc-go/internal/policy/handler"

	env_handler "orion/platform-svc-go/internal/environment/handler"

	capability_handler "orion/platform-svc-go/internal/capability/handler"
	chaos_handler "orion/platform-svc-go/internal/chaos/handler"
	cron_handler "orion/platform-svc-go/internal/cron/handler"
	developerportal_handler "orion/platform-svc-go/internal/developer-portal/handler"
	infra_handler "orion/platform-svc-go/internal/infrastructure/handler"
	internallibrary_handler "orion/platform-svc-go/internal/internal-library/handler"
	pageregistry_handler "orion/platform-svc-go/internal/page-registry/handler"
	productline_handler "orion/platform-svc-go/internal/product-line/handler"
	projectmember_handler "orion/platform-svc-go/internal/project-member/handler"
	proj_handler "orion/platform-svc-go/internal/project/handler"
	serviceregistry_handler "orion/platform-svc-go/internal/service-registry/handler"
	sprint_handler "orion/platform-svc-go/internal/sprint/handler"
	subapp_handler "orion/platform-svc-go/internal/subapp/handler"
	team_handler "orion/platform-svc-go/internal/team/handler"
	workbench_handler "orion/platform-svc-go/internal/workbench/handler"

	gatewaydynamic_handler "orion/platform-svc-go/internal/gateway-dynamic/handler"
	handlerregistry_handler "orion/platform-svc-go/internal/handler-registry/handler"
	i18n_handler "orion/platform-svc-go/internal/i18n/handler"
	iac_handler "orion/platform-svc-go/internal/iac/handler"
	multicloud_handler "orion/platform-svc-go/internal/multi-cloud/handler"
	serverless_handler "orion/platform-svc-go/internal/serverless/handler"

	alert_handler "orion/platform-svc-go/internal/alert/handler"
	cmdb_handler "orion/platform-svc-go/internal/cmdb/handler"
	monitoring_handler "orion/platform-svc-go/internal/monitoring/handler"

	artifactops_handler "orion/platform-svc-go/internal/artifact-ops/handler"

	config_handler "orion/platform-svc-go/internal/config/handler"

	approval_handler "orion/platform-svc-go/internal/approval/handler"

	chatops_handler "orion/platform-svc-go/internal/chatops/handler"

	session_handler "orion/platform-svc-go/internal/session/handler"

	apikey_handler "orion/platform-svc-go/internal/api-key/handler"

	eventbus_handler "orion/platform-svc-go/internal/eventbus/handler"

	trigger_handler "orion/platform-svc-go/internal/event-trigger/handler"

	hook_handler "orion/platform-svc-go/internal/hook-chain/handler"

	user_handler "orion/platform-svc-go/internal/user/handler"
	user_repo "orion/platform-svc-go/internal/user/repository"
	user_service "orion/platform-svc-go/internal/user/service"

	auth_handler "orion/platform-svc-go/internal/auth/handler"
	auth_repo "orion/platform-svc-go/internal/auth/repository"
	auth_service "orion/platform-svc-go/internal/auth/service"

	perm_handler "orion/platform-svc-go/internal/permission/handler"
	perm_repo "orion/platform-svc-go/internal/permission/repository"
	perm_service "orion/platform-svc-go/internal/permission/service"

	code_repo_handler "orion/platform-svc-go/internal/code-repo/handler"

	incident_handler "orion/platform-svc-go/internal/incident/handler"

	audit_handler "orion/platform-svc-go/internal/audit/handler"

	build_env_handler "orion/platform-svc-go/internal/build-env/handler"

	build_handler "orion/platform-svc-go/internal/build/handler"
	pipeline_handler "orion/platform-svc-go/internal/pipeline/handler"
	dba_handler "orion/platform-svc-go/internal/dba/handler"

	deploy_enhanced_handler "orion/platform-svc-go/internal/deploy-enhanced/handler"
	deploy_handler "orion/platform-svc-go/internal/deploy/handler"

	digital_twin_handler "orion/platform-svc-go/internal/digital-twin/handler"

	finops_v2_handler "orion/platform-svc-go/internal/finops-v2/handler"
	finops_handler "orion/platform-svc-go/internal/finops/handler"

	knowledge_handler "orion/platform-svc-go/internal/knowledge/handler"

	security_compliance_handler "orion/platform-svc-go/internal/security-compliance/handler"

	change_handler "orion/platform-svc-go/internal/change/handler"
	skill_handler "orion/platform-svc-go/internal/skill/handler"
	sla_handler "orion/platform-svc-go/internal/sla/handler"
	tenant_handler "orion/platform-svc-go/internal/tenant/handler"
	visor_handler "orion/platform-svc-go/internal/visor-exec/handler"

	cr_handler "orion/platform-svc-go/internal/change-request/handler"
	rd_handler "orion/platform-svc-go/internal/report-designer/handler"

	diagnostic_handler "orion/platform-svc-go/internal/diagnostic/handler"

	backup_handler "orion/platform-svc-go/internal/backup/handler"

	am_handler "orion/platform-svc-go/internal/api-market/handler"
	cit_handler "orion/platform-svc-go/internal/ci-type/handler"

	// ---- Wave 2: Auth + Permission modules ----
	ae_handler "orion/platform-svc-go/internal/auth-enhanced/handler"
	amfa_handler "orion/platform-svc-go/internal/auth-mfa/handler"
	ssou_handler "orion/platform-svc-go/internal/sso-unified/handler"
	ssop_handler "orion/platform-svc-go/internal/sso-providers/handler"
	abac_handler "orion/platform-svc-go/internal/abac-policy/handler"
	paudit_handler "orion/platform-svc-go/internal/permission-audit/handler"

	oncall_handler "orion/platform-svc-go/internal/oncall/handler"

	notification_handler "orion/platform-svc-go/internal/notification/handler"

	notification_policy_handler "orion/platform-svc-go/internal/notification-policy/handler"

	notification_template_handler "orion/platform-svc-go/internal/notification-template/handler"

	scheduled_notification_handler "orion/platform-svc-go/internal/scheduled-notification/handler"

	webhook_handler "orion/platform-svc-go/internal/webhook/handler"

	dd_handler "orion/platform-svc-go/internal/do-not-disturb/handler"

	chan_handler "orion/platform-svc-go/internal/channel/handler"

	workflow_handler "orion/platform-svc-go/internal/workflow/handler"

	workflow_trigger_handler "orion/platform-svc-go/internal/workflow-trigger/handler"

	workflow_task_handler "orion/platform-svc-go/internal/workflow-task/handler"

	workflow_dep_handler "orion/platform-svc-go/internal/workflow-dependency/handler"

	workflow_webhook_handler "orion/platform-svc-go/internal/workflow-webhook/handler"

	lowcode_handler "orion/platform-svc-go/internal/lowcode/handler"

	ticketing_handler "orion/platform-svc-go/internal/ticketing/handler"

	// ---- Wave 5: Pipeline Assistant modules ----
	pb_handler "orion/platform-svc-go/internal/pipeline-batch/handler"

	pal_handler "orion/platform-svc-go/internal/pipeline-audit-log/handler"

	ptmpl_handler "orion/platform-svc-go/internal/pipeline-template/handler"

	pver_handler "orion/platform-svc-go/internal/pipeline-version/handler"

	phist_handler "orion/platform-svc-go/internal/pipeline-run-history/handler"

	pbo_handler "orion/platform-svc-go/internal/pipeline-batch-operations/handler"

	psse_handler "orion/platform-svc-go/internal/pipeline-sse/handler"

	pec_handler "orion/platform-svc-go/internal/pipeline-execution-control/handler"

	pgraph_handler "orion/platform-svc-go/internal/pipeline-graph/handler"

	ptrend_handler "orion/platform-svc-go/internal/pipeline-trend/handler"

	ci_handler "orion/platform-svc-go/internal/change-intelligence/handler"

	tracing_handler "orion/platform-svc-go/internal/tracing/handler"

	slo_handler "orion/platform-svc-go/internal/slo/handler"

	perf_handler "orion/platform-svc-go/internal/performance/handler"

	hc_handler "orion/platform-svc-go/internal/health-check/handler"

	// ---- Wave 7a: P2 modules ----
	compliance_handler "orion/platform-svc-go/internal/compliance/handler"

	supply_chain_handler "orion/platform-svc-go/internal/supply-chain/handler"

	secret_handler "orion/platform-svc-go/internal/secret/handler"

	chaos_enhanced_handler "orion/platform-svc-go/internal/chaos-enhanced/handler"

	ueba_handler "orion/platform-svc-go/internal/ueba/handler"

	// ---- problem module ----
	problem_handler "orion/platform-svc-go/internal/problem/handler"

	// ---- new blueprint modules ----
	billing_handler "orion/platform-svc-go/internal/billing/handler"

	costalloc_handler "orion/platform-svc-go/internal/cost-allocation/handler"

	efficiency_handler "orion/platform-svc-go/internal/efficiency/handler"

	dataLineage_handler "orion/platform-svc-go/internal/data-lineage/handler"

	dataCatalog_handler "orion/platform-svc-go/internal/data-catalog/handler"
	dataCatalog_repo "orion/platform-svc-go/internal/data-catalog/repository"
	dataCatalog_service "orion/platform-svc-go/internal/data-catalog/service"

	dataQuality_handler "orion/platform-svc-go/internal/data-quality/handler"
	dataQuality_repo    "orion/platform-svc-go/internal/data-quality/repository"
	dataQuality_service "orion/platform-svc-go/internal/data-quality/service"

	dataPipeline_handler "orion/platform-svc-go/internal/data-pipeline/handler"
	dataPipeline_repo    "orion/platform-svc-go/internal/data-pipeline/repository"
	dataPipeline_service "orion/platform-svc-go/internal/data-pipeline/service"

	apiConsumption_handler "orion/platform-svc-go/internal/api-consumption/handler"

	contract_handler "orion/platform-svc-go/internal/contract/handler"

	pe_handler "orion/platform-svc-go/internal/pipeline-engine/handler"

	// ---- Batch 1: registered modules ----
	aiAgents_handler "orion/platform-svc-go/internal/ai-agents/handler"
	aiCost_handler "orion/platform-svc-go/internal/ai-cost/handler"
	aiGateway_handler "orion/platform-svc-go/internal/ai-gateway/handler"
	aiDecisions_handler "orion/platform-svc-go/internal/ai-decisions/handler"
	aiDecisions_repo "orion/platform-svc-go/internal/ai-decisions/repository"
	aiDecisions_service "orion/platform-svc-go/internal/ai-decisions/service"
	aiGateway_repo "orion/platform-svc-go/internal/ai-gateway/repository"
	aiGateway_service "orion/platform-svc-go/internal/ai-gateway/service"
	llmprovider "orion/platform-svc-go/internal/ai/llm-provider"
	aiReview_handler "orion/platform-svc-go/internal/ai-review/handler"
	artifactVersion_handler "orion/platform-svc-go/internal/artifact-version/handler"
	cache_mod_handler "orion/platform-svc-go/internal/cache/handler"
	cacheCleanup_handler "orion/platform-svc-go/internal/cache-cleanup/handler"

	// ---- Wave 7: P2 module imports (batch 1-2 + alert/apm/bi/canary) ----
	canary_traffic_handler "orion/platform-svc-go/internal/canary-traffic/handler"
	cross_domain_handler "orion/platform-svc-go/internal/cross-domain/handler"
	decision_explanation_handler "orion/platform-svc-go/internal/decision-explanation/handler"
	degradation_handler "orion/platform-svc-go/internal/degradation/handler"
	dependency_coordination_handler "orion/platform-svc-go/internal/dependency-coordination/handler"
	dual_engine_handler "orion/platform-svc-go/internal/dual-engine/handler"
	env_lifecycle_handler "orion/platform-svc-go/internal/env-lifecycle/handler"
	env_profile_handler "orion/platform-svc-go/internal/env-profile/handler"
	global_param_handler "orion/platform-svc-go/internal/global-param/handler"
	integration_handler "orion/platform-svc-go/internal/integration/handler"
	maintenance_window_handler "orion/platform-svc-go/internal/maintenance-window/handler"
	message_queue_handler "orion/platform-svc-go/internal/message-queue/handler"
	metrics_handler "orion/platform-svc-go/internal/metrics/handler"
	multi_modal_trigger_handler "orion/platform-svc-go/internal/multi-modal-trigger/handler"
	notification_mgmt_handler "orion/platform-svc-go/internal/notification-management/handler"
	oci_registry_handler "orion/platform-svc-go/internal/oci-registry/handler"
	plugin_hotreload_handler "orion/platform-svc-go/internal/plugin-hotreload/handler"
	process_step_handler "orion/platform-svc-go/internal/process-step/handler"
	progessive_handler "orion/platform-svc-go/internal/progressive/handler"
	queue_mod_handler "orion/platform-svc-go/internal/queue/handler"
	risk_handler "orion/platform-svc-go/internal/risk/handler"
	runbook_handler "orion/platform-svc-go/internal/runbook/handler"
	script_library_handler "orion/platform-svc-go/internal/script-library/handler"
	script_mod_handler "orion/platform-svc-go/internal/script/handler"
	script_version_handler "orion/platform-svc-go/internal/script-version/handler"
	self_service_handler "orion/platform-svc-go/internal/self-service/handler"
	service_catalog_handler "orion/platform-svc-go/internal/service-catalog/handler"
	service_health_handler "orion/platform-svc-go/internal/service-health/handler"
	service_topology_handler "orion/platform-svc-go/internal/service-topology/handler"
	ticket_knowledge_handler "orion/platform-svc-go/internal/ticket-knowledge/handler"
	topology_handler "orion/platform-svc-go/internal/topology/handler"
	unified_config_handler "orion/platform-svc-go/internal/unified-config/handler"
	vector_store_handler "orion/platform-svc-go/internal/vector-store/handler"
	vectorize_rules_handler "orion/platform-svc-go/internal/vectorize-rules/handler"
	version_archive_handler "orion/platform-svc-go/internal/version-archive/handler"

	alert_breaker_handler "orion/platform-svc-go/internal/alert-breaker/handler"
	apm_handler "orion/platform-svc-go/internal/apm/handler"
	bi_dashboard_handler "orion/platform-svc-go/internal/bi-dashboard/handler"
	canary_analysis_handler "orion/platform-svc-go/internal/canary-analysis/handler"

	deployment_trigger_handler "orion/platform-svc-go/internal/deployment-trigger/handler"
	incident_action_handler "orion/platform-svc-go/internal/incident-action/handler"
	ticket_automation_handler "orion/platform-svc-go/internal/ticket-automation/handler"

	"os"

	"go.uber.org/zap"
)

// Package-level handler variables — initialized in initWiring(), consumed in setupRouter().
var (
	ffH                 *ff_handler.Handler
	roleH               *role_handler.Handler
	agH                 *ag_handler.Handler
	artifactH           *artifact_handler.Handler
	fedH                *fed_handler.Handler
	pluginH             *plugin_handler.Handler
	incH                *inc_handler.Handler
	policyH             *policy_handler.Handler
	envH                *env_handler.Handler
	capabilityH         *capability_handler.Handler
	chaosH              *chaos_handler.Handler
	cronH               *cron_handler.Handler
	developerportalH    *developerportal_handler.Handler
	infraH              *infra_handler.Handler
	internallibraryH    *internallibrary_handler.Handler
	pageregistryH       *pageregistry_handler.Handler
	productlineH        *productline_handler.Handler
	projectmemberH      *projectmember_handler.Handler
	projH               *proj_handler.Handler
	serviceregistryH    *serviceregistry_handler.Handler
	sprintH             *sprint_handler.Handler
	subappH             *subapp_handler.Handler
	teamH               *team_handler.Handler
	workbenchH          *workbench_handler.Handler
	gatewaydynamicH     *gatewaydynamic_handler.Handler
	gdGrayH             *gatewaydynamic_handler.GrayReleaseHandler
	handlerregistryH    *handlerregistry_handler.Handler
	i18nH               *i18n_handler.Handler
	iacH                *iac_handler.Handler
	multicloudH         *multicloud_handler.Handler
	serverlessH         *serverless_handler.Handler
	alertH              *alert_handler.Handler
	cmdbH               *cmdb_handler.Handler
	monitoringH         *monitoring_handler.Handler
	artifactopsH        *artifactops_handler.Handler
	configH             *config_handler.Handler
	approvalH           *approval_handler.Handler
	chatopsH            *chatops_handler.Handler
	sessionH            *session_handler.Handler
	apikeyH             *apikey_handler.Handler
	eventbusH           *eventbus_handler.Handler
	triggerH            *trigger_handler.Handler
	hookH               *hook_handler.Handler
	userH               *user_handler.Handler
	authH               *auth_handler.Handler
	permH               *perm_handler.Handler
	code_repoH          *code_repo_handler.Handler
	incidentH           *incident_handler.Handler
	auditH              *audit_handler.Handler
	build_envH          *build_env_handler.Handler
	buildH              *build_handler.Handler
	pipelineH           *pipeline_handler.Handler
	dbaH                *dba_handler.Handler
	deploy_enhancedH    *deploy_enhanced_handler.Handler
	deployH             *deploy_handler.Handler
	digital_twinH       *digital_twin_handler.Handler
	finops_v2H          *finops_v2_handler.Handler
	finopsH             *finops_handler.Handler
	knowledgeH          *knowledge_handler.Handler
	security_complianceH *security_compliance_handler.Handler
	changeH             *change_handler.Handler
	skillH              *skill_handler.Handler
	slaH                *sla_handler.Handler
	tenantH             *tenant_handler.Handler
	visorH              *visor_handler.Handler
	crH                 *cr_handler.Handler
	rdH                 *rd_handler.Handler
	diagnosticH         *diagnostic_handler.Handler
	backupH             *backup_handler.Handler
	amH                 *am_handler.Handler
	citH                *cit_handler.Handler
	aeH                 *ae_handler.Handler
	amfaH               *amfa_handler.Handler
	ssouH               *ssou_handler.Handler
	ssopH               *ssop_handler.Handler
	abacH               *abac_handler.Handler
	pauditH             *paudit_handler.Handler
	oncallH             *oncall_handler.Handler
	notificationH       *notification_handler.Handler
	notification_policyH *notification_policy_handler.Handler
	notification_templateH *notification_template_handler.Handler
	scheduled_notificationH *scheduled_notification_handler.Handler
	webhookH            *webhook_handler.Handler
	ddH                 *dd_handler.Handler
	chanH               *chan_handler.Handler
	workflowH           *workflow_handler.Handler
	workflow_triggerH   *workflow_trigger_handler.Handler
	workflow_taskH      *workflow_task_handler.Handler
	workflow_depH       *workflow_dep_handler.Handler
	workflow_webhookH   *workflow_webhook_handler.Handler
	lowcodeH            *lowcode_handler.Handler
	ticketingH          *ticketing_handler.Handler
	pbH                 *pb_handler.Handler
	palH                *pal_handler.Handler
	ptmplH              *ptmpl_handler.Handler
	pverH               *pver_handler.Handler
	phistH              *phist_handler.Handler
	pboH                *pbo_handler.Handler
	psseH               *psse_handler.Handler
	pecH                *pec_handler.Handler
	pgraphH             *pgraph_handler.Handler
	ptrendH             *ptrend_handler.Handler
	ciH                 *ci_handler.Handler
	tracingH            *tracing_handler.Handler
	sloH                *slo_handler.Handler
	perfH               *perf_handler.Handler
	hcH                 *hc_handler.Handler
	complianceH         *compliance_handler.Handler
	supply_chainH       *supply_chain_handler.Handler
	secretH             *secret_handler.Handler
	chaos_enhancedH     *chaos_enhanced_handler.Handler
	uebaH               *ueba_handler.Handler
	problemH            *problem_handler.Handler
	billingH            *billing_handler.Handler
	costallocH          *costalloc_handler.Handler
	efficiencyH         *efficiency_handler.Handler
	dataLineageH        *dataLineage_handler.Handler
	dataCatalogH        *dataCatalog_handler.Handler
	dataQualityH        *dataQuality_handler.Handler
	dataPipelineH       *dataPipeline_handler.Handler
	apiConsumptionH     *apiConsumption_handler.Handler
	contractH           *contract_handler.Handler
	peH                 *pe_handler.Handler
	aiAgentsH           *aiAgents_handler.Handler
	aiCostH             *aiCost_handler.Handler
	aiGatewayH          *aiGateway_handler.Handler
	aiDecisionsH        *aiDecisions_handler.Handler
	aiReviewH           *aiReview_handler.Handler
	artifactVersionH    *artifactVersion_handler.Handler
	cacheModH           *cache_mod_handler.Handler
	cacheCleanupH       *cacheCleanup_handler.Handler
	canary_trafficH     *canary_traffic_handler.Handler
	cross_domainH       *cross_domain_handler.Handler
	decision_explanationH *decision_explanation_handler.Handler
	degradationH        *degradation_handler.Handler
	dependency_coordinationH *dependency_coordination_handler.Handler
	dual_engineH        *dual_engine_handler.Handler
	env_lifecycleH      *env_lifecycle_handler.Handler
	env_profileH        *env_profile_handler.Handler
	global_paramH       *global_param_handler.Handler
	integrationH        *integration_handler.Handler
	maintenance_windowH *maintenance_window_handler.Handler
	message_queueH      *message_queue_handler.Handler
	metricsH            *metrics_handler.Handler
	multi_modal_triggerH *multi_modal_trigger_handler.Handler
	notification_mgmtH  *notification_mgmt_handler.Handler
	oci_registryH       *oci_registry_handler.Handler
	plugin_hotreloadH   *plugin_hotreload_handler.Handler
	process_stepH       *process_step_handler.Handler
	progessiveH         *progessive_handler.Handler
	queue_modH          *queue_mod_handler.Handler
	riskH               *risk_handler.Handler
	runbookH            *runbook_handler.Handler
	script_libraryH     *script_library_handler.Handler
	script_modH         *script_mod_handler.Handler
	script_versionH     *script_version_handler.Handler
	self_serviceH       *self_service_handler.Handler
	service_catalogH    *service_catalog_handler.Handler
	service_healthH     *service_health_handler.Handler
	service_topologyH   *service_topology_handler.Handler
	ticket_knowledgeH   *ticket_knowledge_handler.Handler
	topologyH           *topology_handler.Handler
	unified_configH     *unified_config_handler.Handler
	vector_storeH       *vector_store_handler.Handler
	vectorize_rulesH    *vectorize_rules_handler.Handler
	version_archiveH    *version_archive_handler.Handler
	alert_breakerH      *alert_breaker_handler.Handler
	apmH                *apm_handler.Handler
	bi_dashboardH       *bi_dashboard_handler.Handler
	canary_analysisH    *canary_analysis_handler.Handler
	deployment_triggerH *deployment_trigger_handler.Handler
	incident_actionH    *incident_action_handler.Handler
	ticket_automationH  *ticket_automation_handler.Handler
)

func initWiring(infra *infrastructure, logger *zap.Logger) {
	db := infra.db
	_ = logger

	// ---- Delegated domain wiring (split for readability) ----

	// Core modules: feature-flag, role, ag, artifact, plugin, inception,
	// environment, policy, project/team organization
	wireCoreModules(db)

	// Wave 2: Auth + Permission modules (ae, amfa, ssou, ssop, abac, paudit)
	wireAuthModules(db)

	// Infrastructure modules: capability, chaos, infrastructure, iac, cron,
	// gateway-dynamic (incl. gray release), handler-registry, i18n, serverless, multicloud
	wireInfrastructureModules(db)

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

	// Data modules (catalog, quality, pipeline) — repo -> service -> handler
	dataCatalogRepo := dataCatalog_repo.NewRepository(infra.db.DB)
	dataCatalogSvc := dataCatalog_service.NewService(dataCatalogRepo)
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

	// ai-gateway services
	aiGatewayRepo := aiGateway_repo.NewRepository(infra.db.DB)
	aiGatewaySvc := aiGateway_service.NewService(aiGatewayRepo)
	aiGatewaySvc.WithLLMProvider(llmProviderRegistry)
	aiGatewayH = aiGateway_handler.NewHandler(aiGatewaySvc)

}