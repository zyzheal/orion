package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	"orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	"orion/go-common/pkg/otel"
	"orion/go-common/pkg/redis"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	// internal sub-packages
	pipelineCfg "orion/ci-cd-svc-go/internal/pipeline/config"
	pipelineEng "orion/ci-cd-svc-go/internal/pipeline/engine"
	pipelineHandler "orion/ci-cd-svc-go/internal/pipeline/handler"
	pipelineRepo "orion/ci-cd-svc-go/internal/pipeline/repository"
	pipelineSvc "orion/ci-cd-svc-go/internal/pipeline/service"
	pipelineNats "orion/ci-cd-svc-go/internal/pipeline/nats"

	buildHandler "orion/ci-cd-svc-go/internal/build/handler"
	buildNats "orion/ci-cd-svc-go/internal/build/nats"

	deployHandler "orion/ci-cd-svc-go/internal/deploy/handler"
	deployNats "orion/ci-cd-svc-go/internal/deploy/nats"

	canaryHandler "orion/ci-cd-svc-go/internal/canary/handler"
	canaryRepo "orion/ci-cd-svc-go/internal/canary/repository"
	canarySvc "orion/ci-cd-svc-go/internal/canary/service"
	canaryNats "orion/ci-cd-svc-go/internal/canary/nats"

	runnerHandler "orion/ci-cd-svc-go/internal/runner/handler"
	runnerRepo "orion/ci-cd-svc-go/internal/runner/repository"
	runnerSvc "orion/ci-cd-svc-go/internal/runner/service"
	runnerNats "orion/ci-cd-svc-go/internal/runner/nats"

	templateHandler "orion/ci-cd-svc-go/internal/pipeline-template/handler"
	templateRepo "orion/ci-cd-svc-go/internal/pipeline-template/repository"
	templateSvc "orion/ci-cd-svc-go/internal/pipeline-template/service"
	templateNats "orion/ci-cd-svc-go/internal/pipeline-template/nats"
)

// natsCloser is the interface all NATS subscribers implement.
type natsCloser interface {
	Close() error
	Start(ctx context.Context) error
}

