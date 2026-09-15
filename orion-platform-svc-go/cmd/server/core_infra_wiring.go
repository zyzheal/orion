package main

import (
	"os"

	"orion/go-common/pkg/database"
	"time"

	"go.uber.org/zap"
	"orion/platform-svc-go/internal/inception/engine"

	ag_handler "orion/platform-svc-go/internal/api-governance/handler"
	ag_repo "orion/platform-svc-go/internal/api-governance/repository"
	ag_service "orion/platform-svc-go/internal/api-governance/service"
	ff_handler "orion/platform-svc-go/internal/feature-flag/handler"
	ff_repo "orion/platform-svc-go/internal/feature-flag/repository"
	ff_service "orion/platform-svc-go/internal/feature-flag/service"
	fed_repo "orion/platform-svc-go/internal/federation/repository"
	role_handler "orion/platform-svc-go/internal/role/handler"
	role_repo "orion/platform-svc-go/internal/role/repository"
	role_service "orion/platform-svc-go/internal/role/service"

	artifact_handler "orion/platform-svc-go/internal/artifact/handler"
	artifact_repo "orion/platform-svc-go/internal/artifact/repository"
	artifact_service "orion/platform-svc-go/internal/artifact/service"
	fed_handler "orion/platform-svc-go/internal/federation/handler"
	fed_service "orion/platform-svc-go/internal/federation/service"
	inc_repo "orion/platform-svc-go/internal/inception/repository"
	inc_service "orion/platform-svc-go/internal/inception/service"
	plugin_handler "orion/platform-svc-go/internal/plugin/handler"
	plugin_repo "orion/platform-svc-go/internal/plugin/repository"
	plugin_service "orion/platform-svc-go/internal/plugin/service"

	env_handler "orion/platform-svc-go/internal/environment/handler"
	env_repo "orion/platform-svc-go/internal/environment/repository"
	env_service "orion/platform-svc-go/internal/environment/service"
	inc_handler "orion/platform-svc-go/internal/inception/handler"
	policy_handler "orion/platform-svc-go/internal/policy/handler"
	policy_repo "orion/platform-svc-go/internal/policy/repository"
	policy_service "orion/platform-svc-go/internal/policy/service"
	proj_handler "orion/platform-svc-go/internal/project/handler"
	proj_repo "orion/platform-svc-go/internal/project/repository"
	proj_service "orion/platform-svc-go/internal/project/service"

	productline_handler "orion/platform-svc-go/internal/product-line/handler"
	productline_repo "orion/platform-svc-go/internal/product-line/repository"
	productline_service "orion/platform-svc-go/internal/product-line/service"
	projectmember_handler "orion/platform-svc-go/internal/project-member/handler"
	projectmember_repo "orion/platform-svc-go/internal/project-member/repository"
	projectmember_service "orion/platform-svc-go/internal/project-member/service"
	subapp_repo "orion/platform-svc-go/internal/subapp/repository"
	team_handler "orion/platform-svc-go/internal/team/handler"
	team_repo "orion/platform-svc-go/internal/team/repository"
	team_service "orion/platform-svc-go/internal/team/service"

	capability_handler "orion/platform-svc-go/internal/capability/handler"
	capability_repo "orion/platform-svc-go/internal/capability/repository"
	capability_service "orion/platform-svc-go/internal/capability/service"
	chaos_handler "orion/platform-svc-go/internal/chaos/handler"
	chaos_repo "orion/platform-svc-go/internal/chaos/repository"
	chaos_service "orion/platform-svc-go/internal/chaos/service"
	cron_handler "orion/platform-svc-go/internal/cron/handler"
	cron_repo "orion/platform-svc-go/internal/cron/repository"
	cron_service "orion/platform-svc-go/internal/cron/service"
	developerportal_handler "orion/platform-svc-go/internal/developer-portal/handler"
	developerportal_repo "orion/platform-svc-go/internal/developer-portal/repository"
	developerportal_service "orion/platform-svc-go/internal/developer-portal/service"
	gatewaydynamic_handler "orion/platform-svc-go/internal/gateway-dynamic/handler"
	gatewaydynamic_repo "orion/platform-svc-go/internal/gateway-dynamic/repository"
	gatewaydynamic_service "orion/platform-svc-go/internal/gateway-dynamic/service"
	iac_handler "orion/platform-svc-go/internal/iac/handler"
	iac_repo "orion/platform-svc-go/internal/iac/repository"
	iac_service "orion/platform-svc-go/internal/iac/service"
	infra_handler "orion/platform-svc-go/internal/infrastructure/handler"
	infra_repo "orion/platform-svc-go/internal/infrastructure/repository"
	infra_service "orion/platform-svc-go/internal/infrastructure/service"
	internallibrary_handler "orion/platform-svc-go/internal/internal-library/handler"
	internallibrary_repo "orion/platform-svc-go/internal/internal-library/repository"
	internallibrary_service "orion/platform-svc-go/internal/internal-library/service"
	jobsource_handler "orion/platform-svc-go/internal/job-source/handler"
	jobsource_repo "orion/platform-svc-go/internal/job-source/repository"
	jobsource_service "orion/platform-svc-go/internal/job-source/service"
	pageregistry_handler "orion/platform-svc-go/internal/page-registry/handler"
	pageregistry_repo "orion/platform-svc-go/internal/page-registry/repository"
	pageregistry_service "orion/platform-svc-go/internal/page-registry/service"
	serviceregistry_handler "orion/platform-svc-go/internal/service-registry/handler"
	serviceregistry_repo "orion/platform-svc-go/internal/service-registry/repository"
	serviceregistry_service "orion/platform-svc-go/internal/service-registry/service"
	sprint_handler "orion/platform-svc-go/internal/sprint/handler"
	sprint_repo "orion/platform-svc-go/internal/sprint/repository"
	sprint_service "orion/platform-svc-go/internal/sprint/service"
	subapp_handler "orion/platform-svc-go/internal/subapp/handler"
	subapp_service "orion/platform-svc-go/internal/subapp/service"
	workbench_handler "orion/platform-svc-go/internal/workbench/handler"
	workbench_repo "orion/platform-svc-go/internal/workbench/repository"
	workbench_service "orion/platform-svc-go/internal/workbench/service"

	// handler-registry, i18n, serverless, multi-cloud (infrastructure modules)
	handlerregistry_handler "orion/platform-svc-go/internal/handler-registry/handler"
	handlerregistry_repo "orion/platform-svc-go/internal/handler-registry/repository"
	handlerregistry_service "orion/platform-svc-go/internal/handler-registry/service"
	i18n_handler "orion/platform-svc-go/internal/i18n/handler"
	i18n_repo "orion/platform-svc-go/internal/i18n/repository"
	i18n_service "orion/platform-svc-go/internal/i18n/service"
	multicloud_handler "orion/platform-svc-go/internal/multi-cloud/handler"
	multicloud_repo "orion/platform-svc-go/internal/multi-cloud/repository"
	multicloud_service "orion/platform-svc-go/internal/multi-cloud/service"
	serverless_handler "orion/platform-svc-go/internal/serverless/handler"
	serverless_repo "orion/platform-svc-go/internal/serverless/repository"
	serverless_service "orion/platform-svc-go/internal/serverless/service"

	// Observability modules: cmdb, monitoring, alert, artifact-ops, config, session, api-key, eventbus, event-trigger, hook-chain
	cmdb_handler "orion/platform-svc-go/internal/cmdb/handler"
	cmdb_repo "orion/platform-svc-go/internal/cmdb/repository"
	cmdb_service "orion/platform-svc-go/internal/cmdb/service"
	monitoring_handler "orion/platform-svc-go/internal/monitoring/handler"
	monitoring_repo "orion/platform-svc-go/internal/monitoring/repository"
	monitoring_service "orion/platform-svc-go/internal/monitoring/service"

	alert_handler "orion/platform-svc-go/internal/alert/handler"
	alert_repo "orion/platform-svc-go/internal/alert/repository"
	alert_service "orion/platform-svc-go/internal/alert/service"
	apikey_handler "orion/platform-svc-go/internal/api-key/handler"
	apikey_repo "orion/platform-svc-go/internal/api-key/repository"
	apikey_service "orion/platform-svc-go/internal/api-key/service"
	artifactops_handler "orion/platform-svc-go/internal/artifact-ops/handler"
	artifactops_repo "orion/platform-svc-go/internal/artifact-ops/repository"
	artifactops_service "orion/platform-svc-go/internal/artifact-ops/service"
	config_handler "orion/platform-svc-go/internal/config/handler"
	config_repo "orion/platform-svc-go/internal/config/repository"
	config_service "orion/platform-svc-go/internal/config/service"
	trigger_handler "orion/platform-svc-go/internal/event-trigger/handler"
	trigger_repo "orion/platform-svc-go/internal/event-trigger/repository"
	trigger_service "orion/platform-svc-go/internal/event-trigger/service"
	eventbus_handler "orion/platform-svc-go/internal/eventbus/handler"
	eventbus_repo "orion/platform-svc-go/internal/eventbus/repository"
	eventbus_service "orion/platform-svc-go/internal/eventbus/service"
	graph_handler "orion/platform-svc-go/internal/graph/handler"
	graph_repo "orion/platform-svc-go/internal/graph/repository"
	graph_service "orion/platform-svc-go/internal/graph/service"
	hook_handler "orion/platform-svc-go/internal/hook-chain/handler"
	hook_repo "orion/platform-svc-go/internal/hook-chain/repository"
	hook_service "orion/platform-svc-go/internal/hook-chain/service"
	session_handler "orion/platform-svc-go/internal/session/handler"
	session_repo "orion/platform-svc-go/internal/session/repository"
	session_service "orion/platform-svc-go/internal/session/service"
)

