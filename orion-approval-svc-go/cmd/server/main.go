package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"orion/approval-svc-go/internal/config"
	"orion/approval-svc-go/internal/handler"
	"orion/approval-svc-go/internal/repository"
	"orion/approval-svc-go/internal/service"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"

	orionredis "orion/go-common/pkg/redis"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-approval-svc"))
	defer logger.Sync()

	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("failed to load config", zap.Error(err))
	}

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


	approvalRepo := repository.NewApprovalRepository(db.DB)
	notificationSvc := service.NewNotificationService()
	approvalSvc := service.NewApprovalService(approvalRepo, notificationSvc)
	reportingSvc := service.NewReportingService(approvalRepo)

	h := handler.NewHandler(approvalSvc)

	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))
	rg := r.Group("/api/v1")
	rg.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))

	// Core routes
	h.RegisterRoutes(rg)

	// Extended routes (submit, stats, pending, etc.)
	h.RegisterExtendedRoutes(rg)

	// Reporting endpoint
	rg.GET("/approvals/report", func(c *gin.Context) {
		tenantID := c.GetString("tenant_id")
		report, err := reportingSvc.GenerateReport(c.Request.Context(), tenantID)
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		c.JSON(200, report)
	})

	r.GET("/healthz", middleware.HealthCheck("orion-approval-svc"))

	addr := fmt.Sprintf(":%d", cfg.ServerPort)
	logger.Info("approval-svc starting", zap.String("addr", addr))
	if err := r.Run(addr); err != nil {
		logger.Fatal("failed to start server", zap.Error(err))
	}
}
