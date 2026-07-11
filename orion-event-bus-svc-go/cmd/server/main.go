package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"orion/event-bus-svc-go/internal/config"
	"orion/event-bus-svc-go/internal/handler"
	"orion/event-bus-svc-go/internal/nats"
	orionlog "orion/go-common/pkg/logger"
	"orion/event-bus-svc-go/internal/repository"
	"orion/event-bus-svc-go/internal/service"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	"orion/go-common/pkg/middleware"

	eventbus_handler "orion/event-bus-svc-go/internal/eventbus/handler"
	eventbus_repo "orion/event-bus-svc-go/internal/eventbus/repository"
	eventbus_service "orion/event-bus-svc-go/internal/eventbus/service"
	eventtrigger_handler "orion/event-bus-svc-go/internal/event-trigger/handler"
	eventtrigger_repo "orion/event-bus-svc-go/internal/event-trigger/repository"
	eventtrigger_service "orion/event-bus-svc-go/internal/event-trigger/service"
	eventtriggerregistry_handler "orion/event-bus-svc-go/internal/event-trigger-registry/handler"
	eventtriggerregistry_repo "orion/event-bus-svc-go/internal/event-trigger-registry/repository"
	eventtriggerregistry_service "orion/event-bus-svc-go/internal/event-trigger-registry/service"
	webhook_handler "orion/event-bus-svc-go/internal/webhook/handler"
	webhook_repo "orion/event-bus-svc-go/internal/webhook/repository"
	webhook_service "orion/event-bus-svc-go/internal/webhook/service"
	messagequeue_handler "orion/event-bus-svc-go/internal/message-queue/handler"
	messagequeue_repo "orion/event-bus-svc-go/internal/message-queue/repository"
	messagequeue_service "orion/event-bus-svc-go/internal/message-queue/service"
	multimodaltrigger_handler "orion/event-bus-svc-go/internal/multi-modal-trigger/handler"
	multimodaltrigger_repo "orion/event-bus-svc-go/internal/multi-modal-trigger/repository"
	multimodaltrigger_service "orion/event-bus-svc-go/internal/multi-modal-trigger/service"
	orionredis "orion/go-common/pkg/redis"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-event-bus-svc"))
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

	// Initialize NATS client (graceful fallback if unavailable)
	natsClient := nats.NewClient(&nats.Config{
		URLs:      cfg.NATSURLs,
		User:      cfg.NATSUser,
		Password:  cfg.NATSPassword,
	}, logger)
	defer natsClient.Close()
	if err := natsClient.Connect(ctx); err != nil {
		logger.Warn("NATS not available, running without event streaming", zap.Error(err))
	}

	repo := repository.NewRepository(db.DB)
	svc := service.NewService(repo, natsClient)
	h := handler.NewHandler(svc, logger)



	// eventbus services
	eventbusRepo := eventbus_repo.NewRepository(db.DB)
	eventbusSvc := eventbus_service.NewService(eventbusRepo)
	eventbusH := eventbus_handler.NewHandler(eventbusSvc)

	// event-trigger services
	eventtriggerRepo := eventtrigger_repo.NewRepository(db.DB)
	eventtriggerSvc := eventtrigger_service.NewService(eventtriggerRepo)
	eventtriggerH := eventtrigger_handler.NewHandler(eventtriggerSvc)

	// event-trigger-registry services
	eventtriggerregistryRepo := eventtriggerregistry_repo.NewRepository(db.DB)
	eventtriggerregistrySvc := eventtriggerregistry_service.NewService(eventtriggerregistryRepo)
	eventtriggerregistryH := eventtriggerregistry_handler.NewHandler(eventtriggerregistrySvc)

	// webhook services
	webhookRepo := webhook_repo.NewRepository(db.DB)
	webhookSvc := webhook_service.NewService(webhookRepo)
	webhookH := webhook_handler.NewHandler(webhookSvc)

	// message-queue services
	messagequeueRepo := messagequeue_repo.NewRepository(db.DB)
	messagequeueSvc := messagequeue_service.NewService(messagequeueRepo)
	messagequeueH := messagequeue_handler.NewHandler(messagequeueSvc)

	// multi-modal-trigger services
	multimodaltriggerRepo := multimodaltrigger_repo.NewRepository(db.DB)
	multimodaltriggerSvc := multimodaltrigger_service.NewService(multimodaltriggerRepo)
	multimodaltriggerH := multimodaltrigger_handler.NewHandler(multimodaltriggerSvc)

	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))
	rg := r.Group("/api/v1")
	rg.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))
	h.RegisterRoutes(rg)


	eventbusH.RegisterRoutes(rg)
	eventtriggerH.RegisterRoutes(rg)
	eventtriggerregistryH.RegisterRoutes(rg)
	webhookH.RegisterRoutes(rg)
	messagequeueH.RegisterRoutes(rg)
	multimodaltriggerH.RegisterRoutes(rg)

	r.GET("/healthz", middleware.HealthCheck("orion-event-bus-svc"))

	addr := fmt.Sprintf(":%d", cfg.Port)
	logger.Info("event-bus-svc listening", zap.String("addr", addr))
	if err := r.Run(addr); err != nil {
		logger.Fatal("server error", zap.Error(err))
	}
}