// wireCoreModules wires the core platform modules: feature-flag, role,
// api-governance, federation, artifact, plugin, inception, environment,
// policy, and the foundational project/team organization modules.
//
// Each module follows the Repo → Service → Handler pattern.
func wireCoreModules(db *database.DB) {
	// Feature-flag services
	ffRepo := ff_repo.NewRepository(db.DB)
	ffSvc := ff_service.NewService(ffRepo)
	ffH = ff_handler.NewHandler(ffSvc)

	// Role services
	roleRepo := role_repo.NewRepository(db.DB)
	roleSvc := role_service.NewService(roleRepo)
	roleH = role_handler.NewHandler(roleSvc)

	// API Governance services
	agRepo := ag_repo.NewRepository(db.DB)
	agSvc := ag_service.NewService(agRepo)
	agH = ag_handler.NewHandler(agSvc)

	// Federation services
	fedRepo := fed_repo.NewRepository(db.DB)
	fedSvc := fed_service.NewService(fedRepo)
	fedH = fed_handler.NewHandler(fedSvc)

	// Artifact services
	artifactRepo := artifact_repo.NewRepository(db.DB)
	artifactSvc := artifact_service.NewService(artifactRepo)
	artifactH = artifact_handler.NewHandler(artifactSvc)

	// Plugin services
	pluginRepo := plugin_repo.NewRepository(db.DB)
	pluginSvc := plugin_service.NewService(pluginRepo)
	pluginH = plugin_handler.NewHandler(pluginSvc)

	// Inception services.
	// When INCEPTION_ENGINE_URL is set we wire a live engine client so
	// CreateAudit actually submits SQL to Inception for checking / execution.
	// When unset the service runs in local-only mode: audit records are
	// persisted as "pending" and operators can trigger SubmitToEngine later
	// once the env var is configured.
	incRepo := inc_repo.NewRepository(db.DB)
	var incEngine inc_service.EngineClient
	if url := os.Getenv("INCEPTION_ENGINE_URL"); url != "" {
		apiKey := os.Getenv("INCEPTION_ENGINE_API_KEY")
		var timeout time.Duration
		if ms := os.Getenv("INCEPTION_ENGINE_TIMEOUT_MS"); ms != "" {
			if v, err := time.ParseDuration(ms + "ms"); err == nil {
				timeout = v
			}
		}
		incEngine = engine.New(engine.Config{
			BaseURL: url,
			APIKey:  apiKey,
			Timeout: timeout,
		})
	}
	incSvc := inc_service.NewService(incRepo, incEngine)
	incH = inc_handler.NewHandler(incSvc)

	// Environment services
	envRepo := env_repo.NewRepository(db.DB)
	envSvc := env_service.NewService(envRepo)
	envH = env_handler.NewHandler(envSvc)

	// Policy services
	policyRepo := policy_repo.NewRepository(db.DB)
	policySvc := policy_service.NewService(policyRepo)
	policyH = policy_handler.NewHandler(policySvc)

	// Project services
	projRepo := proj_repo.NewRepository(db.DB)
	projSvc := proj_service.NewService(projRepo)
	projH = proj_handler.NewHandler(projSvc)

	// project-member services
	projectmemberRepo := projectmember_repo.NewRepository(db.DB)
	projectmemberSvc := projectmember_service.NewService(projectmemberRepo)
	projectmemberH = projectmember_handler.NewHandler(projectmemberSvc)

	// product-line services
	productlineRepo := productline_repo.NewRepository(db.DB)
	productlineSvc := productline_service.NewService(productlineRepo)
	productlineH = productline_handler.NewHandler(productlineSvc)

	// team services
	teamRepo := team_repo.NewRepository(db.DB)
	teamSvc := team_service.NewService(teamRepo)
	teamH = team_handler.NewHandler(teamSvc)

	// subapp services
	subappRepo := subapp_repo.NewRepository(db.DB)
	subappSvc := subapp_service.NewService(subappRepo)
	subappH = subapp_handler.NewHandler(subappSvc)

	// workbench services
	workbenchRepo := workbench_repo.NewRepository(db.DB)
	workbenchSvc := workbench_service.NewService(workbenchRepo)
	workbenchH = workbench_handler.NewHandler(workbenchSvc)

	// sprint services
	sprintRepo := sprint_repo.NewRepository(db.DB)
	sprintSvc := sprint_service.NewService(sprintRepo)
	sprintH = sprint_handler.NewHandler(sprintSvc)

	// internal-library services
	internallibraryRepo := internallibrary_repo.NewRepository(db.DB)
	internallibrarySvc := internallibrary_service.NewService(internallibraryRepo)
	internallibraryH = internallibrary_handler.NewHandler(internallibrarySvc)

	// developer-portal services
	developerportalRepo := developerportal_repo.NewRepository(db.DB)
	developerportalSvc := developerportal_service.NewService(developerportalRepo)
	developerportalH = developerportal_handler.NewHandler(developerportalSvc)

	// service-registry services
	serviceregistryRepo := serviceregistry_repo.NewRepository(db.DB)
	serviceregistrySvc := serviceregistry_service.NewService(serviceregistryRepo)
	serviceregistryH = serviceregistry_handler.NewHandler(serviceregistrySvc)

	// page-registry services
	pageregistryRepo := pageregistry_repo.NewRepository(db.DB)
	pageregistrySvc := pageregistry_service.NewService(pageregistryRepo)
	pageregistryH = pageregistry_handler.NewHandler(pageregistrySvc)
}

