package main

import (
	"context"
	"fmt"
	"os"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"orion/compliance-svc-go/internal/config"
	"orion/compliance-svc-go/internal/handler"
	"orion/compliance-svc-go/internal/repository"
	"orion/compliance-svc-go/internal/service"
	nats_subscriber "orion/compliance-svc-go/pkg/nats"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"

	orionredis "orion/go-common/pkg/redis"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-compliance-svc"))
	defer logger.Sync()

	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("failed to load config", zap.Error(err))
	}

	// Build DSN from config
	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode)

	dbCfg := database.DefaultConfig(dsn)

	ctx := context.Background()
	db, err := database.Connect(ctx, dbCfg)
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	// Run migrations
	migrationsDir := "migrations"
	if _, err := os.Stat(migrationsDir); err == nil {
		if err := database.RunMigrations(db, migrationsDir); err != nil {
			logger.Warn("warning: failed to run migrations", zap.Error(err))
		}
	}

	rdb := orionredis.NewClient(orionredis.Config{Addr: cfg.RedisAddr})
	defer rdb.Close()

	// Initialize repositories
	reportRepo := repository.NewComplianceReportRepository(db.DB)
	scheduleRepo := repository.NewComplianceScheduleRepository(db.DB)

	// Initialize service
	complianceSvc := service.NewComplianceService(reportRepo, scheduleRepo)
	h := handler.NewHandler(complianceSvc)

	// Setup Gin router
	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))

	// Health check (no auth required)
	r.GET("/healthz", middleware.HealthCheck("orion-compliance-svc"))

	// API v1 routes with auth (prefix configurable via env)
	rg := r.Group(cfg.APIPrefix)
	rg.Use(auth.Auth(auth.AuthConfig{
		JWTSecret:  cfg.JWTSecret,
		RedisClient: rdb,
		SkipPaths:  []string{"/healthz"},
	}))
	h.RegisterRoutes(rg)

	addr := fmt.Sprintf("%s:%d", cfg.ServerHost, cfg.ServerPort)
	logger.Info("compliance-svc starting",
		zap.String("addr", addr),
		zap.String("api_prefix", cfg.APIPrefix),
	)

	// Initialize NATS JetStream subscriber (for consuming events)
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

	srv := &http.Server{Addr: addr, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server failed", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down compliance-svc...")
	if natsSub != nil {
		if err := natsSub.Close(); err != nil {
			logger.Warn("failed to close NATS subscriber", zap.Error(err))
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}
}
