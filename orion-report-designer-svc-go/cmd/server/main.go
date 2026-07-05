package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"orion/report-designer-svc-go/internal/config"
	"orion/report-designer-svc-go/internal/handler"
	"orion/report-designer-svc-go/internal/repository"
	"orion/report-designer-svc-go/internal/service"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"

	orionredis "orion/go-common/pkg/redis"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-report-designer-svc"))
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

	definitionRepo := repository.NewReportDefinitionRepository(db.DB)
	datasourceRepo := repository.NewReportDatasourceRepository(db.DB)
	scheduleRepo := repository.NewReportScheduleRepository(db.DB)
	executionRepo := repository.NewReportExecutionRepository(db.DB)

	reportDesignerSvc := service.NewReportDesignerService(definitionRepo, datasourceRepo, scheduleRepo, executionRepo)
	h := handler.NewHandler(reportDesignerSvc)

	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))

	// Health check (no auth required)
	r.GET("/healthz", middleware.HealthCheck("orion-report-designer-svc"))

	// API v1 routes with auth (prefix configurable via env)
	rg := r.Group(cfg.APIPrefix)
	rg.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))
	h.RegisterRoutes(rg)

	addr := fmt.Sprintf("%s:%d", cfg.ServerHost, cfg.ServerPort)
	logger.Info("report-designer-svc starting",
		zap.String("addr", addr),
		zap.String("api_prefix", cfg.APIPrefix),
	)
	if err := r.Run(addr); err != nil {
		logger.Fatal("failed to start server", zap.Error(err))
	}
}