func main() {
	cfg, err := pipelineCfg.Load()
	if err != nil {
		panic("failed to load config: " + err.Error())
	}

	zapLogger := logger.Must(logger.Config{
		Level:       "info",
		Development: cfg.Environment == "development",
		ServiceName: cfg.ServiceName,
	})
	defer zapLogger.Sync()

	shutdown, err := otel.Init(otel.Config{
		ServiceName: cfg.ServiceName,
		Endpoint:    cfg.OTelEndpoint,
		Insecure:    true,
	})
	if err != nil {
		zapLogger.Warn("failed to init OTel", zap.Error(err))
	}
	defer shutdown(context.Background())

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db, err := database.ConnectWithRetry(ctx, database.DefaultConfig(cfg.DatabaseURL), 3)
	if err != nil {
		zapLogger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	if err := database.RunMigrations(db, "migrations"); err != nil {
		zapLogger.Fatal("failed to run migrations", zap.Error(err))
	}

	rdb := redis.NewClient(redis.Config{Addr: cfg.RedisAddr, DB: cfg.RedisDB})
	defer rdb.Close()

	// ---- Wire up pipeline layer ----
	pipelineRepoInst := pipelineRepo.NewPipelineRepository(db.DB)
	pipelineRunRepo := pipelineRepo.NewRunRepository(db.DB)
	pipelineStageRepo := pipelineRepo.NewStageRepository(db.DB)
	pipelineTaskRepo := pipelineRepo.NewTaskRepository(db.DB)
	pipelineBudgetRepo := pipelineRepo.NewBudgetRepository(db.DB)
	pipelineAuditLogRepo := pipelineRepo.NewAuditLogRepository(db.DB)

	pipelineEngine := pipelineEng.NewPipelineEngine(pipelineEng.EngineDeps{
		PipelineRepo: pipelineRepoInst,
		RunRepo:      pipelineRunRepo,
		StageRepo:    pipelineStageRepo,
		TaskRepo:     pipelineTaskRepo,
		Logger:       zapLogger,
	})

	pipelineSvcInst := pipelineSvc.NewPipelineService(pipelineRepoInst, pipelineRunRepo, pipelineStageRepo, pipelineTaskRepo, pipelineEngine)
	pipelineTemplateSvc := pipelineSvc.NewTemplateService(db.DB)
	triggerSvc := pipelineSvc.NewTriggerService(db.DB, pipelineSvcInst)
	versionSvc := pipelineSvc.NewVersionService(db.DB)
	rbacSvc := pipelineSvc.NewRBACService(db.DB)
	approvalGateSvc := pipelineSvc.NewApprovalGateService(db.DB)
	batchSvc := pipelineSvc.NewBatchService(db.DB)
	sseSvc := pipelineSvc.NewSSEService()
	budgetSvc := pipelineSvc.NewBudgetService(pipelineBudgetRepo)
	auditLogSvc := pipelineSvc.NewAuditLogService(pipelineAuditLogRepo)
	graphSvc := pipelineSvc.NewGraphService(pipelineSvcInst)
	autonomousSvc := pipelineSvc.NewAutonomousService(db.DB, pipelineSvcInst)
	controlSvc := pipelineSvc.NewControlService(db.DB, pipelineSvcInst)

	pipelineHandlerInst := pipelineHandler.NewHandler(pipelineSvcInst)
	pipelineTemplateHandler := pipelineHandler.NewTemplateHandler(pipelineTemplateSvc)
	pipelineTriggerHandler := pipelineHandler.NewTriggerHandler(triggerSvc)
	pipelineVersionHandler := pipelineHandler.NewVersionHandler(versionSvc)
	pipelineRBACHandler := pipelineHandler.NewRBACHandler(rbacSvc)
	pipelineApprovalGateHandler := pipelineHandler.NewApprovalGateHandler(approvalGateSvc)
	pipelineBatchHandler := pipelineHandler.NewBatchHandler(batchSvc)
	pipelineSSEHandler := pipelineHandler.NewSSEHandler(sseSvc)
	pipelineBudgetHandler := pipelineHandler.NewBudgetHandler(budgetSvc)
	pipelineAuditLogHandler := pipelineHandler.NewAuditLogHandler(auditLogSvc)
	pipelineGraphHandler := pipelineHandler.NewGraphHandler(graphSvc)
	pipelineAutonomousHandler := pipelineHandler.NewAutonomousHandler(autonomousSvc)
	pipelineControlHandler := pipelineHandler.NewControlHandler(controlSvc)

	// ---- Build handler (builds service+repo internally) ----
	buildHandlerInst := buildHandler.New(db, zapLogger)

	// ---- Deploy handler (builds service+repo internally) ----
	deployHandlerInst := deployHandler.New(db, zapLogger)

	// ---- Canary layer ----
	canaryRepoInst := canaryRepo.NewCanaryRepository(db.DB)
	analysisRunRepo := canaryRepo.NewCanaryAnalysisRunRepository(db.DB)
	metricResultRepo := canaryRepo.NewCanaryMetricResultRepository(db.DB)
	mlResultRepo := canaryRepo.NewCanaryMLResultRepository(db.DB)
	analysisConfigRepo := canaryRepo.NewCanaryAnalysisConfigRepository(db.DB)
	decisionRepo := canaryRepo.NewCanaryDecisionRepository(db.DB)
	retrainJobRepo := canaryRepo.NewCanaryRetrainJobRepository(db.DB)
	trafficConfigRepo := canaryRepo.NewTrafficConfigRepository(db.DB)
	trafficHistoryRepo := canaryRepo.NewTrafficHistoryRepository(db.DB)
	canarySvcInst := canarySvc.NewCanaryService(
		canaryRepoInst, analysisRunRepo, metricResultRepo, mlResultRepo,
		analysisConfigRepo, decisionRepo, retrainJobRepo, trafficConfigRepo, trafficHistoryRepo,
	)
	canaryHandlerInst := canaryHandler.NewHandler(canarySvcInst)

	// ---- Runner layer ----
	runnerRepoInst := runnerRepo.NewRepository(db.DB)
	runnerSvcInst := runnerSvc.NewService(runnerRepoInst)
	runnerHandlerInst := runnerHandler.NewHandler(runnerSvcInst)

	// ---- Pipeline Template layer ----
	templateRepoInst := templateRepo.NewRepository(db.DB)
	templateSvcInst := templateSvc.NewService(templateRepoInst)
	templateHandlerInst := templateHandler.NewHandler(templateSvcInst)

	// ---- NATS subscribers (graceful degradation) ----
	natsSubs := []natsCloser{}

	if cfg.NATSAddr != "" {
		if sub, err := pipelineNats.NewNATSSubscriber(cfg.NATSAddr, cfg.NATSStream, zapLogger, pipelineSvcInst); err == nil {
			natsSubs = append(natsSubs, sub)
		} else {
			zapLogger.Warn("failed to init pipeline NATS subscriber", zap.Error(err))
		}
		if sub, err := buildNats.NewNATSSubscriber(cfg.NATSAddr, cfg.NATSStream, zapLogger); err == nil {
			natsSubs = append(natsSubs, sub)
		} else {
			zapLogger.Warn("failed to init build NATS subscriber", zap.Error(err))
		}
		if sub, err := deployNats.NewNATSSubscriber(cfg.NATSAddr, cfg.NATSStream, zapLogger); err == nil {
			natsSubs = append(natsSubs, sub)
		} else {
			zapLogger.Warn("failed to init deploy NATS subscriber", zap.Error(err))
		}
		if sub, err := canaryNats.NewNATSSubscriber(cfg.NATSAddr, cfg.NATSStream, zapLogger); err == nil {
			natsSubs = append(natsSubs, sub)
		} else {
			zapLogger.Warn("failed to init canary NATS subscriber", zap.Error(err))
		}
		if sub, err := runnerNats.NewNATSSubscriber(cfg.NATSAddr, cfg.NATSStream, zapLogger); err == nil {
			natsSubs = append(natsSubs, sub)
		} else {
			zapLogger.Warn("failed to init runner NATS subscriber", zap.Error(err))
		}
		if sub, err := templateNats.NewNATSSubscriber(cfg.NATSAddr, cfg.NATSStream, zapLogger); err == nil {
			natsSubs = append(natsSubs, sub)
		} else {
			zapLogger.Warn("failed to init template NATS subscriber", zap.Error(err))
		}
	}

	for _, sub := range natsSubs {
		if err := sub.Start(ctx); err != nil {
			zapLogger.Warn("failed to start NATS subscriber", zap.Error(err))
		}
	}

	// ---- Setup Gin router ----
	r := gin.New()
	r.Use(middleware.RequestID())
	r.Use(middleware.Recovery(zapLogger))
	r.Use(middleware.StructuredLogger(zapLogger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	v1 := r.Group("/api/v1")
	v1.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))

	// Register all handlers' routes
	pipelineHandlerInst.RegisterRoutes(v1)
	pipelineTemplateHandler.RegisterRoutes(v1)
	pipelineTriggerHandler.RegisterRoutes(v1)
	pipelineVersionHandler.RegisterRoutes(v1)
	pipelineRBACHandler.RegisterRoutes(v1)
	pipelineApprovalGateHandler.RegisterRoutes(v1)
	pipelineBatchHandler.RegisterRoutes(v1)
	pipelineSSEHandler.RegisterRoutes(v1)
	pipelineBudgetHandler.RegisterRoutes(v1)
	pipelineAuditLogHandler.RegisterRoutes(v1)
	pipelineGraphHandler.RegisterRoutes(v1)
	pipelineAutonomousHandler.RegisterRoutes(v1)
	pipelineControlHandler.RegisterRoutes(v1)
	buildHandlerInst.RegisterRoutes(v1)
	deployHandlerInst.RegisterRoutes(v1)
	canaryHandlerInst.RegisterRoutes(v1)
	runnerHandlerInst.RegisterRoutes(v1)
	templateHandlerInst.RegisterRoutes(v1)

	srv := &http.Server{Addr: cfg.HTTPAddr, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			zapLogger.Fatal("server failed", zap.Error(err))
		}
	}()

	zapLogger.Info("ci-cd service starting", zap.String("addr", cfg.HTTPAddr))

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	for _, sub := range natsSubs {
		if err := sub.Close(); err != nil {
			zapLogger.Warn("failed to close NATS subscriber", zap.Error(err))
		}
	}

	if err := srv.Shutdown(shutdownCtx); err != nil {
		zapLogger.Fatal("server forced to shutdown", zap.Error(err))
	}
	zapLogger.Info("server exited")
}
