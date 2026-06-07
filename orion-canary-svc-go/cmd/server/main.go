package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"orion/canary-svc-go/internal/config"
	"orion/canary-svc-go/internal/handler"
	"orion/canary-svc-go/internal/repository"
	"orion/canary-svc-go/internal/service"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"

	orionredis "orion/go-common/pkg/redis"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-canary-svc"))
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

	rdb := orionredis.NewClient(orionredis.Config{Addr: cfg.RedisAddr})
	defer rdb.Close()


	canaryRepo := repository.NewCanaryRepository(db.DB)
	analysisRunRepo := repository.NewCanaryAnalysisRunRepository(db.DB)
	metricResultRepo := repository.NewCanaryMetricResultRepository(db.DB)
	mlResultRepo := repository.NewCanaryMLResultRepository(db.DB)
	analysisConfigRepo := repository.NewCanaryAnalysisConfigRepository(db.DB)
	decisionRepo := repository.NewCanaryDecisionRepository(db.DB)
	retrainJobRepo := repository.NewCanaryRetrainJobRepository(db.DB)
	trafficConfigRepo := repository.NewTrafficConfigRepository(db.DB)
	trafficHistoryRepo := repository.NewTrafficHistoryRepository(db.DB)
	canarySvc := service.NewCanaryService(canaryRepo, analysisRunRepo, metricResultRepo, mlResultRepo, analysisConfigRepo, decisionRepo, retrainJobRepo, trafficConfigRepo, trafficHistoryRepo)
	h := handler.NewHandler(canarySvc)

	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))
	rg := r.Group("/api/v1")
	rg.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))
	h.RegisterRoutes(rg)

	r.GET("/healthz", middleware.HealthCheck("orion-canary-svc"))

	addr := fmt.Sprintf(":%d", cfg.ServerPort)
	logger.Info("canary-svc starting", zap.String("addr", addr))
	if err := r.Run(addr); err != nil {
		logger.Fatal("failed to start server", zap.Error(err))
	}
}
