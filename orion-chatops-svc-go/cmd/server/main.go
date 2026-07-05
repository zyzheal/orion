package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"orion/chatops-svc-go/internal/config"
	"orion/chatops-svc-go/internal/handler"
	"orion/chatops-svc-go/internal/repository"
	"orion/chatops-svc-go/internal/service"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"

	orionredis "orion/go-common/pkg/redis"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-chatops-svc"))
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

	// Legacy ChatChannel service
	svc := service.NewService(repo)
	h := handler.NewHandler(svc)

	// New services
	auditSvc := service.NewAuditService(repo)
	rateLimitSvc := service.NewRateLimitService(repo)
	webhookSvc := service.NewWebhookService(repo)
	sessionSvc := service.NewSessionService(repo)
	recommendationSvc := service.NewRecommendationService(repo)
	messageSvc := service.NewMessageService(webhookSvc)
	configSvc := service.NewConfigService(repo)
	commandSvc := service.NewCommandService(repo, rateLimitSvc, auditSvc)

	// New handlers
	commandH := handler.NewCommandHandler(commandSvc)
	webhookH := handler.NewWebhookHandler(webhookSvc)
	rateLimitH := handler.NewRateLimitHandler(rateLimitSvc)
	sessionH := handler.NewSessionHandler(sessionSvc)
	auditH := handler.NewAuditHandler(auditSvc)
	recommendationH := handler.NewRecommendationHandler(recommendationSvc)
	messageH := handler.NewMessageHandler(messageSvc)
	configH := handler.NewConfigHandler(configSvc)

	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))
	rg := r.Group("/api/v1")
	rg.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))

	// Legacy routes
	h.RegisterRoutes(rg)

	// New routes
	commandH.RegisterRoutes(rg)
	webhookH.RegisterRoutes(rg)
	rateLimitH.RegisterRoutes(rg)
	sessionH.RegisterRoutes(rg)
	auditH.RegisterRoutes(rg)
	recommendationH.RegisterRoutes(rg)
	messageH.RegisterRoutes(rg)
	configH.RegisterRoutes(rg)

	r.GET("/healthz", middleware.HealthCheck("orion-chatops-svc"))

	addr := fmt.Sprintf(":%d", cfg.Port)
	logger.Info("chatops-svc listening", zap.String("addr", addr))
	if err := r.Run(addr); err != nil {
		logger.Fatal("server error", zap.Error(err))
	}
}
