package main

import (
	"context"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	gg_handler "orion/platform-svc-go/internal/governance/governance/handler"
	gg_repo "orion/platform-svc-go/internal/governance/governance/repository"
	gg_service "orion/platform-svc-go/internal/governance/governance/service"

	gc_handler "orion/platform-svc-go/internal/governance/compliance/handler"
	gc_repo "orion/platform-svc-go/internal/governance/compliance/repository"
	gc_service "orion/platform-svc-go/internal/governance/compliance/service"

	gr_handler "orion/platform-svc-go/internal/governance/risk/handler"
	gr_repo "orion/platform-svc-go/internal/governance/risk/repository"
	gr_service "orion/platform-svc-go/internal/governance/risk/service"

	gp_handler "orion/platform-svc-go/internal/governance/policy/handler"
	gp_repo "orion/platform-svc-go/internal/governance/policy/repository"
	gp_service "orion/platform-svc-go/internal/governance/policy/service"

	s_handler "orion/platform-svc-go/internal/security/security/handler"
	s_repo "orion/platform-svc-go/internal/security/security/repository"
	s_service "orion/platform-svc-go/internal/security/security/service"

	ss_handler "orion/platform-svc-go/internal/security/secret/handler"
	ss_repo "orion/platform-svc-go/internal/security/secret/repository"
	ss_service "orion/platform-svc-go/internal/security/secret/service"

	sb_handler "orion/platform-svc-go/internal/security/branch-policy/handler"
	sb_repo "orion/platform-svc-go/internal/security/branch-policy/repository"
	sb_service "orion/platform-svc-go/internal/security/branch-policy/service"

	spv_handler "orion/platform-svc-go/internal/security/privacy/handler"
	spv_repo "orion/platform-svc-go/internal/security/privacy/repository"
	spv_service "orion/platform-svc-go/internal/security/privacy/service"

	su_handler "orion/platform-svc-go/internal/security/ueba/handler"
	su_repo "orion/platform-svc-go/internal/security/ueba/repository"
	su_service "orion/platform-svc-go/internal/security/ueba/service"

	scd_handler "orion/platform-svc-go/internal/security/cross-domain/handler"
	scd_repo "orion/platform-svc-go/internal/security/cross-domain/repository"
	scd_service "orion/platform-svc-go/internal/security/cross-domain/service"

	ak_handler "orion/platform-svc-go/internal/api-key/handler"
	ak_repo "orion/platform-svc-go/internal/api-key/repository"
	ak_service "orion/platform-svc-go/internal/api-key/service"

	cf_handler "orion/platform-svc-go/internal/confirmation/handler"
	cf_repo "orion/platform-svc-go/internal/confirmation/repository"
	cf_service "orion/platform-svc-go/internal/confirmation/service"

	se_handler "orion/platform-svc-go/internal/session/handler"
	se_repo "orion/platform-svc-go/internal/session/repository"
	se_service "orion/platform-svc-go/internal/session/service"

	ssou_handler "orion/platform-svc-go/internal/sso/handler"
	ssou_repo "orion/platform-svc-go/internal/sso/repository"
	ssou_service "orion/platform-svc-go/internal/sso/service"

	te_handler "orion/platform-svc-go/internal/tenant/handler"
	te_repo "orion/platform-svc-go/internal/tenant/repository"
	te_service "orion/platform-svc-go/internal/tenant/service"

	ti_handler "orion/platform-svc-go/internal/ticket/handler"
	ti_repo "orion/platform-svc-go/internal/ticket/repository"
	ti_service "orion/platform-svc-go/internal/ticket/service"
)

func wireCoreDomains(db *database.DB, logger *zap.Logger) {
	wireGovernanceDomains(db, logger)
	wireSecurityDomains(db, logger)
	wireIdentityDomains(db, logger)
	wireTicketDomain(db, logger)
}

