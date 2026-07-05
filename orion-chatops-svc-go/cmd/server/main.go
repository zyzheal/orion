package main

import (
	"context"
	"fmt"
	"os"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"orion/chatops-svc-go/internal/config"
	"orion/chatops-svc-go/internal/handler"
	"orion/chatops-svc-go/internal/repository"
	"orion/chatops-svc-go/internal/service"
	nats_subscriber "orion/chatops-svc-go/pkg/nats"
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
			logger.Warn("warning: failed to run migrations", zap.Error(err))
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

	addr := fmt.Sprintf(":%d", cfg.Port)
	logger.Info("chatops-svc listening", zap.String("addr", addr))

	srv := &http.Server{Addr: addr, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server failed", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down chatops-svc...")
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
