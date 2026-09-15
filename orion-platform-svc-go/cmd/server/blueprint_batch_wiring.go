package main

import (
	"orion/go-common/pkg/database"

	auto_exec_repo "orion/platform-svc-go/internal/auto-exec/repository"
	billing_handler "orion/platform-svc-go/internal/billing/handler"
	billing_repo "orion/platform-svc-go/internal/billing/repository"
	billing_service "orion/platform-svc-go/internal/billing/service"
	costalloc_handler "orion/platform-svc-go/internal/cost-allocation/handler"
	costalloc_repo "orion/platform-svc-go/internal/cost-allocation/repository"
	costalloc_service "orion/platform-svc-go/internal/cost-allocation/service"
	dataLineage_handler "orion/platform-svc-go/internal/data-lineage/handler"
	dataLineage_repo "orion/platform-svc-go/internal/data-lineage/repository"
	dataLineage_service "orion/platform-svc-go/internal/data-lineage/service"
	efficiency_handler "orion/platform-svc-go/internal/efficiency/handler"
	efficiency_repo "orion/platform-svc-go/internal/efficiency/repository"
	efficiency_service "orion/platform-svc-go/internal/efficiency/service"

	dataCatalog_handler "orion/platform-svc-go/internal/data-catalog/handler"
	dataCatalog_repo "orion/platform-svc-go/internal/data-catalog/repository"
	dataCatalog_service "orion/platform-svc-go/internal/data-catalog/service"

	canary_traffic_handler "orion/platform-svc-go/internal/canary-traffic/handler"
	canary_traffic_repo "orion/platform-svc-go/internal/canary-traffic/repository"
	canary_traffic_service "orion/platform-svc-go/internal/canary-traffic/service"
	cross_domain_handler "orion/platform-svc-go/internal/cross-domain/handler"
	cross_domain_repo "orion/platform-svc-go/internal/cross-domain/repository"
	cross_domain_service "orion/platform-svc-go/internal/cross-domain/service"
	decision_explanation_handler "orion/platform-svc-go/internal/decision-explanation/handler"
	decision_explanation_repo "orion/platform-svc-go/internal/decision-explanation/repository"
	decision_explanation_service "orion/platform-svc-go/internal/decision-explanation/service"
	degradation_handler "orion/platform-svc-go/internal/degradation/handler"
	degradation_repo "orion/platform-svc-go/internal/degradation/repository"
	degradation_service "orion/platform-svc-go/internal/degradation/service"

	alert_breaker_handler "orion/platform-svc-go/internal/alert-breaker/handler"
	alert_breaker_repo "orion/platform-svc-go/internal/alert-breaker/repository"
	alert_breaker_service "orion/platform-svc-go/internal/alert-breaker/service"
	apm_handler "orion/platform-svc-go/internal/apm/handler"
	apm_repo "orion/platform-svc-go/internal/apm/repository"
	apm_service "orion/platform-svc-go/internal/apm/service"
	bi_dashboard_handler "orion/platform-svc-go/internal/bi-dashboard/handler"
	bi_dashboard_repo "orion/platform-svc-go/internal/bi-dashboard/repository"
	bi_dashboard_service "orion/platform-svc-go/internal/bi-dashboard/service"
	canary_analysis_handler "orion/platform-svc-go/internal/canary-analysis/handler"
	canary_analysis_repo "orion/platform-svc-go/internal/canary-analysis/repository"
	canary_analysis_service "orion/platform-svc-go/internal/canary-analysis/service"
	dependency_coordination_handler "orion/platform-svc-go/internal/dependency-coordination/handler"
	dependency_coordination_repo "orion/platform-svc-go/internal/dependency-coordination/repository"
	dependency_coordination_service "orion/platform-svc-go/internal/dependency-coordination/service"
	deployment_trigger_handler "orion/platform-svc-go/internal/deployment-trigger/handler"
	deployment_trigger_repo "orion/platform-svc-go/internal/deployment-trigger/repository"
	deployment_trigger_service "orion/platform-svc-go/internal/deployment-trigger/service"
	dual_engine_handler "orion/platform-svc-go/internal/dual-engine/handler"
	dual_engine_repo "orion/platform-svc-go/internal/dual-engine/repository"
	dual_engine_service "orion/platform-svc-go/internal/dual-engine/service"
	env_lifecycle_handler "orion/platform-svc-go/internal/env-lifecycle/handler"
	env_lifecycle_repo "orion/platform-svc-go/internal/env-lifecycle/repository"
	env_lifecycle_service "orion/platform-svc-go/internal/env-lifecycle/service"
	env_profile_handler "orion/platform-svc-go/internal/env-profile/handler"
	env_profile_repo "orion/platform-svc-go/internal/env-profile/repository"
	env_profile_service "orion/platform-svc-go/internal/env-profile/service"
	global_param_handler "orion/platform-svc-go/internal/global-param/handler"
	global_param_repo "orion/platform-svc-go/internal/global-param/repository"
	global_param_service "orion/platform-svc-go/internal/global-param/service"
	incident_action_handler "orion/platform-svc-go/internal/incident-action/handler"
	incident_action_repo "orion/platform-svc-go/internal/incident-action/repository"
	incident_action_service "orion/platform-svc-go/internal/incident-action/service"
	integration_handler "orion/platform-svc-go/internal/integration/handler"
	integration_repo "orion/platform-svc-go/internal/integration/repository"
	integration_service "orion/platform-svc-go/internal/integration/service"
	maintenance_window_handler "orion/platform-svc-go/internal/maintenance-window/handler"
	maintenance_window_repo "orion/platform-svc-go/internal/maintenance-window/repository"
	maintenance_window_service "orion/platform-svc-go/internal/maintenance-window/service"
	message_queue_handler "orion/platform-svc-go/internal/message-queue/handler"
	message_queue_repo "orion/platform-svc-go/internal/message-queue/repository"
	message_queue_service "orion/platform-svc-go/internal/message-queue/service"
	metrics_handler "orion/platform-svc-go/internal/metrics/handler"
	metrics_repo "orion/platform-svc-go/internal/metrics/repository"
	metrics_service "orion/platform-svc-go/internal/metrics/service"
	multi_modal_trigger_handler "orion/platform-svc-go/internal/multi-modal-trigger/handler"
	multi_modal_trigger_repo "orion/platform-svc-go/internal/multi-modal-trigger/repository"
	multi_modal_trigger_service "orion/platform-svc-go/internal/multi-modal-trigger/service"
	notification_mgmt_handler "orion/platform-svc-go/internal/notification-management/handler"
	notification_mgmt_repo "orion/platform-svc-go/internal/notification-management/repository"
	notification_mgmt_service "orion/platform-svc-go/internal/notification-management/service"
	oci_registry_handler "orion/platform-svc-go/internal/oci-registry/handler"
	oci_registry_repo "orion/platform-svc-go/internal/oci-registry/repository"
	oci_registry_service "orion/platform-svc-go/internal/oci-registry/service"
	plugin_hotreload_handler "orion/platform-svc-go/internal/plugin-hotreload/handler"
	plugin_hotreload_repo "orion/platform-svc-go/internal/plugin-hotreload/repository"
	plugin_hotreload_service "orion/platform-svc-go/internal/plugin-hotreload/service"
	process_step_handler "orion/platform-svc-go/internal/process-step/handler"
	process_step_repo "orion/platform-svc-go/internal/process-step/repository"
	process_step_service "orion/platform-svc-go/internal/process-step/service"
	progessive_handler "orion/platform-svc-go/internal/progressive/handler"
	progessive_repo "orion/platform-svc-go/internal/progressive/repository"
	progessive_service "orion/platform-svc-go/internal/progressive/service"
	queue_mod_handler "orion/platform-svc-go/internal/queue/handler"
	queue_mod_repo "orion/platform-svc-go/internal/queue/repository"
	queue_mod_service "orion/platform-svc-go/internal/queue/service"
	risk_handler "orion/platform-svc-go/internal/risk/handler"
	risk_repo "orion/platform-svc-go/internal/risk/repository"
	risk_service "orion/platform-svc-go/internal/risk/service"
	runbook_handler "orion/platform-svc-go/internal/runbook/handler"
	runbook_repo "orion/platform-svc-go/internal/runbook/repository"
	runbook_service "orion/platform-svc-go/internal/runbook/service"
	script_library_handler "orion/platform-svc-go/internal/script-library/handler"
	script_library_repo "orion/platform-svc-go/internal/script-library/repository"
	script_library_service "orion/platform-svc-go/internal/script-library/service"
	script_version_handler "orion/platform-svc-go/internal/script-version/handler"
	script_version_repo "orion/platform-svc-go/internal/script-version/repository"
	script_version_service "orion/platform-svc-go/internal/script-version/service"
	script_mod_handler "orion/platform-svc-go/internal/script/handler"
	script_mod_repo "orion/platform-svc-go/internal/script/repository"
	script_mod_service "orion/platform-svc-go/internal/script/service"
	self_service_handler "orion/platform-svc-go/internal/self-service/handler"
	self_service_repo "orion/platform-svc-go/internal/self-service/repository"
	self_service_service "orion/platform-svc-go/internal/self-service/service"
	service_catalog_handler "orion/platform-svc-go/internal/service-catalog/handler"
	service_catalog_repo "orion/platform-svc-go/internal/service-catalog/repository"
	service_catalog_service "orion/platform-svc-go/internal/service-catalog/service"
	service_health_handler "orion/platform-svc-go/internal/service-health/handler"
	service_health_repo "orion/platform-svc-go/internal/service-health/repository"
	service_health_service "orion/platform-svc-go/internal/service-health/service"
	service_topology_handler "orion/platform-svc-go/internal/service-topology/handler"
	service_topology_repo "orion/platform-svc-go/internal/service-topology/repository"
	service_topology_service "orion/platform-svc-go/internal/service-topology/service"
	ticket_automation_handler "orion/platform-svc-go/internal/ticket-automation/handler"
	ticket_automation_repo "orion/platform-svc-go/internal/ticket-automation/repository"
	ticket_automation_service "orion/platform-svc-go/internal/ticket-automation/service"
	ticket_knowledge_handler "orion/platform-svc-go/internal/ticket-knowledge/handler"
	ticket_knowledge_repo "orion/platform-svc-go/internal/ticket-knowledge/repository"
	ticket_knowledge_service "orion/platform-svc-go/internal/ticket-knowledge/service"
	topology_handler "orion/platform-svc-go/internal/topology/handler"
	topology_repo "orion/platform-svc-go/internal/topology/repository"
	topology_service "orion/platform-svc-go/internal/topology/service"
	unified_config_handler "orion/platform-svc-go/internal/unified-config/handler"
	unified_config_repo "orion/platform-svc-go/internal/unified-config/repository"
	unified_config_service "orion/platform-svc-go/internal/unified-config/service"
	vector_store_handler "orion/platform-svc-go/internal/vector-store/handler"
	vector_store_repo "orion/platform-svc-go/internal/vector-store/repository"
	vector_store_service "orion/platform-svc-go/internal/vector-store/service"
	vectorize_rules_handler "orion/platform-svc-go/internal/vectorize-rules/handler"
	vectorize_rules_repo "orion/platform-svc-go/internal/vectorize-rules/repository"
	vectorize_rules_service "orion/platform-svc-go/internal/vectorize-rules/service"
	version_archive_handler "orion/platform-svc-go/internal/version-archive/handler"
	version_archive_repo "orion/platform-svc-go/internal/version-archive/repository"
	version_archive_service "orion/platform-svc-go/internal/version-archive/service"
)