func wireGovernanceDomains(db *database.DB, logger *zap.Logger) {
	_ = logger
	// governance
	{
		repo := gg_repo.NewRepository(db.DB)
		svc := gg_service.NewService(repo)
		governanceH = gg_handler.NewHandler(svc)
	}
	// compliance
	{
		reportRepo := gc_repo.NewComplianceReportRepository(db.DB)
		scheduleRepo := gc_repo.NewComplianceScheduleRepository(db.DB)
		policyRepo := gc_repo.NewCompliancePolicyRepository(db.DB)
		svc := gc_service.NewComplianceService(reportRepo, scheduleRepo, policyRepo)
		governanceComplianceH = gc_handler.NewHandler(svc)
	}
	// risk
	{
		repo := gr_repo.NewRepository(db.DB)
		svc := gr_service.NewService(repo)
		governanceRiskH = gr_handler.NewHandler(svc)
	}
	// policy
	{
		repo := gp_repo.NewRepository(db.DB)
		svc := gp_service.NewService(repo)
		governancePolicyH = gp_handler.NewHandler(svc)
	}
}

func wireSecurityDomains(db *database.DB, logger *zap.Logger) {
	_ = logger
	// security
	{
		repo := s_repo.NewRepository(db.DB)
		svc := s_service.NewService(repo)
		securityH = s_handler.NewHandler(svc)
	}
	// secret
	{
		repo := ss_repo.NewRepository(db.DB)
		svc := ss_service.NewService(repo, "")
		securitySecretH = ss_handler.NewHandler(svc)
	}
	// branch-policy
	{
		repo := sb_repo.NewRepository(db.DB)
		svc := sb_service.NewService(repo)
		securityBranchPolicyH = sb_handler.NewHandler(svc)
	}
	// privacy
	{
		repo := spv_repo.NewRepository(db.DB)
		svc := spv_service.NewService(repo)
		securityPrivacyH = spv_handler.NewHandler(svc)
	}
	// ueba
	{
		repo := su_repo.NewRepository(db.DB)
		svc := su_service.NewService(repo)
		securityUebaH = su_handler.NewHandler(svc)
	}
	// cross-domain
	{
		repo := scd_repo.NewRepository(db.DB)
		svc := scd_service.NewService(repo)
		securityCrossDomainH = scd_handler.NewHandler(svc)
	}
}

func wireIdentityDomains(db *database.DB, logger *zap.Logger) {
	_ = logger
	// api-key
	{
		repo := ak_repo.NewRepository(db.DB)
		svc := ak_service.NewService(repo)
		identityApikeyH = ak_handler.NewHandler(svc)
	}
	// confirmation
	{
		repo := cf_repo.NewRepository(db.DB)
		svc := cf_service.NewService(repo)
		identityConfirmationH = cf_handler.NewHandler(svc)
	}
	// session
	{
		repo := se_repo.NewRepository(db.DB)
		svc := se_service.NewService(repo, 24*time.Hour)
		identitySessionH = se_handler.NewHandler(svc)
	}
	// sso
	{
		repo := ssou_repo.NewRepository(db.DB)
		svc := ssou_service.NewService(repo)
		identitySsoH = ssou_handler.NewHandler(svc)
	}
	// tenant
	{
		repo := te_repo.NewRepository(db.DB)
		svc := te_service.NewService(repo)
		identityTenantH = te_handler.NewHandler(svc)
	}
}

