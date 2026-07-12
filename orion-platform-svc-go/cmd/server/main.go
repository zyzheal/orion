package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"


	ff_config "orion/platform-svc-go/internal/feature-flag/config"
	ff_handler "orion/platform-svc-go/internal/feature-flag/handler"
	ff_repo "orion/platform-svc-go/internal/feature-flag/repository"
	ff_service "orion/platform-svc-go/internal/feature-flag/service"

	artifact_handler "orion/platform-svc-go/internal/artifact/handler"
	artifact_repo "orion/platform-svc-go/internal/artifact/repository"
	artifact_service "orion/platform-svc-go/internal/artifact/service"

	fed_handler "orion/platform-svc-go/internal/federation/handler"
	fed_repo "orion/platform-svc-go/internal/federation/repository"
	fed_service "orion/platform-svc-go/internal/federation/service"

	plugin_handler "orion/platform-svc-go/internal/plugin/handler"
	plugin_repo "orion/platform-svc-go/internal/plugin/repository"
	plugin_service "orion/platform-svc-go/internal/plugin/service"

	inc_handler "orion/platform-svc-go/internal/inception/handler"
	inc_repo "orion/platform-svc-go/internal/inception/repository"
	inc_service "orion/platform-svc-go/internal/inception/service"

	policy_handler "orion/platform-svc-go/internal/policy/handler"
	policy_repo "orion/platform-svc-go/internal/policy/repository"
	policy_service "orion/platform-svc-go/internal/policy/service"

	env_handler "orion/platform-svc-go/internal/environment/handler"
	env_repo "orion/platform-svc-go/internal/environment/repository"
	env_service "orion/platform-svc-go/internal/environment/service"

	proj_handler "orion/platform-svc-go/internal/project/handler"
	proj_repo "orion/platform-svc-go/internal/project/repository"
	proj_service "orion/platform-svc-go/internal/project/service"
	projectmember_handler "orion/platform-svc-go/internal/project-member/handler"
	projectmember_repo "orion/platform-svc-go/internal/project-member/repository"
	projectmember_service "orion/platform-svc-go/internal/project-member/service"
	productline_handler "orion/platform-svc-go/internal/product-line/handler"
	productline_repo "orion/platform-svc-go/internal/product-line/repository"
	productline_service "orion/platform-svc-go/internal/product-line/service"
	team_handler "orion/platform-svc-go/internal/team/handler"
	team_repo "orion/platform-svc-go/internal/team/repository"
	team_service "orion/platform-svc-go/internal/team/service"
	subapp_handler "orion/platform-svc-go/internal/subapp/handler"
	subapp_repo "orion/platform-svc-go/internal/subapp/repository"
	subapp_service "orion/platform-svc-go/internal/subapp/service"
	workbench_handler "orion/platform-svc-go/internal/workbench/handler"
	workbench_repo "orion/platform-svc-go/internal/workbench/repository"
	workbench_service "orion/platform-svc-go/internal/workbench/service"
	sprint_handler "orion/platform-svc-go/internal/sprint/handler"
	sprint_repo "orion/platform-svc-go/internal/sprint/repository"
	sprint_service "orion/platform-svc-go/internal/sprint/service"
	internallibrary_handler "orion/platform-svc-go/internal/internal-library/handler"
	internallibrary_repo "orion/platform-svc-go/internal/internal-library/repository"
	internallibrary_service "orion/platform-svc-go/internal/internal-library/service"
	developerportal_handler "orion/platform-svc-go/internal/developer-portal/handler"
	developerportal_repo "orion/platform-svc-go/internal/developer-portal/repository"
	developerportal_service "orion/platform-svc-go/internal/developer-portal/service"
	serviceregistry_handler "orion/platform-svc-go/internal/service-registry/handler"
	serviceregistry_repo "orion/platform-svc-go/internal/service-registry/repository"
	serviceregistry_service "orion/platform-svc-go/internal/service-registry/service"
	pageregistry_handler "orion/platform-svc-go/internal/page-registry/handler"
	pageregistry_repo "orion/platform-svc-go/internal/page-registry/repository"
	pageregistry_service "orion/platform-svc-go/internal/page-registry/service"
	capability_handler "orion/platform-svc-go/internal/capability/handler"
	capability_repo "orion/platform-svc-go/internal/capability/repository"
	capability_service "orion/platform-svc-go/internal/capability/service"
	chaos_handler "orion/platform-svc-go/internal/chaos/handler"
	chaos_repo "orion/platform-svc-go/internal/chaos/repository"
	chaos_service "orion/platform-svc-go/internal/chaos/service"
	cron_handler "orion/platform-svc-go/internal/cron/handler"
	cron_repo "orion/platform-svc-go/internal/cron/repository"
	cron_service "orion/platform-svc-go/internal/cron/service"
	infra_handler "orion/platform-svc-go/internal/infrastructure/handler"
	infra_repo "orion/platform-svc-go/internal/infrastructure/repository"
	infra_service "orion/platform-svc-go/internal/infrastructure/service"

	iac_handler "orion/platform-svc-go/internal/iac/handler"
	iac_repo "orion/platform-svc-go/internal/iac/repository"
	iac_service "orion/platform-svc-go/internal/iac/service"
	gatewaydynamic_handler "orion/platform-svc-go/internal/gateway-dynamic/handler"
	gatewaydynamic_repo "orion/platform-svc-go/internal/gateway-dynamic/repository"
	gatewaydynamic_service "orion/platform-svc-go/internal/gateway-dynamic/service"
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

	cmdb_handler "orion/platform-svc-go/internal/cmdb/handler"
	cmdb_repo "orion/platform-svc-go/internal/cmdb/repository"
	cmdb_service "orion/platform-svc-go/internal/cmdb/service"
	monitoring_handler "orion/platform-svc-go/internal/monitoring/handler"
	monitoring_repo "orion/platform-svc-go/internal/monitoring/repository"
	monitoring_service "orion/platform-svc-go/internal/monitoring/service"
	alert_handler "orion/platform-svc-go/internal/alert/handler"
	alert_repo "orion/platform-svc-go/internal/alert/repository"
	alert_service "orion/platform-svc-go/internal/alert/service"


	artifactops_handler "orion/platform-svc-go/internal/artifact-ops/handler"
	artifactops_repo "orion/platform-svc-go/internal/artifact-ops/repository"
	artifactops_service "orion/platform-svc-go/internal/artifact-ops/service"

	config_handler "orion/platform-svc-go/internal/config/handler"
	config_repo "orion/platform-svc-go/internal/config/repository"
	config_service "orion/platform-svc-go/internal/config/service"

	approval_handler "orion/platform-svc-go/internal/approval/handler"
	approval_repo "orion/platform-svc-go/internal/approval/repository"
	approval_service "orion/platform-svc-go/internal/approval/service"

	chatops_handler "orion/platform-svc-go/internal/chatops/handler"
	chatops_repo "orion/platform-svc-go/internal/chatops/repository"
	chatops_service "orion/platform-svc-go/internal/chatops/service"

	code_repo_handler "orion/platform-svc-go/internal/code-repo/handler"
	code_repo_repo "orion/platform-svc-go/internal/code-repo/repository"
	code_repo_service "orion/platform-svc-go/internal/code-repo/service"


	incident_handler "orion/platform-svc-go/internal/incident/handler"
	incident_repo "orion/platform-svc-go/internal/incident/repository"
	incident_service "orion/platform-svc-go/internal/incident/service"

	audit_handler "orion/platform-svc-go/internal/audit/handler"
	audit_repo "orion/platform-svc-go/internal/audit/repository"
	audit_service "orion/platform-svc-go/internal/audit/service"

	build_env_handler "orion/platform-svc-go/internal/build-env/handler"
	build_env_repo "orion/platform-svc-go/internal/build-env/repository"
	build_env_service "orion/platform-svc-go/internal/build-env/service"

	dba_handler "orion/platform-svc-go/internal/dba/handler"
	dba_repo "orion/platform-svc-go/internal/dba/repository"
	dba_service "orion/platform-svc-go/internal/dba/service"

	deploy_handler "orion/platform-svc-go/internal/deploy/handler"
	deploy_repo "orion/platform-svc-go/internal/deploy/repository"
	deploy_service "orion/platform-svc-go/internal/deploy/service"

	digital_twin_handler "orion/platform-svc-go/internal/digital-twin/handler"
	digital_twin_repo "orion/platform-svc-go/internal/digital-twin/repository"
	digital_twin_service "orion/platform-svc-go/internal/digital-twin/service"

	finops_v2_handler "orion/platform-svc-go/internal/finops-v2/handler"
	finops_v2_repo "orion/platform-svc-go/internal/finops-v2/repository"
	finops_v2_service "orion/platform-svc-go/internal/finops-v2/service"

	knowledge_handler "orion/platform-svc-go/internal/knowledge/handler"
	knowledge_repo "orion/platform-svc-go/internal/knowledge/repository"
	knowledge_service "orion/platform-svc-go/internal/knowledge/service"

	security_compliance_handler "orion/platform-svc-go/internal/security-compliance/handler"
	security_compliance_repo "orion/platform-svc-go/internal/security-compliance/repository"
	security_compliance_service "orion/platform-svc-go/internal/security-compliance/service"

	tenant_handler "orion/platform-svc-go/internal/tenant/handler"
	tenant_repo "orion/platform-svc-go/internal/tenant/repository"
	tenant_service "orion/platform-svc-go/internal/tenant/service"
	change_handler "orion/platform-svc-go/internal/change/handler"
	change_repo "orion/platform-svc-go/internal/change/repository"
	change_service "orion/platform-svc-go/internal/change/service"
	skill_handler "orion/platform-svc-go/internal/skill/handler"
	skill_service "orion/platform-svc-go/internal/skill/service"
	sla_handler "orion/platform-svc-go/internal/sla/handler"
	sla_repo "orion/platform-svc-go/internal/sla/repository"
	sla_service "orion/platform-svc-go/internal/sla/service"
	visor_handler "orion/platform-svc-go/internal/visor-exec/handler"
	visor_repo "orion/platform-svc-go/internal/visor-exec/repository"
	visor_service "orion/platform-svc-go/internal/visor-exec/service"


	ticketing_handler "orion/platform-svc-go/internal/ticketing/handler"
	ticketing_repo "orion/platform-svc-go/internal/ticketing/repository"
	ticketing_service "orion/platform-svc-go/internal/ticketing/service"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	"orion/go-common/pkg/otel"
	redis "orion/go-common/pkg/redis"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-platform-svc"))
	defer logger.Sync()

	ffCfg := ff_config.Load()

	// OpenTelemetry tracing (0.1)
	if otelShutdown, err := otel.Init(otel.Config{
		ServiceName: "orion-platform-svc",
		Endpoint:    ffCfg.OTELExporterEndpoint,
		Insecure:    ffCfg.OTELInsecure,
	}); err != nil {
		logger.Warn("OpenTelemetry init failed (tracing disabled)", zap.Error(err))
	} else if otelShutdown != nil {
		defer otelShutdown(context.Background())
	}

	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		ffCfg.DBHost, ffCfg.DBPort, ffCfg.DBUser, ffCfg.DBPassword, ffCfg.DBName, ffCfg.DBSSLMode)
	dbCfg := database.DefaultConfig(dsn)

	db, err := database.Connect(context.Background(), dbCfg)
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	migrationsDir := "migrations"
	if _, err := os.Stat(migrationsDir); err == nil {
		if err := database.RunMigrations(db, migrationsDir); err != nil {
			log.Printf("warning: failed to run migrations: %v", err)
		}
	}

	rdb := redis.NewClient(redis.Config{Addr: ffCfg.RedisAddr})
	defer rdb.Close()

	// Feature-flag services
	ffRepo := ff_repo.NewRepository(db.DB)
	ffSvc := ff_service.NewService(ffRepo)
	ffH := ff_handler.NewHandler(ffSvc)

	// Federation services
	fedRepo := fed_repo.NewRepository(db.DB)
	fedSvc := fed_service.NewService(fedRepo)
	fedH := fed_handler.NewHandler(fedSvc)

	// Artifact services
	artifactRepo := artifact_repo.NewRepository(db.DB)
	artifactSvc := artifact_service.NewService(artifactRepo)
	artifactH := artifact_handler.NewHandler(artifactSvc)

	// Plugin services
	pluginRepo := plugin_repo.NewRepository(db.DB)
	pluginSvc := plugin_service.NewService(pluginRepo)
	pluginH := plugin_handler.NewHandler(pluginSvc)

	// Inception services
	incRepo := inc_repo.NewRepository(db.DB)
	incSvc := inc_service.NewService(incRepo)
	incH := inc_handler.NewHandler(incSvc)

	// Environment services
	envRepo := env_repo.NewRepository(db.DB)
	envSvc := env_service.NewService(envRepo)
	envH := env_handler.NewHandler(envSvc)

	// Policy services
	policyRepo := policy_repo.NewRepository(db.DB)
	policySvc := policy_service.NewService(policyRepo)
	policyH := policy_handler.NewHandler(policySvc)

	// Project services
	projRepo := proj_repo.NewRepository(db.DB)
	projSvc := proj_service.NewService(projRepo)
	projH := proj_handler.NewHandler(projSvc)

	// project-member services
	projectmemberRepo := projectmember_repo.NewRepository(db.DB)
	projectmemberSvc := projectmember_service.NewService(projectmemberRepo)
	projectmemberH := projectmember_handler.NewHandler(projectmemberSvc)

	// product-line services
	productlineRepo := productline_repo.NewRepository(db.DB)
	productlineSvc := productline_service.NewService(productlineRepo)
	productlineH := productline_handler.NewHandler(productlineSvc)

	// team services
	teamRepo := team_repo.NewRepository(db.DB)
	teamSvc := team_service.NewService(teamRepo)
	teamH := team_handler.NewHandler(teamSvc)

	// subapp services
	subappRepo := subapp_repo.NewRepository(db.DB)
	subappSvc := subapp_service.NewService(subappRepo)
	subappH := subapp_handler.NewHandler(subappSvc)

	// workbench services
	workbenchRepo := workbench_repo.NewRepository(db.DB)
	workbenchSvc := workbench_service.NewService(workbenchRepo)
	workbenchH := workbench_handler.NewHandler(workbenchSvc)

	// sprint services
	sprintRepo := sprint_repo.NewRepository(db.DB)
	sprintSvc := sprint_service.NewService(sprintRepo)
	sprintH := sprint_handler.NewHandler(sprintSvc)

	// internal-library services
	internallibraryRepo := internallibrary_repo.NewRepository(db.DB)
	internallibrarySvc := internallibrary_service.NewService(internallibraryRepo)
	internallibraryH := internallibrary_handler.NewHandler(internallibrarySvc)

	// developer-portal services
	developerportalRepo := developerportal_repo.NewRepository(db.DB)
	developerportalSvc := developerportal_service.NewService(developerportalRepo, db.DB)
	developerportalH := developerportal_handler.NewHandler(developerportalSvc)

	// service-registry services
	serviceregistryRepo := serviceregistry_repo.NewRepository(db.DB)
	serviceregistrySvc := serviceregistry_service.NewService(serviceregistryRepo)
	serviceregistryH := serviceregistry_handler.NewHandler(serviceregistrySvc)

	// page-registry services
	pageregistryRepo := pageregistry_repo.NewRepository(db.DB)
	pageregistrySvc := pageregistry_service.NewService(pageregistryRepo)
	pageregistryH := pageregistry_handler.NewHandler(pageregistrySvc)

	// capability services
	capabilityRepo := capability_repo.NewRepository(db.DB)
	capabilitySvc := capability_service.NewService(capabilityRepo)
	capabilityH := capability_handler.NewHandler(capabilitySvc)

	// chaos services
	chaosRepo := chaos_repo.NewRepository(db.DB)
	chaosSvc := chaos_service.NewService(chaosRepo)
	chaosH := chaos_handler.NewHandler(chaosSvc)

	// infrastructure services
	infraRepo := infra_repo.NewRepository(db.DB)
	infraSvc := infra_service.NewService(infraRepo)
	infraH := infra_handler.NewHandler(infraSvc)

	// iac services
	iacRepo := iac_repo.NewRepository(db.DB)
	iacSvc := iac_service.NewService(iacRepo)
	iacH := iac_handler.NewHandler(iacSvc)

	// cron services
	cronRepo := cron_repo.NewRepository(db.DB)
	cronSvc := cron_service.NewService(cronRepo)
	cronH := cron_handler.NewHandler(cronSvc)

	// gateway-dynamic services
	gatewaydynamicRepo := gatewaydynamic_repo.NewRepository(db.DB)
	gatewaydynamicSvc := gatewaydynamic_service.NewService(gatewaydynamicRepo)
	gatewaydynamicH := gatewaydynamic_handler.NewHandler(gatewaydynamicSvc)

	// handler-registry services
	handlerregistryRepo := handlerregistry_repo.NewRepository(db.DB)
	handlerregistrySvc := handlerregistry_service.NewService(handlerregistryRepo)
	handlerregistryH := handlerregistry_handler.NewHandler(handlerregistrySvc)

	// i18n services
	i18nRepo := i18n_repo.NewRepository(db.DB)
	i18nSvc := i18n_service.NewService(i18nRepo)
	i18nH := i18n_handler.NewHandler(i18nSvc)

	// multi-cloud services

	// serverless services
	serverlessRepo := serverless_repo.NewRepository(db.DB)
	serverlessSvc := serverless_service.NewService(serverlessRepo)
	serverlessH := serverless_handler.NewHandler(serverlessSvc)
	multicloudRepo := multicloud_repo.NewRepository(db.DB)
	multicloudSvc := multicloud_service.NewService(multicloudRepo)
	multicloudH := multicloud_handler.NewHandler(multicloudSvc)

	// cmdb services
	cmdbRepo := cmdb_repo.NewRepository(db.DB)
	cmdbSvc := cmdb_service.NewService(cmdbRepo)
	cmdbH := cmdb_handler.NewHandler(cmdbSvc)

	// monitoring services
	monitoringRepo := monitoring_repo.NewRepository(db.DB)
	monitoringSvc := monitoring_service.NewService(monitoringRepo)
	monitoringH := monitoring_handler.NewHandler(monitoringSvc)

	// alert services
	alertRepo := alert_repo.NewRepository(db.DB)
	alertSvc := alert_service.NewService(alertRepo, db.DB)
	alertH := alert_handler.NewHandler(alertSvc)

	// artifact-ops services
	artifactopsRepo := artifactops_repo.NewRepository(db.DB)
	artifactopsSvc := artifactops_service.NewService(artifactopsRepo, db.DB)
	artifactopsH := artifactops_handler.NewHandler(artifactopsSvc)

	// config services
	configRepo := config_repo.NewRepository(db.DB)
	configSvc := config_service.NewService(configRepo)
	configH := config_handler.NewHandler(configSvc)

	// chatops services
	chatopsRepo := chatops_repo.NewRepository(db.DB)
	chatopsSvc := chatops_service.NewService(chatopsRepo)
	chatopsH := chatops_handler.NewHandler(chatopsSvc)

	// code-repo services
	code_repoRepo := code_repo_repo.NewRepository(db.DB)
	code_repoSvc := code_repo_service.NewService(code_repoRepo, db.DB)
	code_repoH := code_repo_handler.NewHandler(code_repoSvc)

	// approval services
	approvalRepo := approval_repo.NewRepository(db.DB)
	approvalSvc := approval_service.NewService(approvalRepo)
	approvalH := approval_handler.NewHandler(approvalSvc)

	// audit services
	auditRepo := audit_repo.NewRepository(db.DB)
	auditSvc := audit_service.NewService(auditRepo)
	auditH := audit_handler.NewHandler(auditSvc)

	// incident services
	incidentRepo := incident_repo.NewRepository(db.DB)
	incidentSvc := incident_service.NewService(incidentRepo)
	incidentH := incident_handler.NewHandler(incidentSvc)
	// build-env services
	build_envRepo := build_env_repo.NewRepository(db.DB)
	build_envSvc := build_env_service.NewService(build_envRepo, db.DB.DB)
	build_envH := build_env_handler.NewHandler(build_envSvc)

	// dba services
	dbaRepo := dba_repo.NewRepository(db.DB)
	dbaSvc := dba_service.NewService(dbaRepo)
	dbaH := dba_handler.NewHandler(dbaSvc)

	// deploy services
	deployRepo := deploy_repo.NewRepository(db.DB)
	deploySvc := deploy_service.NewService(deployRepo)
	deployH := deploy_handler.NewHandler(deploySvc)

	// digital-twin services
	digital_twinRepo := digital_twin_repo.NewRepository(db.DB)
	digital_twinSvc := digital_twin_service.NewService(digital_twinRepo)
	digital_twinH := digital_twin_handler.NewHandler(digital_twinSvc)

	// finops-v2 services
	finops_v2Repo := finops_v2_repo.NewRepository(db.DB)
	finops_v2Svc := finops_v2_service.NewService(finops_v2Repo)
	finops_v2H := finops_v2_handler.NewHandler(finops_v2Svc)

	// knowledge services
	knowledgeRepo := knowledge_repo.NewRepository(db.DB.DB)
	knowledgeSvc := knowledge_service.NewService(knowledgeRepo)
	knowledgeH := knowledge_handler.NewHandler(knowledgeSvc)

	// security-compliance services
	security_complianceRepo := security_compliance_repo.NewRepository(db.DB)
	security_complianceSvc := security_compliance_service.NewService(security_complianceRepo)
	security_complianceH := security_compliance_handler.NewHandler(security_complianceSvc)

	// tenant services
	tenantRepo := tenant_repo.NewRepository(db.DB.DB)
	tenantSvc := tenant_service.NewService(tenantRepo)
	tenantH := tenant_handler.NewHandler(tenantSvc)

	// ticketing services
	ticketingRepo := ticketing_repo.NewRepository(db.DB)
	ticketingSvc := ticketing_service.NewService(ticketingRepo)
	ticketingH := ticketing_handler.NewHandler(ticketingSvc)

	// change services
	changeRepo := change_repo.NewRepository(db.DB)
	changeSvc := change_service.NewService(changeRepo)
	changeH := change_handler.NewHandler(changeSvc)

	// skill services
	skillSvc := skill_service.NewService()
	skillH := skill_handler.NewHandler(skillSvc)

	// sla services
	slaRepo := sla_repo.NewRepository(db.DB)
	slaSvc := sla_service.NewService(slaRepo)
	slaH := sla_handler.NewHandler(slaSvc)

	// visor-exec services
	visorRepo := visor_repo.NewRepository(db.DB)
	visorSvc := visor_service.NewService(visorRepo)
	visorH := visor_handler.NewHandler(visorSvc)


	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))
	rg := r.Group("/api/v1")
	rg.Use(auth.Auth(auth.AuthConfig{JWTSecret: ffCfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz", "/metrics", "/health"}}))

	// Register routes
	ffH.RegisterRoutes(rg)
	fedH.RegisterRoutes(rg)
	pluginH.RegisterRoutes(rg)
	artifactH.RegisterRoutes(rg)
	incH.RegisterRoutes(rg)
	envH.RegisterRoutes(rg)
	policyH.RegisterRoutes(rg)
	projH.RegisterRoutes(rg)
	projectmemberH.RegisterRoutes(rg)
	productlineH.RegisterRoutes(rg)
	teamH.RegisterRoutes(rg)
	subappH.RegisterRoutes(rg)
	workbenchH.RegisterRoutes(rg)
	sprintH.RegisterRoutes(rg)
	internallibraryH.RegisterRoutes(rg)
	developerportalH.RegisterRoutes(rg)
	serviceregistryH.RegisterRoutes(rg)
	pageregistryH.RegisterRoutes(rg)
	capabilityH.RegisterRoutes(rg)
	chaosH.RegisterRoutes(rg)
	infraH.RegisterRoutes(rg)
	iacH.RegisterRoutes(rg)
	cronH.RegisterRoutes(rg)
	gatewaydynamicH.RegisterRoutes(rg)
	handlerregistryH.RegisterRoutes(rg)
	i18nH.RegisterRoutes(rg)
	cmdbH.RegisterRoutes(rg)
	monitoringH.RegisterRoutes(rg)
	alertH.RegisterRoutes(rg)
	artifactopsH.RegisterRoutes(rg)
	chatopsH.RegisterRoutes(rg)
	approvalH.RegisterRoutes(rg)
	configH.RegisterRoutes(rg)
	auditH.RegisterRoutes(rg)
	incidentH.RegisterRoutes(rg)
	code_repoH.RegisterRoutes(rg)
	multicloudH.RegisterRoutes(rg)
	serverlessH.RegisterRoutes(rg)
	ticketingH.RegisterRoutes(rg)
	build_envH.RegisterRoutes(rg)
	dbaH.RegisterRoutes(rg)
	deployH.RegisterRoutes(rg)
	digital_twinH.RegisterRoutes(rg)
	finops_v2H.RegisterRoutes(rg)
	knowledgeH.RegisterRoutes(rg)
	security_complianceH.RegisterRoutes(rg)
	tenantH.RegisterRoutes(rg)
	changeH.RegisterRoutes(rg)
	skillH.RegisterRoutes(rg)
	slaH.RegisterRoutes(rg)
	visorH.RegisterRoutes(rg)

	// === Public endpoints (no auth) ===
	r.GET("/healthz", middleware.HealthCheck("orion-platform-svc"))
	r.GET("/metrics", middleware.MetricsHandler())

	// Dependency health check (0.4)
	r.GET("/health", middleware.DepHealthCheck("orion-platform-svc", map[string]middleware.HealthCheckFn{
		"database": db.Health,
		"redis":    func(ctx context.Context) error { return redis.Health(ctx, rdb) },
	}))

	addr := fmt.Sprintf(":%d", ffCfg.Port)
	logger.Info("platform-svc listening", zap.String("addr", addr))

	srv := &http.Server{Addr: addr, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server error", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down platform-svc...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}
}