// wireBlueprintModules wires the blueprint modules: billing, cost-allocation,
// efficiency, data-lineage, data-quality, api-consumption, contract.
func wireBlueprintModules(db *database.DB) {
	// new blueprint modules
	billingRepo := billing_repo.NewRepository(db.DB)
	billingSvc := billing_service.NewService(billingRepo)
	billingH = billing_handler.NewHandler(billingSvc)

	costallocRepo := costalloc_repo.NewRepository(db.DB)
	costallocSvc := costalloc_service.NewService(costallocRepo)
	costallocH = costalloc_handler.NewHandler(costallocSvc)

	efficiencyRepo := efficiency_repo.NewRepository(db.DB)
	efficiencySvc := efficiency_service.NewService(efficiencyRepo)
	efficiencyH = efficiency_handler.NewHandler(efficiencySvc)

	dataLineageRepo := dataLineage_repo.NewRepository(db.DB)
	dataLineageSvc := dataLineage_service.NewService(dataLineageRepo)
	dataLineageH = dataLineage_handler.NewHandler(dataLineageSvc)

	// data-catalog services
	dataCatalogRepo := dataCatalog_repo.NewRepository(db.DB)
	dataCatalogSvc := dataCatalog_service.NewService(dataCatalogRepo, nil)
	dataCatalogH = dataCatalog_handler.NewHandler(dataCatalogSvc)
}