// wireInfrastructureModules wires infrastructure-related modules:
// capability, chaos, infrastructure, iac, cron, gateway-dynamic (incl. gray release),
// handler-registry, i18n, serverless, multicloud, job-source.
func wireInfrastructureModules(db *database.DB, logger *zap.Logger) {
	// capability services
	capabilityRepo := capability_repo.NewRepository(db.DB)
	capabilitySvc := capability_service.NewService(capabilityRepo)
	capabilityH = capability_handler.NewHandler(capabilitySvc)

	// chaos services
	chaosRepo := chaos_repo.NewRepository(db.DB)
	chaosSvc := chaos_service.NewService(chaosRepo)
	chaosH = chaos_handler.NewHandler(chaosSvc)

	// infrastructure services
	infraRepo := infra_repo.NewRepository(db.DB)
	infraSvc := infra_service.NewService(infraRepo)
	infraH = infra_handler.NewHandler(infraSvc)

	// iac services
	iacRepo := iac_repo.NewRepository(db.DB)
	iacSvc := iac_service.NewService(iacRepo)
	iacH = iac_handler.NewHandler(iacSvc)

	// cron services
	cronRepo := cron_repo.NewRepository(db.DB)
	cronSvc := cron_service.NewService(cronRepo)
	cronH = cron_handler.NewHandler(cronSvc)

	// job-source services
	jobsourceRepo := jobsource_repo.NewRepository(db.DB)
	jobsourceSvc := jobsource_service.NewService(jobsourceRepo, logger)
	jobsourceH = jobsource_handler.NewHandler(jobsourceSvc)

	// gateway-dynamic services
	gatewaydynamicRepo := gatewaydynamic_repo.NewRepository(db.DB)
	gatewaydynamicSvc := gatewaydynamic_service.NewService(gatewaydynamicRepo)
	gatewaydynamicH = gatewaydynamic_handler.NewHandler(gatewaydynamicSvc)

	// gateway-dynamic gray release services (P0-4 Gateway Gray)
	gdGrayRepo := gatewaydynamic_repo.NewGrayReleaseRepository(db.DB)
	gdGraySvc := gatewaydynamic_service.NewGrayReleaseService(gdGrayRepo, nil)
	gdGrayH = gatewaydynamic_handler.NewGrayReleaseHandler(gdGraySvc)

	// handler-registry services
	handlerregistryRepo := handlerregistry_repo.NewRepository(db.DB)
	handlerregistrySvc := handlerregistry_service.NewService(handlerregistryRepo)
	handlerregistryH = handlerregistry_handler.NewHandler(handlerregistrySvc)

	// i18n services
	i18nRepo := i18n_repo.NewRepository(db.DB)
	i18nSvc := i18n_service.NewService(i18nRepo)
	i18nH = i18n_handler.NewHandler(i18nSvc)

	// serverless services
	serverlessRepo := serverless_repo.NewRepository(db.DB)
	serverlessSvc := serverless_service.NewService(serverlessRepo)
	serverlessH = serverless_handler.NewHandler(serverlessSvc)

	multicloudRepo := multicloud_repo.NewRepository(db.DB)
	multicloudSvc := multicloud_service.NewService(multicloudRepo)
	multicloudH = multicloud_handler.NewHandler(multicloudSvc)
}

