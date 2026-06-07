package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"orion/finops-svc-go/internal/config"
	"orion/finops-svc-go/internal/handler"
	"orion/finops-svc-go/internal/repository"
	"orion/finops-svc-go/internal/service"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"

	orionredis "orion/go-common/pkg/redis"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-finops-svc"))
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


	costRepo := repository.NewCostRepository(db.DB)

	// Initialize services
	finopsSvc := service.NewFinOpsService(costRepo)
	optimizationSvc := service.NewOptimizationService(costRepo)
	budgetSvc := service.NewBudgetService(costRepo)
	costTrendSvc := service.NewCostTrendService(costRepo)

	// Initialize handlers
	h := handler.NewHandler(finopsSvc)
	optimizationHandler := handler.NewOptimizationHandler(optimizationSvc)
	budgetHandler := handler.NewBudgetHandler(budgetSvc)
	costTrendHandler := handler.NewCostTrendHandler(costTrendSvc)

	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))
	rg := r.Group("/api/v1")
	rg.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))

	h.RegisterRoutes(rg)
	optimizationHandler.RegisterRoutes(rg)
	budgetHandler.RegisterRoutes(rg)
	costTrendHandler.RegisterRoutes(rg)

	r.GET("/healthz", middleware.HealthCheck("orion-finops-svc"))

	addr := fmt.Sprintf(":%d", cfg.Port)
	logger.Info("finops-svc listening", zap.String("addr", addr))
	if err := r.Run(addr); err != nil {
		logger.Fatal("server error", zap.Error(err))
	}
}