// wireWave7BatchModules wires Wave 7: P2 batch modules (alert-breaker, apm,
// bi-dashboard, canary-analysis, canary-traffic, cross-domain, decision-explanation,
// degradation, dependency-coordination, dual-engine, env-lifecycle, env-profile,
// global-param, integration, maintenance-window, message-queue, metrics,
// multi-modal-trigger, notification-management, oci-registry, plugin-hotreload,
// process-step, progressive, queue, risk, runbook, script-library, script,
// script-version, self-service, service-catalog, service-health, service-topology,
// ticket-knowledge, topology, unified-config, vector-store, vectorize-rules,
// version-archive).
func wireWave7BatchModules(db *database.DB) {
	// Wave 7: P2 module services (batch 1-2)
	canary_trafficRepo := canary_traffic_repo.NewRepository(db.DB)
	canary_trafficSvc := canary_traffic_service.NewService(canary_trafficRepo)
	canary_trafficH = canary_traffic_handler.NewHandler(canary_trafficSvc)

	cross_domainRepo := cross_domain_repo.NewRepository(db.DB)
	cross_domainSvc := cross_domain_service.NewService(cross_domainRepo)
	cross_domainH = cross_domain_handler.NewHandler(cross_domainSvc)

	decision_explanationRepo := decision_explanation_repo.NewRepository(db.DB)
	decision_explanationSvc := decision_explanation_service.NewService(decision_explanationRepo)
	decision_explanationH = decision_explanation_handler.NewHandler(decision_explanationSvc)

	degradationRepo := degradation_repo.NewRepository(db.DB)
	degradationTriggerRepo := degradation_repo.NewTriggerRepository(db.DB)
	degradationSvc := degradation_service.NewService(degradationRepo, degradationTriggerRepo)
	degradationH = degradation_handler.NewHandler(degradationSvc)

	dependency_coordinationRepo := dependency_coordination_repo.NewRepository(db.DB)
	dependency_coordinationSvc := dependency_coordination_service.NewService(dependency_coordinationRepo)
	dependency_coordinationH = dependency_coordination_handler.NewHandler(dependency_coordinationSvc)

	dual_engineRepo := dual_engine_repo.NewRepository(db.DB)
	dual_engineSvc := dual_engine_service.NewService(dual_engineRepo)
	dual_engineH = dual_engine_handler.NewHandler(dual_engineSvc)

	env_lifecycleRepo := env_lifecycle_repo.NewRepository(db.DB)
	env_lifecycleSvc := env_lifecycle_service.NewService(env_lifecycleRepo)
	env_lifecycleH = env_lifecycle_handler.NewHandler(env_lifecycleSvc)

	env_profileRepo := env_profile_repo.NewRepository(db.DB)
	env_profileSvc := env_profile_service.NewService(env_profileRepo)
	env_profileH = env_profile_handler.NewHandler(env_profileSvc)

	global_paramRepo := global_param_repo.NewRepository(db.DB)
	global_paramSvc := global_param_service.NewService(global_paramRepo)
	global_paramH = global_param_handler.NewHandler(global_paramSvc)

	integrationRepo := integration_repo.NewRepository(db.DB)
	integrationSvc := integration_service.NewService(integrationRepo)
	integrationH = integration_handler.NewHandler(integrationSvc)

	maintenance_windowRepo := maintenance_window_repo.NewRepository(db.DB)
	maintenance_windowSvc := maintenance_window_service.NewService(maintenance_windowRepo)
	maintenance_windowH = maintenance_window_handler.NewHandler(maintenance_windowSvc)

	message_queueRepo := message_queue_repo.NewRepository(db.DB)
	message_queueSvc := message_queue_service.NewService(message_queueRepo)
	message_queueH = message_queue_handler.NewHandler(message_queueSvc)

	metricsRepo := metrics_repo.NewRepository(db.DB)
	metricsSvc := metrics_service.NewService(metricsRepo)
	metricsH = metrics_handler.NewHandler(metricsSvc)

	multi_modal_triggerRepo := multi_modal_trigger_repo.NewRepository(db.DB)
	multi_modal_triggerSvc := multi_modal_trigger_service.NewService(multi_modal_triggerRepo)
	multi_modal_triggerH = multi_modal_trigger_handler.NewHandler(multi_modal_triggerSvc)

	notification_mgmtRepo := notification_mgmt_repo.NewRepository(db.DB)
	notification_mgmtSvc := notification_mgmt_service.NewService(notification_mgmtRepo)
	notification_mgmtH = notification_mgmt_handler.NewHandler(notification_mgmtSvc)

	oci_registryRepo := oci_registry_repo.NewRepository(db.DB)
	oci_registrySvc := oci_registry_service.NewService(oci_registryRepo)
	oci_registryH = oci_registry_handler.NewHandler(oci_registrySvc)

	plugin_hotreloadRepo := plugin_hotreload_repo.NewRepository(db.DB)
	plugin_hotreloadSvc := plugin_hotreload_service.NewService(plugin_hotreloadRepo)
	plugin_hotreloadH = plugin_hotreload_handler.NewHandler(plugin_hotreloadSvc)

	process_stepRepo := process_step_repo.NewRepository(db.DB)
	process_stepSvc := process_step_service.NewService(process_stepRepo)
	process_stepH = process_step_handler.NewHandler(process_stepSvc)

	progessiveRepo := progessive_repo.NewRepository(db.DB)
	progessiveSvc := progessive_service.NewService(progessiveRepo)
	progessiveH = progessive_handler.NewHandler(progessiveSvc)

	queue_modRepo := queue_mod_repo.NewRepository(db.DB)
	queue_modJobRepo := queue_mod_repo.NewJobRepository(db.DB)
	queue_modSvc := queue_mod_service.NewService(queue_modRepo, queue_modJobRepo)
	queue_modH = queue_mod_handler.NewHandler(queue_modSvc)

	riskRepo := risk_repo.NewRepository(db.DB)
	riskSvc := risk_service.NewService(riskRepo)
	riskH = risk_handler.NewHandler(riskSvc)

	runbookRepo := runbook_repo.NewRepository(db.DB)
	runbookSvc := runbook_service.NewService(runbookRepo)
	runbookH = runbook_handler.NewHandler(runbookSvc)

	script_libraryRepo := script_library_repo.NewRepository(db.DB)
	script_librarySvc := script_library_service.NewService(script_libraryRepo)
	script_libraryH = script_library_handler.NewHandler(script_librarySvc)

	script_modRepo := script_mod_repo.NewRepository(db.DB)
	script_modSvc := script_mod_service.NewService(script_modRepo)
	script_modH = script_mod_handler.NewHandler(script_modSvc)

	script_versionRepo := script_version_repo.NewRepository(db.DB)
	script_versionSvc := script_version_service.NewService(script_versionRepo)
	script_versionH = script_version_handler.NewHandler(script_versionSvc)

	self_serviceRepo := self_service_repo.NewRepository(db.DB)
	self_serviceSvc := self_service_service.NewService(self_serviceRepo)
	self_serviceH = self_service_handler.NewHandler(self_serviceSvc)

	service_catalogRepo := service_catalog_repo.NewRepository(db.DB)
	service_catalogSvc := service_catalog_service.NewService(service_catalogRepo)
	service_catalogH = service_catalog_handler.NewHandler(service_catalogSvc)

	service_healthRepo := service_health_repo.NewRepository(db.DB)
	service_healthSvc := service_health_service.NewService(service_healthRepo)
	service_healthH = service_health_handler.NewHandler(service_healthSvc)

	service_topologyRepo := service_topology_repo.NewRepository(db.DB)
	service_topologySvc := service_topology_service.NewService(service_topologyRepo)
	service_topologyH = service_topology_handler.NewHandler(service_topologySvc)

	ticket_knowledgeRepo := ticket_knowledge_repo.NewRepository(db.DB)
	ticket_knowledgeSvc := ticket_knowledge_service.NewService(ticket_knowledgeRepo)
	ticket_knowledgeH = ticket_knowledge_handler.NewHandler(ticket_knowledgeSvc)

	topologyRepo := topology_repo.NewRepository(db.DB)
	topologySvc := topology_service.NewService(topologyRepo)
	topologyH = topology_handler.NewHandler(topologySvc)

	unified_configRepo := unified_config_repo.NewRepository(db.DB)
	unified_configSvc := unified_config_service.NewService(unified_configRepo)
	unified_configH = unified_config_handler.NewHandler(unified_configSvc)

	vector_storeRepo := vector_store_repo.NewRepository(db.DB)
	vector_storeSvc := vector_store_service.NewService(vector_storeRepo)
	vector_storeH = vector_store_handler.NewHandler(vector_storeSvc)

	vectorize_rulesRepo := vectorize_rules_repo.NewRepository(db.DB)
	vectorize_rulesSvc := vectorize_rules_service.NewService(vectorize_rulesRepo)
	vectorize_rulesH = vectorize_rules_handler.NewHandler(vectorize_rulesSvc)

	version_archiveRepo := version_archive_repo.NewRepository(db.DB)
	version_archiveSvc := version_archive_service.NewService(version_archiveRepo)
	version_archiveH = version_archive_handler.NewHandler(version_archiveSvc)

	// alert-breaker services
	alert_breakerRepo := alert_breaker_repo.NewRepository(db.DB)
	alert_breakerSvc := alert_breaker_service.NewService(alert_breakerRepo)
	alert_breakerH = alert_breaker_handler.NewHandler(alert_breakerSvc)

	// apm services
	apmRepo := apm_repo.NewRepository(db.DB)
	apmSvc := apm_service.NewService(apmRepo, db.DB.DB)
	apmH = apm_handler.NewHandler(apmSvc)

	// bi-dashboard services
	bi_dashboardRepo := bi_dashboard_repo.NewRepository(db.DB)
	bi_dashboardSvc := bi_dashboard_service.NewService(bi_dashboardRepo)
	bi_dashboardH = bi_dashboard_handler.NewHandler(bi_dashboardSvc)

	// canary-analysis services
	canary_analysisRepo := canary_analysis_repo.NewRepository(db.DB)
	canary_analysisSvc := canary_analysis_service.NewService(canary_analysisRepo)
	canary_analysisH = canary_analysis_handler.NewHandler(canary_analysisSvc)
}

