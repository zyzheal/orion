package main

import (
	ff_handler "orion/platform-svc-go/internal/feature-flag/handler"

	gs_handler "orion/platform-svc-go/internal/global-search/handler"

	role_handler "orion/platform-svc-go/internal/role/handler"

	ag_handler "orion/platform-svc-go/internal/api-governance/handler"

	artifact_handler "orion/platform-svc-go/internal/artifact/handler"

	fed_handler "orion/platform-svc-go/internal/federation/handler"

	plugin_handler "orion/platform-svc-go/internal/plugin/handler"
	pm_handler "orion/platform-svc-go/internal/plugin-marketplace/handler"
	pm_repo "orion/platform-svc-go/internal/plugin-marketplace/repository"
	pm_service "orion/platform-svc-go/internal/plugin-marketplace/service"

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

	graph_handler "orion/platform-svc-go/internal/graph/handler"

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
	pipeline_service "orion/platform-svc-go/internal/pipeline/service"
	dba_handler "orion/platform-svc-go/internal/dba/handler"

	deploy_enhanced_handler "orion/platform-svc-go/internal/deploy-enhanced/handler"
	deploy_handler "orion/platform-svc-go/internal/deploy/handler"

	digital_twin_handler "orion/platform-svc-go/internal/digital-twin/handler"

	finops_v2_handler "orion/platform-svc-go/internal/finops-v2/handler"
	finops_handler "orion/platform-svc-go/internal/finops/handler"

	knowledge_handler "orion/platform-svc-go/internal/knowledge/handler"

	security_compliance_handler "orion/platform-svc-go/internal/security-compliance/handler"

	change_handler "orion/platform-svc-go/internal/change/handler"
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

	notification_handler "orion/platform-svc-go/internal/notification/notification-handler"

	notification_policy_handler "orion/platform-svc-go/internal/notification/notification-policy/handler"

	notification_template_handler "orion/platform-svc-go/internal/notification/notification-template/handler"

	scheduled_notification_handler "orion/platform-svc-go/internal/notification/scheduled-notification/handler"

	webhook_handler "orion/platform-svc-go/internal/webhook/handler"

	dd_handler "orion/platform-svc-go/internal/notification/do-not-disturb/handler"

	chan_handler "orion/platform-svc-go/internal/notification/channel/handler"

	workflow_handler "orion/platform-svc-go/internal/workflow/workflow/handler"

	workflow_trigger_handler "orion/platform-svc-go/internal/workflow/workflow-trigger/handler"

	workflow_task_handler "orion/platform-svc-go/internal/workflow/workflow-task/handler"

	workflow_dep_handler "orion/platform-svc-go/internal/workflow/workflow-dependency/handler"

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
	ciArtVer_service "orion/platform-svc-go/internal/ci-cd/artifact-version/service"
	ciBuild_handler "orion/platform-svc-go/internal/ci-cd/build/handler"
	ciCanary_handler "orion/platform-svc-go/internal/ci-cd/canary/handler"
	ciCanary_repo "orion/platform-svc-go/internal/ci-cd/canary/repository"
	ciCanary_service "orion/platform-svc-go/internal/ci-cd/canary/service"
	ciDeploy_handler "orion/platform-svc-go/internal/ci-cd/deploy/handler"
	ciPipeline_handler "orion/platform-svc-go/internal/ci-cd/pipeline/handler"
	ciPipeline_repo "orion/platform-svc-go/internal/ci-cd/pipeline/repository"
	ciPipeline_service "orion/platform-svc-go/internal/ci-cd/pipeline/service"
	ciPipeline_engine "orion/platform-svc-go/internal/ci-cd/pipeline/engine"
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
	jobsource_handler "orion/platform-svc-go/internal/job-source/handler"

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
	incident_models "orion/platform-svc-go/internal/incident/models"
	incident_nats "orion/platform-svc-go/internal/incident/nats"
	incident_service "orion/platform-svc-go/internal/incident/service"
	sh_nats "orion/platform-svc-go/internal/self-healing/nats"

	// ---- AI module handler imports (internal/ai/) ----
	ai_llm_handler "orion/platform-svc-go/internal/ai/llm/handler"
	ai_aiagent_handler "orion/platform-svc-go/internal/ai/aiagent/handler"
	ai_aicost_handler "orion/platform-svc-go/internal/ai/aicost/handler"
	ai_aigateway_handler "orion/platform-svc-go/internal/ai/aigateway/handler"
	ai_aireview_handler "orion/platform-svc-go/internal/ai/aireview/handler"
	ai_aisecurity_handler "orion/platform-svc-go/internal/ai/aisecurity/handler"
	ai_orchestration_handler "orion/platform-svc-go/internal/ai/orchestration/handler"
	ai_autorecovery_handler "orion/platform-svc-go/internal/ai/auto-recovery/handler"
	ai_skill_handler "orion/platform-svc-go/internal/ai/skill/handler"
	ai_intelligence_handler "orion/platform-svc-go/internal/ai/intelligence/handler"

	ai_agent_run_handler "orion/platform-svc-go/internal/ai-agent-run/handler"
	ai_agent_run_repo "orion/platform-svc-go/internal/ai-agent-run/repository"
	ai_agent_run_service "orion/platform-svc-go/internal/ai-agent-run/service"

	"encoding/json"
	"fmt"
)

