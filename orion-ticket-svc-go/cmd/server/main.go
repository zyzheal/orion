package main

import (
	"context"
	"fmt"
	"net/http"

	orionredis "orion/go-common/pkg/redis"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	"orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	"orion/go-common/pkg/otel"
	"orion-ticket-svc-go/internal/config"
	"orion-ticket-svc-go/internal/handler"
	"orion-ticket-svc-go/internal/repository"
	"orion-ticket-svc-go/internal/service"
)

func runMigrations(db *database.DB) error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS tickets (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			title VARCHAR(255) NOT NULL,
			description TEXT,
			type VARCHAR(50),
			priority VARCHAR(50),
			status VARCHAR(50),
			created_by VARCHAR(255),
			assigned_to VARCHAR(500),
			resolved_at TIMESTAMP,
			closed_at TIMESTAMP,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS ticket_comments (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			ticket_id UUID REFERENCES tickets(id),
			author VARCHAR(255),
			content TEXT,
			is_internal BOOLEAN DEFAULT false,
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS ticket_attachments (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			ticket_id UUID REFERENCES tickets(id),
			file_name VARCHAR(255),
			file_path VARCHAR(500),
			file_size BIGINT,
			uploaded_by VARCHAR(255),
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS ticket_workflow_history (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			ticket_id UUID REFERENCES tickets(id),
			from_status VARCHAR(50),
			to_status VARCHAR(50),
			performed_by VARCHAR(255),
			reason TEXT,
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS ticket_relations (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			ticket_id UUID REFERENCES tickets(id),
			related_ticket_id UUID REFERENCES tickets(id),
			relation_type VARCHAR(50),
			created_by VARCHAR(255),
			description TEXT,
			confidence DOUBLE PRECISION DEFAULT 0,
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS sla_targets (
			id VARCHAR(100) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			priority VARCHAR(50),
			target_response_time_ms BIGINT,
			target_resolution_time_ms BIGINT,
			enabled BOOLEAN DEFAULT true,
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS sla_records (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			ticket_id UUID REFERENCES tickets(id),
			sla_target_id VARCHAR(100),
			priority VARCHAR(50),
			response_deadline_at TIMESTAMP,
			resolution_deadline_at TIMESTAMP,
			responded_at TIMESTAMP,
			resolved_at TIMESTAMP,
			breached BOOLEAN DEFAULT false,
			breach_type VARCHAR(50),
			paused BOOLEAN DEFAULT false,
			paused_at TIMESTAMP,
			paused_reason TEXT,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS dispatch_engineers (
			id VARCHAR(100) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			expertise JSONB DEFAULT '[]',
			current_load INT DEFAULT 0,
			max_capacity INT DEFAULT 10,
			availability VARCHAR(50) DEFAULT 'available',
			skills JSONB DEFAULT '[]',
			team VARCHAR(100),
			on_call BOOLEAN DEFAULT false,
			total_resolved INT DEFAULT 0,
			avg_resolution_ms DOUBLE PRECISION DEFAULT 0,
			sla_compliance DOUBLE PRECISION DEFAULT 0,
			success_rate DOUBLE PRECISION DEFAULT 0,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS dispatch_records (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			ticket_id UUID REFERENCES tickets(id),
			engineer_id VARCHAR(100),
			assigned_by VARCHAR(255),
			method VARCHAR(50),
			score DOUBLE PRECISION,
			reason TEXT,
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS dispatch_rules (
			id VARCHAR(100) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			condition TEXT,
			engineer_id VARCHAR(100),
			priority INT DEFAULT 0,
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS dispatch_queue (
			ticket_id UUID PRIMARY KEY REFERENCES tickets(id),
			tenant_id UUID NOT NULL,
			priority VARCHAR(50),
			enqueued_at TIMESTAMP DEFAULT NOW(),
			attempts INT DEFAULT 0,
			last_error TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS ticket_transfers (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			ticket_id UUID REFERENCES tickets(id),
			from_engineer_id VARCHAR(100),
			to_engineer_id VARCHAR(100),
			initiated_by VARCHAR(255),
			reason TEXT,
			hold_duration_ms BIGINT DEFAULT 0,
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS suspend_records (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			engineer_id VARCHAR(100),
			reason VARCHAR(50),
			status VARCHAR(50) DEFAULT 'pending',
			start_time TIMESTAMP,
			end_time TIMESTAMP,
			backup_engineer_id VARCHAR(100),
			auto_reassign_pending BOOLEAN DEFAULT false,
			pause_sla_for_pending BOOLEAN DEFAULT false,
			notes TEXT,
			created_by VARCHAR(255),
			activated_at TIMESTAMP,
			ended_at TIMESTAMP,
			cancelled_at TIMESTAMP,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS assignment_rules (
			id VARCHAR(100) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			categories JSONB DEFAULT '[]',
			assignee VARCHAR(255),
			priorities JSONB DEFAULT '[]',
			enabled BOOLEAN DEFAULT true,
			"order" INT DEFAULT 0,
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_tickets_tenant ON tickets(tenant_id)`,
		`CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)`,
		`CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to)`,
		`CREATE INDEX IF NOT EXISTS idx_comments_ticket ON ticket_comments(ticket_id)`,
		`CREATE INDEX IF NOT EXISTS idx_attachments_ticket ON ticket_attachments(ticket_id)`,
		`CREATE INDEX IF NOT EXISTS idx_workflow_ticket ON ticket_workflow_history(ticket_id)`,
		`CREATE INDEX IF NOT EXISTS idx_relations_ticket ON ticket_relations(ticket_id)`,
		`CREATE INDEX IF NOT EXISTS idx_relations_related ON ticket_relations(related_ticket_id)`,
		`CREATE INDEX IF NOT EXISTS idx_sla_records_ticket ON sla_records(ticket_id)`,
		`CREATE INDEX IF NOT EXISTS idx_sla_records_breached ON sla_records(breached)`,
		`CREATE INDEX IF NOT EXISTS idx_dispatch_records_ticket ON dispatch_records(ticket_id)`,
		`CREATE INDEX IF NOT EXISTS idx_dispatch_records_engineer ON dispatch_records(engineer_id)`,
		`CREATE INDEX IF NOT EXISTS idx_transfers_ticket ON ticket_transfers(ticket_id)`,
		`CREATE INDEX IF NOT EXISTS idx_suspend_engineer ON suspend_records(engineer_id)`,
		`CREATE INDEX IF NOT EXISTS idx_suspend_status ON suspend_records(status)`,
	}

	for _, sql := range migrations {
		if _, err := db.Exec(sql); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}
	return nil
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		panic("failed to load config: " + err.Error())
	}

	zapLogger := logger.Must(logger.Config{
		Level:       "info",
		Development: cfg.Server.Mode == "debug",
		ServiceName: cfg.Otel.ServiceName,
	})
	defer zapLogger.Sync()

	shutdown, err := otel.Init(otel.Config{
		ServiceName: cfg.Otel.ServiceName,
		Endpoint:    cfg.Otel.Endpoint,
		Insecure:    true,
	})
	if err != nil {
		zapLogger.Warn("failed to init OTel", zap.Error(err))
	}
	defer shutdown(context.Background())

	db, err := database.Connect(context.Background(), database.DefaultConfig(cfg.Database.DSN()))
	if err != nil {
		zapLogger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	if err := runMigrations(db); err != nil {
		zapLogger.Fatal("failed to run migrations", zap.Error(err))
	}
	zapLogger.Info("migrations completed")

	gin.SetMode(cfg.Server.Mode)
	r := gin.New()
	r.Use(middleware.RequestID())
	r.Use(middleware.Recovery(zapLogger))
	r.Use(middleware.StructuredLogger(zapLogger))
	r.Use(middleware.CORS(middleware.CORSConfig{
		AllowOrigins: cfg.CORS.Origins,
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type", "Authorization", "X-Tenant-ID", "X-User-ID"},
	}))

	rdb := orionredis.NewClient(orionredis.Config{Addr: cfg.Redis.Addr, DB: cfg.Redis.DB})
	defer rdb.Close()

	ticketRepo := repository.NewTicketRepository(db)
	commentRepo := repository.NewCommentRepository(db)
	workflowRepo := repository.NewWorkflowRepository(db)
	relationRepo := repository.NewRelationRepository(db)
	slaRepo := repository.NewSLARepository(db)
	dispatchRepo := repository.NewDispatchRepository(db)
	suspendRepo := repository.NewSuspendRepository(db)
	transferRepo := repository.NewTransferRepository(db)
	analyticsRepo := repository.NewAnalyticsRepository(db)
	ruleRepo := repository.NewAssignmentRuleRepository(db)

	workflowSvc := service.NewWorkflowService(workflowRepo, ticketRepo)
	slaSvc := service.NewSLAService(slaRepo, ticketRepo)
	dispatchSvc := service.NewDispatchService(dispatchRepo, ticketRepo, slaRepo)
	analyzerSvc := service.NewAnalyzerService(relationRepo, ticketRepo)
	suspendSvc := service.NewSuspendService(suspendRepo, dispatchRepo, slaSvc)
	analyticsSvc := service.NewAnalyticsService(analyticsRepo, dispatchRepo, slaRepo, transferRepo, ticketRepo)
	ticketSvc := service.NewTicketService(ticketRepo, commentRepo, workflowSvc, slaSvc, dispatchSvc, analyzerSvc, ruleRepo)
	transferSvc := service.NewTransferService(transferRepo, ticketRepo, dispatchRepo, suspendRepo)
	queueMgr := service.NewQueueManager(dispatchRepo, slaRepo)
	loadBalancer := service.NewLoadBalancer(dispatchRepo)
	analyticsEnhanced := service.NewAnalyticsEnhanced(analyticsRepo, dispatchRepo, slaRepo, ticketRepo)

	ticketHandler := handler.NewTicketHandler(ticketSvc)
	workflowHandler := handler.NewWorkflowHandler(ticketSvc)
	dispatchHandler := handler.NewDispatchHandler(dispatchSvc)
	slaHandler := handler.NewSLAHandler(slaSvc)
	relationHandler := handler.NewRelationHandler(analyzerSvc)
	suspendHandler := handler.NewSuspendHandler(suspendSvc)
	analyticsHandler := handler.NewAnalyticsHandler(analyticsSvc)
	transferHandler := handler.NewTransferHandler(transferSvc)
	queueHandler := handler.NewQueueHandler(queueMgr)
	loadBalancerHandler := handler.NewLoadBalancerHandler(loadBalancer)
	analyticsEnhancedHandler := handler.NewAnalyticsEnhancedHandler(analyticsEnhanced)

	v1 := r.Group("/api/v1")
	v1.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWT.Secret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))
	{
		v1.GET("/tickets", ticketHandler.ListTickets)
		v1.POST("/tickets", auth.RequirePermission("ticket", "write"), ticketHandler.CreateTicket)
		v1.GET("/tickets/count", ticketHandler.Count)
		v1.GET("/tickets/:id", ticketHandler.GetTicket)
		v1.PUT("/tickets/:id", auth.RequirePermission("ticket", "write"), ticketHandler.UpdateTicket)
		v1.DELETE("/tickets/:id", auth.RequirePermission("ticket", "delete"), ticketHandler.DeleteTicket)
		v1.POST("/tickets/:id/assign", auth.RequirePermission("ticket", "write"), ticketHandler.AssignTicket)
		v1.POST("/tickets/:id/resolve", auth.RequirePermission("ticket", "execute"), ticketHandler.ResolveTicket)
		v1.GET("/tickets/:id/comments", ticketHandler.ListComments)
		v1.POST("/tickets/:id/comments", auth.RequirePermission("ticket", "write"), ticketHandler.CreateComment)
		v1.POST("/tickets/:id/transition", auth.RequirePermission("ticket", "write"), workflowHandler.TransitionStatus)
		v1.GET("/tickets/:id/history", workflowHandler.GetWorkflowHistory)
		v1.POST("/tickets/:id/escalate", auth.RequirePermission("ticket", "write"), workflowHandler.EscalateTicket)
		v1.POST("/tickets/:id/close", auth.RequirePermission("ticket", "write"), workflowHandler.CloseTicket)
		v1.POST("/tickets/:id/relations", auth.RequirePermission("ticket", "write"), relationHandler.AddRelation)
		v1.GET("/tickets/:id/relations", relationHandler.GetRelations)
		v1.GET("/tickets/:id/related", relationHandler.FindRelatedTickets)
		v1.GET("/tickets/:id/duplicates", relationHandler.DetectDuplicates)
		v1.POST("/tickets/correlate", auth.RequirePermission("ticket", "write"), relationHandler.CorrelateRootCause)
		v1.POST("/tickets/sla/targets", auth.RequirePermission("ticket", "write"), slaHandler.AddSLATarget)
		v1.GET("/tickets/sla/compliance", slaHandler.GetSLACompliance)
		v1.GET("/tickets/sla/breaches", slaHandler.CheckSLABreaches)
		v1.GET("/tickets/:id/sla", slaHandler.GetTicketSLA)
		v1.POST("/tickets/dispatch/engineers", auth.RequirePermission("ticket", "write"), dispatchHandler.RegisterEngineer)
		v1.GET("/tickets/dispatch/engineers", dispatchHandler.ListEngineers)
		v1.GET("/tickets/dispatch/engineers/:id", dispatchHandler.GetEngineer)
		v1.POST("/tickets/:id/dispatch/auto", auth.RequirePermission("ticket", "write"), dispatchHandler.AutoDispatch)
		v1.POST("/tickets/:id/dispatch/manual", auth.RequirePermission("ticket", "write"), dispatchHandler.ManualDispatch)
		v1.POST("/tickets/dispatch/score", auth.RequirePermission("ticket", "write"), dispatchHandler.CalculateDispatchScore)
		v1.GET("/tickets/dispatch/queue/status", dispatchHandler.GetDispatchQueueStatus)
		v1.GET("/tickets/dispatch/queue/entries", dispatchHandler.GetDispatchQueueEntries)
		v1.POST("/tickets/dispatch/rules", auth.RequirePermission("ticket", "write"), dispatchHandler.AddDispatchRule)
		v1.GET("/tickets/dispatch/rules", dispatchHandler.GetDispatchRules)
		v1.DELETE("/tickets/dispatch/rules/:ruleId", auth.RequirePermission("ticket", "delete"), dispatchHandler.RemoveDispatchRule)
		v1.GET("/tickets/dispatch/load-balance", dispatchHandler.GetLoadBalanceReport)
		v1.PUT("/tickets/dispatch/weights", auth.RequirePermission("ticket", "write"), dispatchHandler.UpdateDispatchWeights)
		v1.GET("/tickets/dispatch/weights", dispatchHandler.GetDispatchWeights)
		v1.GET("/tickets/dispatch/metrics", dispatchHandler.GetDispatchMetrics)
		v1.GET("/tickets/dispatch/performance", dispatchHandler.GetAllEngineerPerformances)
		v1.GET("/tickets/dispatch/performance/:engineerId", dispatchHandler.GetEngineerPerformance)
		v1.GET("/tickets/dispatch/queue/sla-status", queueHandler.GetSLAQueueStatus)
		v1.GET("/tickets/dispatch/queue/sla-entries", queueHandler.GetSLAQueueEntries)
		v1.GET("/tickets/dispatch/queue/sla-alerts", queueHandler.GetSLAAlerts)
		v1.POST("/tickets/dispatch/queue/reprioritize", auth.RequirePermission("ticket", "write"), queueHandler.ReprioritizeQueue)
		v1.GET("/tickets/dispatch/balancing/report", loadBalancerHandler.GetBalancingReport)
		v1.GET("/tickets/dispatch/balancing/suggestions", loadBalancerHandler.GetReassignmentSuggestions)
		v1.GET("/tickets/dispatch/balancing/team/:team/capacity", loadBalancerHandler.GetTeamCapacity)
		v1.GET("/tickets/dispatch/balancing/engineer/:id/capacity", loadBalancerHandler.CheckEngineerCapacity)
		v1.GET("/tickets/dispatch/balancing/available", loadBalancerHandler.GetAvailableEngineers)
		v1.POST("/tickets/transfer/:ticketId", auth.RequirePermission("ticket", "write"), transferHandler.ManualTransfer)
		v1.GET("/tickets/transfer/:ticketId/history", transferHandler.GetTransferHistory)
		v1.GET("/tickets/transfer/stats", transferHandler.GetTransferStats)
		v1.POST("/tickets/transfer/auto-check", auth.RequirePermission("ticket", "write"), transferHandler.CheckAutoTransfer)
		v1.POST("/tickets/transfer/suspend/:suspendId", auth.RequirePermission("ticket", "write"), transferHandler.TransferDueToSuspend)
		v1.GET("/tickets/transfer/config", transferHandler.GetTransferConfig)
		v1.PUT("/tickets/transfer/config", auth.RequirePermission("ticket", "write"), transferHandler.UpdateTransferConfig)
		v1.POST("/tickets/suspend", auth.RequirePermission("ticket", "write"), suspendHandler.CreateSuspend)
		v1.POST("/tickets/suspend/:id/activate", auth.RequirePermission("ticket", "write"), suspendHandler.ActivateSuspend)
		v1.POST("/tickets/suspend/:id/end", auth.RequirePermission("ticket", "write"), suspendHandler.EndSuspend)
		v1.POST("/tickets/suspend/:id/cancel", auth.RequirePermission("ticket", "execute"), suspendHandler.CancelSuspend)
		v1.GET("/tickets/suspend", suspendHandler.ListSuspensions)
		v1.GET("/tickets/suspend/:id", suspendHandler.GetSuspend)
		v1.GET("/tickets/suspend/engineer/:engineerId", suspendHandler.GetEngineerSuspensions)
		v1.GET("/tickets/suspend/engineer/:engineerId/impact", suspendHandler.GetEngineerSuspendImpact)
		v1.GET("/tickets/stats", analyticsHandler.GetStatistics)
		v1.GET("/tickets/reports/resolution", analyticsHandler.GetResolutionStats)
		v1.GET("/tickets/reports/backlog", analyticsHandler.GetBacklogAnalysis)
		v1.GET("/tickets/reports/trend", analyticsHandler.GetTrendReport)
		v1.GET("/tickets/bi/dashboard/executive", analyticsHandler.GetExecutiveDashboard)
		v1.GET("/tickets/bi/dashboard/manager", analyticsHandler.GetManagerDashboard)
		v1.GET("/tickets/bi/dashboard/engineer/:engineerId", analyticsHandler.GetEngineerDashboard)
		v1.GET("/tickets/bi/score/:engineerId", analyticsHandler.GetEfficiencyScore)
		v1.GET("/tickets/bi/compare", analyticsHandler.ComparePeriods)
		v1.POST("/tickets/bi/export", auth.RequirePermission("ticket", "execute"), analyticsHandler.ExportBIData)
		v1.GET("/tickets/bi/trend", analyticsHandler.GetTimeTrend)
		v1.GET("/tickets/bi/heatmap", analyticsEnhancedHandler.GetHeatmapData)
		v1.GET("/tickets/bi/bottlenecks", analyticsEnhancedHandler.GetBottleneckAnalysis)
		v1.GET("/tickets/bi/engineer/:engineerId/categories", analyticsEnhancedHandler.GetCategoryBreakdown)
		v1.GET("/tickets/bi/dashboard/manager-enhanced", analyticsEnhancedHandler.GetManagerDashboardEnhanced)
		v1.GET("/tickets/bi/dashboard/engineer-enhanced/:engineerId", analyticsEnhancedHandler.GetEngineerDashboardEnhanced)
	}

	r.GET("/healthz", func(c *gin.Context) {
		if err := db.Health(c.Request.Context()); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy", "db": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "orion-ticket-svc", "version": "2.0.0"})
	})

	r.GET("/readyz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})

	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	zapLogger.Info("starting ticket service", zap.Int("port", cfg.Server.Port))
	if err := r.Run(addr); err != nil {
		zapLogger.Fatal("server failed", zap.Error(err))
	}
}
