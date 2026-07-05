package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"orion/notification-svc-go/internal/config"
	"orion/notification-svc-go/internal/handler"
	"orion/notification-svc-go/internal/repository"
	"orion/notification-svc-go/internal/service"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"

	orionredis "orion/go-common/pkg/redis"
	"github.com/gin-gonic/gin"
	nats "github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
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

	repo := repository.NewRepository(db.DB)
	svc := service.NewService(repo)
	h := handler.NewHandler(svc)

	// NATS subscriber for event-driven notifications
	var natsConn *nats.Conn
	if cfg.NATSAddr != "" {
		natsConn, err = nats.Connect(cfg.NATSAddr,
			nats.MaxReconnects(10),
			nats.ReconnectWait(2*time.Second),
		)
		if err != nil {
			logger.Warn("failed to connect to NATS", zap.Error(err))
		} else {
			js, err := jetstream.New(natsConn)
			if err != nil {
				logger.Warn("failed to init JetStream", zap.Error(err))
				natsConn.Close()
				natsConn = nil
			} else {
				go consumeNotificationEvents(ctx, js, cfg.NATSStream, svc, logger)
				logger.Info("NATS subscriber started", zap.String("stream", cfg.NATSStream))
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
	h.RegisterRoutes(rg)

	r.GET("/healthz", middleware.HealthCheck("orion-notification-svc"))

	addr := fmt.Sprintf(":%d", cfg.Port)
	logger.Info("notification-svc listening", zap.String("addr", addr))
	if err := r.Run(addr); err != nil {
		logger.Fatal("server error", zap.Error(err))
	}
}

func consumeNotificationEvents(ctx context.Context, js jetstream.JetStream, stream string, svc *service.Service, log *zap.Logger) {
	subject := fmt.Sprintf("%s.>", stream)
	cons, err := js.CreateOrUpdateConsumer(ctx, stream, jetstream.ConsumerConfig{
		Name:           "notification-svc-consumer",
		FilterSubjects: []string{subject},
		AckPolicy:      jetstream.AckExplicitPolicy,
		MaxDeliver:     3,
	})
	if err != nil {
		log.Error("failed to create NATS consumer", zap.Error(err))
		return
	}

	for {
		select {
		case <-ctx.Done():
			return
		default:
			msgs, err := cons.Fetch(10, jetstream.FetchMaxWait(time.Second))
			if err != nil {
				log.Error("fetch messages", zap.Error(err))
				continue
			}
			for msg := range msgs.Messages() {
				handleEvent(ctx, msg, svc, log)
			}
		}
	}
}

func handleEvent(ctx context.Context, msg jetstream.Msg, svc *service.Service, log *zap.Logger) {
	var event struct {
		EventType string `json:"event_type"`
		TenantID  string `json:"tenant_id"`
		Source    string `json:"source"`
	}
	if err := json.Unmarshal(msg.Data(), &event); err != nil {
		log.Error("unmarshal event", zap.Error(err))
		msg.Term()
		return
	}

	log.Info("received event for notification",
		zap.String("event_type", event.EventType),
		zap.String("source", event.Source),
	)

	// TODO: 根据 event.EventType 创建对应通知
	// 例如：PipelineFailed → 发送失败通知
	//       ApprovalCreated → 发送审批提醒
	//       DeploymentCompleted → 发送部署成功通知

	msg.Ack()
}
