package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"orion/notification-svc-go/internal/notification/config"
	notif_handler "orion/notification-svc-go/internal/notification/handler"
	notif_repo "orion/notification-svc-go/internal/notification/repository"
	notif_service "orion/notification-svc-go/internal/notification/service"
	nats_subscriber "orion/notification-svc-go/pkg/nats"

	chatops_handler "orion/notification-svc-go/internal/chatops/handler"
	chatops_repo "orion/notification-svc-go/internal/chatops/repository"
	chatops_service "orion/notification-svc-go/internal/chatops/service"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"

	orionredis "orion/go-common/pkg/redis"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-notification-svc"))
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

	// Notification services
	repo := notif_repo.NewRepository(db.DB)
	svc := notif_service.NewService(repo)
	h := notif_handler.NewHandler(svc)
	policyRepo := notif_repo.NewPolicyRepository(db)
	policySvc := notif_service.NewPolicyService(policyRepo, logger)
	policyHandler := notif_handler.NewPolicyHandler(policySvc)
	deliveryRepo := notif_repo.NewDeliveryRepository(db.DB)
	deliverySvc := notif_service.NewDeliveryService(deliveryRepo, logger)
	deliveryHandler := notif_handler.NewDeliveryHandler(deliverySvc)
	scheduledRepo := notif_repo.NewScheduledNotificationRepository(db.DB)
	scheduledSvc := notif_service.NewScheduledNotificationService(scheduledRepo, logger)
	scheduledHandler := notif_handler.NewScheduledNotificationHandler(scheduledSvc)
	dndRepo := notif_repo.NewDNDRepository(db.DB)
	dndSvc := notif_service.NewDNDService(dndRepo, logger)
	dndHandler := notif_handler.NewDNDHandler(dndSvc)
	channelSvc := notif_service.NewChannelService(repo, logger)
	channelHandler := notif_handler.NewChannelHandler(channelSvc)
	templateSvc := notif_service.NewTemplateService(repo, logger)
	templateHandler := notif_handler.NewTemplateHandler(templateSvc)

	// ChatOps services
	chatopsRepo := chatops_repo.NewRepository(db.DB)
	chatopsSvc := chatops_service.NewService(chatopsRepo)
	chatopsH := chatops_handler.NewHandler(chatopsSvc)
	chatopsAuditSvc := chatops_service.NewAuditService(chatopsRepo)
	chatopsRateLimitSvc := chatops_service.NewRateLimitService(chatopsRepo)
	chatopsWebhookSvc := chatops_service.NewWebhookService(chatopsRepo)
	chatopsSessionSvc := chatops_service.NewSessionService(chatopsRepo)
	chatopsRecommendationSvc := chatops_service.NewRecommendationService(chatopsRepo)
	chatopsMessageSvc := chatops_service.NewMessageService(chatopsWebhookSvc)
	chatopsConfigSvc := chatops_service.NewConfigService(chatopsRepo)
	chatopsCommandSvc := chatops_service.NewCommandService(chatopsRepo, chatopsRateLimitSvc, chatopsAuditSvc)
	chatopsAdminSvc := chatops_service.NewAdminService()
	chatopsCommandH := chatops_handler.NewCommandHandler(chatopsCommandSvc)
	chatopsWebhookH := chatops_handler.NewWebhookHandler(chatopsWebhookSvc)
	chatopsRateLimitH := chatops_handler.NewRateLimitHandler(chatopsRateLimitSvc)
	chatopsSessionH := chatops_handler.NewSessionHandler(chatopsSessionSvc)
	chatopsAuditH := chatops_handler.NewAuditHandler(chatopsAuditSvc)
	chatopsRecommendationH := chatops_handler.NewRecommendationHandler(chatopsRecommendationSvc)
	chatopsMessageH := chatops_handler.NewMessageHandler(chatopsMessageSvc)
	chatopsConfigH := chatops_handler.NewConfigHandler(chatopsConfigSvc)
	chatopsAdminH := chatops_handler.NewAdminHandler(chatopsAdminSvc)

	// NATS JetStream subscriber
	var natsSub *nats_subscriber.NATSSubscriber
	if cfg.NATSAddr != "" {
		sub, err := nats_subscriber.NewNATSSubscriber(cfg.NATSAddr, cfg.NATSStream, logger)
		if err != nil {
			logger.Warn("failed to init NATS subscriber", zap.Error(err))
		} else {
			natsSub = sub
			if err := natsSub.Start(ctx); err != nil {
				logger.Warn("failed to start NATS subscriber", zap.Error(err))
				natsSub = nil
			}
		}
	}

	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))
	rg := r.Group("/api/v1")
	rg.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))

	// Notification routes
	h.RegisterRoutes(rg)
	policyHandler.RegisterRoutes(rg)
	deliveryHandler.RegisterRoutes(rg)
	scheduledHandler.RegisterRoutes(rg)
	dndHandler.RegisterRoutes(rg)
	channelHandler.RegisterRoutes(rg)
	templateHandler.RegisterRoutes(rg)

	// ChatOps routes
	chatopsH.RegisterRoutes(rg)
	chatopsCommandH.RegisterRoutes(rg)
	chatopsWebhookH.RegisterRoutes(rg)
	chatopsRateLimitH.RegisterRoutes(rg)
	chatopsSessionH.RegisterRoutes(rg)
	chatopsAuditH.RegisterRoutes(rg)
	chatopsRecommendationH.RegisterRoutes(rg)
	chatopsMessageH.RegisterRoutes(rg)
	chatopsConfigH.RegisterRoutes(rg)
	chatopsAdminH.RegisterRoutes(rg)

	r.GET("/healthz", middleware.HealthCheck("orion-notification-svc"))

	addr := fmt.Sprintf(":%d", cfg.Port)
	logger.Info("notification-svc listening", zap.String("addr", addr))
	if err := r.Run(addr); err != nil {
		logger.Fatal("server error", zap.Error(err))
	}
}
