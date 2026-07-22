package main

import (
	"context"
	"net/http"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"orion/config-mgmt-svc-go/internal/config-pkg/config"
	configHandler "orion/config-mgmt-svc-go/internal/config/handler"
	"orion/config-mgmt-svc-go/internal/config/repository"
	"orion/config-mgmt-svc-go/internal/config/service"
	"orion/go-common/pkg/auth"
	 nats_subscriber "orion/config-mgmt-svc-go/pkg/nats"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"

	configmgmtenhanced_handler "orion/config-mgmt-svc-go/internal/config-mgmt-enhanced/handler"
	configmgmtenhanced_repo "orion/config-mgmt-svc-go/internal/config-mgmt-enhanced/repository"
	configmgmtenhanced_service "orion/config-mgmt-svc-go/internal/config-mgmt-enhanced/service"
	globalparam_handler "orion/config-mgmt-svc-go/internal/global-param/handler"
	globalparam_repo "orion/config-mgmt-svc-go/internal/global-param/repository"
	globalparam_service "orion/config-mgmt-svc-go/internal/global-param/service"
	cache_handler "orion/config-mgmt-svc-go/internal/cache/handler"
	cache_repo "orion/config-mgmt-svc-go/internal/cache/repository"
	cache_service "orion/config-mgmt-svc-go/internal/cache/service"
	cachecleanup_handler "orion/config-mgmt-svc-go/internal/cache-cleanup/handler"
	cachecleanup_repo "orion/config-mgmt-svc-go/internal/cache-cleanup/repository"
	cachecleanup_service "orion/config-mgmt-svc-go/internal/cache-cleanup/service"
	envprofile_handler "orion/config-mgmt-svc-go/internal/env-profile/handler"
	envprofile_repo "orion/config-mgmt-svc-go/internal/env-profile/repository"
	envprofile_service "orion/config-mgmt-svc-go/internal/env-profile/service"
	unifiedconfig_handler "orion/config-mgmt-svc-go/internal/unified-config/handler"
	unifiedconfig_repo "orion/config-mgmt-svc-go/internal/unified-config/repository"
	unifiedconfig_service "orion/config-mgmt-svc-go/internal/unified-config/service"
	orionredis "orion/go-common/pkg/redis"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-config-mgmt-svc"))
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

	// NATS JetStream subscriber
	var natsSub *nats_subscriber.NATSSubscriber
	if cfg.NATSAddr != "" {
	    sub, err := nats_subscriber.NewNATSSubscriber(cfg.NATSAddr, cfg.NATSStream, logger)
	    if err != nil {
	        logger.Warn("failed to init NATS subscriber", zap.Error(err))
	    } else {
	        natsSub = sub
	        if err := natsSub.Start(context.Background()); err != nil {
	            logger.Warn("failed to start NATS subscriber", zap.Error(err))
	            natsSub = nil
	        }
	    }
	}

	repo := repository.NewRepository(db.DB)

	// Core config service
	configSvc := service.NewService(repo)
	h := configHandler.NewHandler(configSvc)

	// New services
	driftSvc := service.NewDriftService(repo)
	featureFlagSvc := service.NewFeatureFlagService(repo)
	gitSyncSvc := service.NewGitSyncService(repo)
	approvalSvc := service.NewApprovalService(repo, configSvc)
	snapshotSvc := service.NewSnapshotService(repo)
	canarySvc := service.NewCanaryService(repo)
templateSvc := service.NewTemplateService(repo)
webhookSvc := service.NewWebhookService(repo)
	// New handlers
	driftH := configHandler.NewDriftHandler(driftSvc)
	featureFlagH := configHandler.NewFeatureFlagHandler(featureFlagSvc)
	gitSyncH := configHandler.NewGitSyncHandler(gitSyncSvc)
	approvalH := configHandler.NewApprovalHandler(approvalSvc)
	snapshotH := configHandler.NewSnapshotHandler(snapshotSvc)
	canaryH := configHandler.NewCanaryHandler(canarySvc)
		templateH := configHandler.NewTemplateHandler(templateSvc)
		webhookH := configHandler.NewWebhookHandler(webhookSvc)


	// config-mgmt-enhanced services
	configmgmtenhancedRepo := configmgmtenhanced_repo.NewRepository(db.DB)
	configmgmtenhancedSvc := configmgmtenhanced_service.NewService(configmgmtenhancedRepo)
	configmgmtenhancedH := configmgmtenhanced_handler.NewHandler(configmgmtenhancedSvc)

	// global-param services
	globalparamRepo := globalparam_repo.NewRepository(db.DB)
	globalparamSvc := globalparam_service.NewService(globalparamRepo)
	globalparamH := globalparam_handler.NewHandler(globalparamSvc)

	// cache services
	cacheRepo := cache_repo.NewRepository(db.DB)
	cacheSvc := cache_service.NewService(cacheRepo)
	cacheH := cache_handler.NewHandler(cacheSvc)

	// cache-cleanup services
	cachecleanupRepo := cachecleanup_repo.NewRepository(db.DB)
	cachecleanupSvc := cachecleanup_service.NewService(cachecleanupRepo)
	cachecleanupH := cachecleanup_handler.NewHandler(cachecleanupSvc)

	// env-profile services
	envprofileRepo := envprofile_repo.NewRepository(db.DB)
	envprofileSvc := envprofile_service.NewService(envprofileRepo)
	envprofileH := envprofile_handler.NewHandler(envprofileSvc)

	// unified-config services
	unifiedconfigRepo := unifiedconfig_repo.NewRepository(db.DB)
	unifiedconfigSvc := unifiedconfig_service.NewService(unifiedconfigRepo)
	unifiedconfigH := unifiedconfig_handler.NewHandler(unifiedconfigSvc)

	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))
	rg := r.Group("/api/v1")
	rg.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))

	// Core routes
	h.RegisterRoutes(rg)

	// New routes
	driftH.RegisterRoutes(rg)
	featureFlagH.RegisterRoutes(rg)
	gitSyncH.RegisterRoutes(rg)
	approvalH.RegisterRoutes(rg)
	snapshotH.RegisterRoutes(rg)
	canaryH.RegisterRoutes(rg)
		templateH.RegisterRoutes(rg)
		webhookH.RegisterRoutes(rg)

	configmgmtenhancedH.RegisterRoutes(rg)
	globalparamH.RegisterRoutes(rg)
	cacheH.RegisterRoutes(rg)
	cachecleanupH.RegisterRoutes(rg)
	envprofileH.RegisterRoutes(rg)
	unifiedconfigH.RegisterRoutes(rg)

	r.GET("/healthz", middleware.HealthCheck("orion-config-mgmt-svc"))

	addr := fmt.Sprintf(":%d", cfg.Port)
	logger.Info("config-mgmt-svc listening", zap.String("addr", addr))
	srv := &http.Server{Addr: addr, Handler: r}

	go func() {
	    if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
	        logger.Fatal("server failed", zap.Error(err))
	    }
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	if natsSub != nil {
	    if err := natsSub.Close(); err != nil {
	        logger.Warn("failed to close NATS subscriber", zap.Error(err))
	    }
	}
	srv.Shutdown(shutdownCtx)
}