// wireObservabilityModules wires the observability & operational modules:
// cmdb, monitoring, alert, artifact-ops, config, session, api-key,
// eventbus, event-trigger, hook-chain.
func wireObservabilityModules(db *database.DB) {
	// cmdb services
	cmdbRepo := cmdb_repo.NewRepository(db.DB)
	cmdbSvc := cmdb_service.NewService(cmdbRepo)
	cmdbH = cmdb_handler.NewHandler(cmdbSvc)

	// monitoring services
	monitoringRepo := monitoring_repo.NewRepository(db.DB)
	monitoringSvc := monitoring_service.NewService(monitoringRepo)
	monitoringH = monitoring_handler.NewHandler(monitoringSvc)

	// graph services
	graphNodeRepo := graph_repo.NewGraphNodeRepository(db.DB)
	graphRelRepo := graph_repo.NewGraphRelationshipRepository(db.DB)
	graphSvc := graph_service.NewService(graphNodeRepo, graphRelRepo)
	graphH = graph_handler.NewHandler(graphSvc)

	// alert services
	alertRepo := alert_repo.NewRepository(db.DB)
	alertSvc := alert_service.NewService(alertRepo, db.DB)
	alertH = alert_handler.NewHandler(alertSvc)

	// artifact-ops services
	artifactopsRepo := artifactops_repo.NewRepository(db.DB)
	artifactopsSvc := artifactops_service.NewService(artifactopsRepo, db.DB)
	artifactopsH = artifactops_handler.NewHandler(artifactopsSvc)

	// config services
	configRepo := config_repo.NewRepository(db.DB)
	configSvc := config_service.NewService(configRepo)
	configH = config_handler.NewHandler(configSvc)

	// session services
	sessionRepo := session_repo.NewRepository(db.DB)
	sessionSvc := session_service.NewService(sessionRepo, 72*time.Hour)
	sessionH = session_handler.NewHandler(sessionSvc)

	// api-key services
	apikeyRepo := apikey_repo.NewRepository(db.DB)
	apikeySvc := apikey_service.NewService(apikeyRepo)
	apikeyH = apikey_handler.NewHandler(apikeySvc)

	// eventbus services
	eventbusRepo := eventbus_repo.NewRepository(db.DB)
	eventbusSvc := eventbus_service.NewService(eventbusRepo)
	eventbusH = eventbus_handler.NewHandler(eventbusSvc)

	// event-trigger services
	triggerRepo := trigger_repo.NewRepository(db.DB)
	triggerSvc := trigger_service.NewService(triggerRepo)
	triggerH = trigger_handler.NewHandler(triggerSvc)

	// hook-chain services
	hookRepo := hook_repo.NewRepository(db.DB)
	hookSvc := hook_service.NewService(hookRepo)
	hookH = hook_handler.NewHandler(hookSvc)

	// self-healing services
	// NewSelfHealingRepository requires (*repository.DB, *zap.Logger) where repository.DB
	// wraps pgxpool. Currently no pgxpool handle is wired at this layer, so skip.
}