func wireTicketDomain(db *database.DB, logger *zap.Logger) {
	_ = logger
	ticketRepo := ti_repo.NewTicketRepository(db)
	workflowRepo := ti_repo.NewWorkflowRepository(db)
	relationRepo := ti_repo.NewRelationRepository(db)
	slaRepo := ti_repo.NewSLARepository(db)
	dispatchRepo := ti_repo.NewDispatchRepository(db)
	slaPolicyRepo := ti_repo.NewSLAPolicyRepository(db)
	automationRuleRepo := ti_repo.NewAutomationRuleRepository(db)
	analyticsRepo := ti_repo.NewAnalyticsRepository(db)
	commentRepo := ti_repo.NewCommentRepository(db)
	transferRepo := ti_repo.NewTransferRepository(db)
	suspendRepo := ti_repo.NewSuspendRepository(db)
	assignmentRuleRepo := ti_repo.NewAssignmentRuleRepository(db)

	slaService := ti_service.NewSLAService(slaRepo, ticketRepo)
	dispatchService := ti_service.NewDispatchService(dispatchRepo, ticketRepo, slaRepo)
	analyzerService := ti_service.NewAnalyzerService(relationRepo, ticketRepo)
	automationRuleService := ti_service.NewAutomationRuleService(automationRuleRepo, ticketRepo)
	slaPolicyService := ti_service.NewSLAPolicyService(slaPolicyRepo)
	ticketSourceService := ti_service.NewTicketGeneratorService(ticketRepo)
	workflowService := ti_service.NewWorkflowService(workflowRepo, ticketRepo)
	transferService := ti_service.NewTransferService(transferRepo, ticketRepo, dispatchRepo, suspendRepo)
	queueManager := ti_service.NewQueueManager(dispatchRepo, slaRepo)
	loadBalancer := ti_service.NewLoadBalancer(dispatchRepo)
	suspendService := ti_service.NewSuspendService(suspendRepo, dispatchRepo, slaService)
	analyticsService := ti_service.NewAnalyticsService(analyticsRepo, dispatchRepo, slaRepo, transferRepo, ticketRepo)
	ticketService := ti_service.NewTicketService(ticketRepo, commentRepo, workflowService, slaService, dispatchService, analyzerService, assignmentRuleRepo)

	ticketH = ti_handler.NewTicketHandler(ticketService)
	slaModH = ti_handler.NewSLAHandler(slaService)
	workflowModH = ti_handler.NewWorkflowHandler(ticketService)
	dispatchH = ti_handler.NewDispatchHandler(dispatchService)
	relationH = ti_handler.NewRelationHandler(analyzerService)
	serviceControlH = ti_handler.NewServiceControlHandler(ticketService)
	queueH = ti_handler.NewQueueHandler(queueManager)
	loadBalancerH = ti_handler.NewLoadBalancerHandler(loadBalancer)
	transferH = ti_handler.NewTransferHandler(transferService)
	suspendH = ti_handler.NewSuspendHandler(suspendService)

	analyticsTicketH = ti_handler.NewAnalyticsHandler(analyticsService)
	automationRuleTicketH = ti_handler.NewAutomationRuleHandler(automationRuleService)
	slaPolicyTicketH = ti_handler.NewSLAPolicyHandler(slaPolicyService)
	ticketSourceTicketH = ti_handler.NewTicketSourceHandler(ticketSourceService)
}

var (
	// governance
	governanceH          *gg_handler.Handler
	governanceComplianceH *gc_handler.Handler
	governanceRiskH      *gr_handler.Handler
	governancePolicyH    *gp_handler.Handler

	// security
	securityH             *s_handler.Handler
	securitySecretH       *ss_handler.Handler
	securityBranchPolicyH *sb_handler.Handler
	securityPrivacyH      *spv_handler.Handler
	securityUebaH         *su_handler.Handler
	securityCrossDomainH  *scd_handler.Handler

	// identity
	identityApikeyH      *ak_handler.Handler
	identityConfirmationH *cf_handler.Handler
	identitySessionH     *se_handler.Handler
	identitySsoH         *ssou_handler.Handler
	identityTenantH      *te_handler.Handler

	// ticket (with RegisterRoutes)
	analyticsTicketH      *ti_handler.AnalyticsHandler
	automationRuleTicketH *ti_handler.AutomationRuleHandler
	slaPolicyTicketH      *ti_handler.SLAPolicyHandler
	ticketSourceTicketH   *ti_handler.TicketSourceHandler

	// ticket (without RegisterRoutes)
	ticketH         *ti_handler.TicketHandler
	slaModH         *ti_handler.SLAHandler
	workflowModH    *ti_handler.WorkflowHandler
	dispatchH       *ti_handler.DispatchHandler
	relationH       *ti_handler.RelationHandler
	serviceControlH *ti_handler.ServiceControlHandler
	queueH          *ti_handler.QueueHandler
	loadBalancerH   *ti_handler.LoadBalancerHandler
	transferH       *ti_handler.TransferHandler
	suspendH        *ti_handler.SuspendHandler

	_ = fmt.Sprintf
	_ = context.Background()
	_ = gin.SetMode
)