// Package-level handler variables — initialized in initWiring(), consumed in setupRouter().
var (
	ffH                 *ff_handler.Handler
	gsH                 *gs_handler.Handler // Global search service
	roleH               *role_handler.Handler
	agH                 *ag_handler.Handler
	artifactH           *artifact_handler.Handler
	fedH                *fed_handler.Handler
	pluginH             *plugin_handler.Handler
	pluginMarketplaceH  *pm_handler.Handler
	incH                *inc_handler.Handler
	policyH             *policy_handler.Handler
	envH                *env_handler.Handler
	capabilityH         *capability_handler.Handler
	chaosH              *chaos_handler.Handler
	cronH               *cron_handler.Handler
	jobsourceH          *jobsource_handler.Handler
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
	graphH              *graph_handler.Handler
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
	pipelineRunnerSvc   *pipeline_service.Service
	dbaH                *dba_handler.Handler
	deploy_enhancedH    *deploy_enhanced_handler.Handler
	deployH             *deploy_handler.Handler
	digital_twinH       *digital_twin_handler.Handler
	finops_v2H          *finops_v2_handler.Handler
	finopsH             *finops_handler.Handler
	knowledgeH          *knowledge_handler.Handler
	security_complianceH *security_compliance_handler.Handler
	changeH             *change_handler.Handler
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
	oncallH             *oncall_handler.OnCallHandler
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
	storageH            *storage_handler.Handler
	clusterH            *cluster_handler.Handler
	aiInferenceH        *aiInference_handler.Handler
	networkH            *network_handler.Handler
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
	ai_llmH           *ai_llm_handler.Handler
	ai_aiagentH       *ai_aiagent_handler.Handler
	ai_aicostH        *ai_aicost_handler.Handler
	ai_aigatewayH     *ai_aigateway_handler.Handler
	ai_aireviewH      *ai_aireview_handler.Handler
	ai_aisecurityH    *ai_aisecurity_handler.Handler
	ai_knowledgeH     *ai_knowledge_handler.KnowledgeHandler
	ai_orchestrationH *ai_orchestration_handler.OrchestrationHandler
	ai_autorecoveryH  *ai_autorecovery_handler.AutoRecoveryHandler
	ai_skillH         *ai_skill_handler.Handler
	ai_intelligenceH  *ai_intelligence_handler.Handler
	ai_llmtraceH      *ai_llmtrace_handler.LLMTraceHandler
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

	// Batch 1: application, escalation, pandawiki, metadata

t// Batch 2: param-types, form, mlops, sla-engine, test-selector, test-generation, visor-exec
twireImportExport(db, logger)
t// Batch 3: alert pipeline (dedup, adapter)
twireAlertDeduplication(db, logger)
twireAlertAdapter(db, logger)

t// Batch 4: chaos-gateway, circuit-breaker, vulnerability, CMDB submodules
twireChaosGateway(db, logger)
twireCircuitBreaker(db, logger)
twireVulnerability(db, logger)
twireCmdbCollector(db, logger)
twireCmdbImport(db, logger)
twireCmdbRelationship(db, logger)
twireCmdbValidator(db, logger)twireParamTypes(db, logger)
twireForm(db, logger)
twireMLOps(db, logger)
twireSLAEngine(db, logger)
twireTestSelector(db, logger)
twireTestGeneration(db, logger)
twireVisorExec(db, logger)	wireApplication(db, logger)
	wireEscalation(db, logger)
	wirePandawiki(db, logger)
	wireMetadata(db, logger)

	// Core domains (identity, governance, security, ticket) — see wiring-core-domains.go
	wireCoreDomains(db, logger)



t// Batch 1: application, escalation, pandawiki, metadata

t// Batch 2: param-types, form, mlops, sla-engine, test-selector, test-generation, visor-exec
twireImportExport(db, logger)
t// Batch 3: alert pipeline (dedup, adapter)
twireAlertDeduplication(db, logger)
twireAlertAdapter(db, logger)

t// Batch 4: chaos-gateway, circuit-breaker, vulnerability, CMDB submodules
twireChaosGateway(db, logger)
twireCircuitBreaker(db, logger)
twireVulnerability(db, logger)
twireCmdbCollector(db, logger)
twireCmdbImport(db, logger)
twireCmdbRelationship(db, logger)
twireCmdbValidator(db, logger)twireParamTypes(db, logger)
twireForm(db, logger)
twireMLOps(db, logger)
twireSLAEngine(db, logger)
twireTestSelector(db, logger)
twireTestGeneration(db, logger)
twireVisorExec(db, logger)