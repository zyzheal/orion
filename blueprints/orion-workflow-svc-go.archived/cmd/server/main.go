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

	"orion/workflow-svc-go/internal/workflow/config"
	"orion/workflow-svc-go/internal/workflow/handler"
	"orion/workflow-svc-go/internal/workflow/repository"
	"orion/workflow-svc-go/internal/workflow/service"
	"orion/workflow-svc-go/pkg/nats"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"

	workflowdependency_handler "orion/workflow-svc-go/internal/workflow-dependency/handler"
	workflowdependency_repo "orion/workflow-svc-go/internal/workflow-dependency/repository"
	workflowdependency_service "orion/workflow-svc-go/internal/workflow-dependency/service"
	workflowtask_handler "orion/workflow-svc-go/internal/workflow-task/handler"
	workflowtask_repo "orion/workflow-svc-go/internal/workflow-task/repository"
	workflowtask_service "orion/workflow-svc-go/internal/workflow-task/service"
	workflowtrigger_handler "orion/workflow-svc-go/internal/workflow-trigger/handler"
	workflowtrigger_repo "orion/workflow-svc-go/internal/workflow-trigger/repository"
	workflowtrigger_service "orion/workflow-svc-go/internal/workflow-trigger/service"
	workflowwebhook_handler "orion/workflow-svc-go/internal/workflow-webhook/handler"
	workflowwebhook_repo "orion/workflow-svc-go/internal/workflow-webhook/repository"
	workflowwebhook_service "orion/workflow-svc-go/internal/workflow-webhook/service"
	orionredis "orion/go-common/pkg/redis"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-workflow-svc"))
	defer logger.Sync()

	cfg := config.Load()

	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode)
	dbCfg := database.DefaultConfig(dsn)

	ctx := context.Background()
	db, err := database.Connect(ctx, dbCfg)
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

	rdb := orionredis.NewClient(orionredis.Config{Addr: cfg.RedisAddr})
	defer rdb.Close()

	repo := repository.NewRepository(db.DB)
	svc := service.NewService(repo)
	h := handler.NewHandler(svc)



	// workflow-dependency services
	workflowdependencyRepo := workflowdependency_repo.NewRepository(db.DB)
	workflowdependencySvc := workflowdependency_service.NewService(workflowdependencyRepo)
	workflowdependencyH := workflowdependency_handler.NewHandler(workflowdependencySvc)

	// workflow-task services
	workflowtaskRepo := workflowtask_repo.NewRepository(db.DB)
	workflowtaskSvc := workflowtask_service.NewService(workflowtaskRepo)
	workflowtaskH := workflowtask_handler.NewHandler(workflowtaskSvc)

	// workflow-trigger services
	workflowtriggerRepo := workflowtrigger_repo.NewRepository(db.DB)
	workflowtriggerSvc := workflowtrigger_service.NewService(workflowtriggerRepo)
	workflowtriggerH := workflowtrigger_handler.NewHandler(workflowtriggerSvc)

	// workflow-webhook services
	workflowwebhookRepo := workflowwebhook_repo.NewRepository(db.DB)
	workflowwebhookSvc := workflowwebhook_service.NewService(workflowwebhookRepo)
	workflowwebhookH := workflowwebhook_handler.NewHandler(workflowwebhookSvc)

	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))
	rg := r.Group("/api/v1")
	rg.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))
	h.RegisterRoutes(rg)


	workflowdependencyH.RegisterRoutes(rg)
	workflowtaskH.RegisterRoutes(rg)
	workflowtriggerH.RegisterRoutes(rg)
	workflowwebhookH.RegisterRoutes(rg)

	r.GET("/healthz", middleware.HealthCheck("orion-workflow-svc"))

	addr := fmt.Sprintf(":%d", cfg.Port)
	logger.Info("workflow-svc listening", zap.String("addr", addr))

	// Initialize NATS JetStream subscriber (graceful degradation)
	var natssub *nats.NATSSubscriber
	if natssub, err = nats.NewNATSSubscriber(cfg.NATSAddr, cfg.NATSStream, logger); err != nil {
		logger.Warn("NATS subscriber unavailable, continuing without event streaming",
			zap.String("addr", cfg.NATSAddr), zap.Error(err))
		natssub = nil
	}

	srv := &http.Server{Addr: addr, Handler: r}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server failed", zap.Error(err))
		}
	}()

	// Start NATS subscriber after server is running
	if natssub != nil {
		if err := natssub.Start(ctx); err != nil {
			logger.Warn("failed to start NATS subscriber", zap.Error(err))
		}
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down workflow-svc...")
	if natssub != nil {
		natssub.Close()
	}
	ctxShut, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctxShut); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}
}