// wireAutomationModules wires the Wave 7b-j automation modules:
// deployment-trigger, incident-action, ticket-automation.
func wireAutomationModules(db *database.DB) {
	// deployment-trigger services
	deployment_triggerRepo := deployment_trigger_repo.NewRepository(db.DB)
	deployment_triggerSvc := deployment_trigger_service.NewService(deployment_triggerRepo)
	deployment_triggerH = deployment_trigger_handler.NewHandler(deployment_triggerSvc)

	// incident-action services
	incident_actionRepo := incident_action_repo.NewRepository(db.DB)
	incident_actionSvc := incident_action_service.NewService(incident_actionRepo)
	incident_actionH = incident_action_handler.NewHandler(incident_actionSvc)

	// ticket-automation services
	ticket_automationRepo := ticket_automation_repo.NewRepository(db.DB)
	ticket_automationSvc := ticket_automation_service.NewService(ticket_automationRepo)
	ticket_automationH = ticket_automation_handler.NewHandler(ticket_automationSvc)

	// auto-exec engine (NeatLogic-style automation) — wired via wiring.go
	_ = auto_exec_repo.NewRepository(db.DB)
}

// Handler variables for blueprint_batch_wiring (moved from central wiring.go var block)
var (
	alert_breakerH           *alert_breaker_handler.Handler
	apmH                     *apm_handler.Handler
	bi_dashboardH            *bi_dashboard_handler.Handler
	billingH                 *billing_handler.Handler
	canary_analysisH         *canary_analysis_handler.Handler
	canary_trafficH          *canary_traffic_handler.Handler
	costallocH               *costalloc_handler.Handler
	cross_domainH            *cross_domain_handler.Handler
	dataCatalogH             *dataCatalog_handler.Handler
	dataLineageH             *dataLineage_handler.Handler
	decision_explanationH    *decision_explanation_handler.Handler
	degradationH             *degradation_handler.Handler
	dependency_coordinationH *dependency_coordination_handler.Handler
	deployment_triggerH      *deployment_trigger_handler.Handler
	dual_engineH             *dual_engine_handler.Handler
	efficiencyH              *efficiency_handler.Handler
	env_lifecycleH           *env_lifecycle_handler.Handler
	env_profileH             *env_profile_handler.Handler
	global_paramH            *global_param_handler.Handler
	incident_actionH         *incident_action_handler.Handler
	integrationH             *integration_handler.Handler
	maintenance_windowH      *maintenance_window_handler.Handler
	message_queueH           *message_queue_handler.Handler
	metricsH                 *metrics_handler.Handler
	multi_modal_triggerH     *multi_modal_trigger_handler.Handler
	notification_mgmtH       *notification_mgmt_handler.Handler
	oci_registryH            *oci_registry_handler.Handler
	plugin_hotreloadH        *plugin_hotreload_handler.Handler
	process_stepH            *process_step_handler.Handler
	progessiveH              *progessive_handler.Handler
	queue_modH               *queue_mod_handler.Handler
	riskH                    *risk_handler.Handler
	runbookH                 *runbook_handler.Handler
	script_libraryH          *script_library_handler.Handler
	script_modH              *script_mod_handler.Handler
	script_versionH          *script_version_handler.Handler
	self_serviceH            *self_service_handler.Handler
	service_catalogH         *service_catalog_handler.Handler
	service_healthH          *service_health_handler.Handler
	service_topologyH        *service_topology_handler.Handler
	ticket_automationH       *ticket_automation_handler.Handler
	ticket_knowledgeH        *ticket_knowledge_handler.Handler
	topologyH                *topology_handler.Handler
	unified_configH          *unified_config_handler.Handler
	vector_storeH            *vector_store_handler.Handler
	vectorize_rulesH         *vectorize_rules_handler.Handler
	version_archiveH         *version_archive_handler.Handler
)