// Handler variables for core_infra_wiring (moved from central wiring.go var block)
var (
	agH              *ag_handler.Handler
	alertH           *alert_handler.Handler
	apikeyH          *apikey_handler.Handler
	artifactH        *artifact_handler.Handler
	artifactopsH     *artifactops_handler.Handler
	capabilityH      *capability_handler.Handler
	chaosH           *chaos_handler.Handler
	cmdbH            *cmdb_handler.Handler
	configH          *config_handler.Handler
	cronH            *cron_handler.Handler
	developerportalH *developerportal_handler.Handler
	envH             *env_handler.Handler
	eventbusH        *eventbus_handler.Handler
	fedH             *fed_handler.Handler
	ffH              *ff_handler.Handler
	gatewaydynamicH  *gatewaydynamic_handler.Handler
	gdGrayH          *gatewaydynamic_handler.GrayReleaseHandler
	graphH           *graph_handler.Handler
	handlerregistryH *handlerregistry_handler.Handler
	hookH            *hook_handler.Handler
	i18nH            *i18n_handler.Handler
	iacH             *iac_handler.Handler
	incH             *inc_handler.Handler
	infraH           *infra_handler.Handler
	internallibraryH *internallibrary_handler.Handler
	jobsourceH       *jobsource_handler.Handler
	monitoringH      *monitoring_handler.Handler
	multicloudH      *multicloud_handler.Handler
	pageregistryH    *pageregistry_handler.Handler
	pluginH          *plugin_handler.Handler
	policyH          *policy_handler.Handler
	productlineH     *productline_handler.Handler
	projectmemberH   *projectmember_handler.Handler
	projH            *proj_handler.Handler
	roleH            *role_handler.Handler
	serverlessH      *serverless_handler.Handler
	serviceregistryH *serviceregistry_handler.Handler
	sessionH         *session_handler.Handler
	sprintH          *sprint_handler.Handler
	subappH          *subapp_handler.Handler
	teamH            *team_handler.Handler
	triggerH         *trigger_handler.Handler
	workbenchH       *workbench_handler.Handler
)
