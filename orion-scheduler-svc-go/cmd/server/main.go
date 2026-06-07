package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"orion/scheduler-svc-go/internal/config"
	"orion/scheduler-svc-go/internal/handler"
	"orion/scheduler-svc-go/internal/repository"
	"orion/scheduler-svc-go/internal/service"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"

	orionredis "orion/go-common/pkg/redis"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-scheduler-svc"))
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
			log.Printf("warning: failed to run migrations: %v", err)
		}
	}

	// Wire repository → services → handler
	rdb := orionredis.NewClient(orionredis.Config{Addr: cfg.RedisAddr})
	defer rdb.Close()


	repo := repository.NewSchedulerRepository(db.DB)
	schedulerSvc := service.NewSchedulerService(repo)
	onCallSvc := service.NewOnCallService(repo)
	lockSvc := service.NewDistributedLockService(repo)

	// Start the scheduler tick loop.
	go schedulerSvc.Start(ctx)
	defer schedulerSvc.Stop()

	h := handler.NewHandler(schedulerSvc, onCallSvc, lockSvc)

	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))
	rg := r.Group("/api/v1")
	rg.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))
	h.RegisterRoutes(rg)

	r.GET("/healthz", middleware.HealthCheck("orion-scheduler-svc"))

	addr := fmt.Sprintf(":%d", cfg.ServerPort)
	logger.Info("scheduler-svc starting", zap.String("addr", addr))
	if err := r.Run(addr); err != nil {
		logger.Fatal("failed to start server", zap.Error(err))
	}
}
