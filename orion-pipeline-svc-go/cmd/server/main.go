package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"orion/pipeline-svc-go/internal/config"
	"orion/pipeline-svc-go/internal/engine"
	"orion/pipeline-svc-go/internal/handler"
	"orion/pipeline-svc-go/internal/repository"
	"orion/pipeline-svc-go/internal/service"
	"orion/pipeline-svc-go/pkg/nats"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	"orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	"orion/go-common/pkg/otel"
	"orion/go-common/pkg/redis"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	cfg, err := config.Load()
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

	pipelineRepo := repository.NewPipelineRepository(db.DB)
	runRepo := repository.NewRunRepository(db.DB)
	stageRepo := repository.NewStageRepository(db.DB)
	taskRepo := repository.NewTaskRepository(db.DB)
	budgetRepo := repository.NewBudgetRepository(db.DB)
	auditLogRepo := repository.NewAuditLogRepository(db.DB)

	pipelineEngine := engine.NewPipelineEngine(engine.EngineDeps{
		PipelineRepo: pipelineRepo,
		RunRepo:      runRepo,
		StageRepo:    stageRepo,
		TaskRepo:     taskRepo,
		Logger:       zapLogger,
	})

	pipelineSvc := service.NewPipelineService(pipelineRepo, runRepo, stageRepo, taskRepo, pipelineEngine)
	templateSvc := service.NewTemplateService(db.DB)
	triggerSvc := service.NewTriggerService(db.DB, pipelineSvc)
	versionSvc := service.NewVersionService(db.DB)
	rbacSvc := service.NewRBACService(db.DB)
	approvalGateSvc := service.NewApprovalGateService(db.DB)
	batchSvc := service.NewBatchService(db.DB)
	sseSvc := service.NewSSEService()
	budgetSvc := service.NewBudgetService(budgetRepo)
	auditLogSvc := service.NewAuditLogService(auditLogRepo)
	graphSvc := service.NewGraphService(pipelineSvc)
	autonomousSvc := service.NewAutonomousService(db.DB, pipelineSvc)
	controlSvc := service.NewControlService(db.DB, pipelineSvc)

	// NATS subscriber (graceful degradation)
	var natsSub *nats.NATSSubscriber
	if cfg.NATSAddr != "" {
		sub, err := nats.NewNATSSubscriber(cfg.NATSAddr, cfg.NATSStream, zapLogger, pipelineSvc)
		if err != nil {
			zapLogger.Warn("failed to init NATS subscriber", zap.Error(err))
		} else {
			natsSub = sub
			if err := natsSub.Start(ctx); err != nil {
				zapLogger.Warn("failed to start NATS subscriber", zap.Error(err))
				natsSub = nil
			}
		}
	}

	h := handler.NewHandler(pipelineSvc)
	templateHandler := handler.NewTemplateHandler(templateSvc)
	triggerHandler := handler.NewTriggerHandler(triggerSvc)
	versionHandler := handler.NewVersionHandler(versionSvc)
	rbacHandler := handler.NewRBACHandler(rbacSvc)
	approvalGateHandler := handler.NewApprovalGateHandler(approvalGateSvc)
	batchHandler := handler.NewBatchHandler(batchSvc)
	sseHandler := handler.NewSSEHandler(sseSvc)
	budgetHandler := handler.NewBudgetHandler(budgetSvc)
	auditLogHandler := handler.NewAuditLogHandler(auditLogSvc)
	graphHandler := handler.NewGraphHandler(graphSvc)
	autonomousHandler := handler.NewAutonomousHandler(autonomousSvc)
	controlHandler := handler.NewControlHandler(controlSvc)

	r := gin.New()
	r.Use(middleware.RequestID())
	r.Use(middleware.Recovery(zapLogger))
	r.Use(middleware.StructuredLogger(zapLogger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))

	r.GET("/healthz", func(c *gin.Context) {
		if err := db.Health(c.Request.Context()); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy", "error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	v1 := r.Group("/api/v1")
	v1.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))
	h.RegisterRoutes(v1)
	templateHandler.RegisterRoutes(v1)
	triggerHandler.RegisterRoutes(v1)
	versionHandler.RegisterRoutes(v1)
	rbacHandler.RegisterRoutes(v1)
	approvalGateHandler.RegisterRoutes(v1)
	batchHandler.RegisterRoutes(v1)
	sseHandler.RegisterRoutes(v1)
	budgetHandler.RegisterRoutes(v1)
	auditLogHandler.RegisterRoutes(v1)
	graphHandler.RegisterRoutes(v1)
	autonomousHandler.RegisterRoutes(v1)
	controlHandler.RegisterRoutes(v1)

	srv := &http.Server{Addr: cfg.HTTPAddr, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			zapLogger.Fatal("server failed", zap.Error(err))
		}
	}()

	zapLogger.Info("pipeline service starting", zap.String("addr", cfg.HTTPAddr))

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	if natsSub != nil {
		if err := natsSub.Close(); err != nil {
			zapLogger.Warn("failed to close NATS subscriber", zap.Error(err))
		}
	}
	if err := srv.Shutdown(shutdownCtx); err != nil {
		zapLogger.Fatal("server forced to shutdown", zap.Error(err))
	}
	zapLogger.Info("server exited")
}
