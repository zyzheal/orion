package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"orion/middleware-ops-svc-go/internal/config"
	"orion/middleware-ops-svc-go/internal/handler"
	"orion/middleware-ops-svc-go/internal/repository"
	"orion/middleware-ops-svc-go/internal/service"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	nats_subscriber "orion/middleware-ops-svc-go/pkg/nats"
	orionredis "orion/go-common/pkg/redis"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-middleware-ops-svc"))
	defer logger.Sync()

	cfg := config.Load()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	dbCfg := database.DefaultConfig(cfg.DSN)
	db, err := database.Connect(ctx, dbCfg)
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	if err := database.RunMigrations(db, "migrations"); err != nil {
		logger.Warn("warning: failed to run migrations", zap.Error(err))
	}

	rdb := orionredis.NewClient(orionredis.Config{Addr: cfg.RedisAddr})
	defer rdb.Close()

	instanceRepo := repository.NewInstanceRepository(db.DB)
	backupRepo := repository.NewBackupRepository(db.DB)
	metricRepo := repository.NewMetricRepository(db.DB)
	connPoolRepo := repository.NewConnectionPoolRepository(db.DB)
	mqStatsRepo := repository.NewMqStatsRepository(db.DB)
	alertRepo := repository.NewAlertRepository(db.DB)

	svc := service.NewService(instanceRepo, backupRepo, metricRepo, connPoolRepo, mqStatsRepo, alertRepo)
	h := handler.NewHandler(svc)

	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))
	api := r.Group("/api/v1")
	api.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))
	h.RegisterRoutes(api)

	r.GET("/healthz", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

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

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: r}

	go func() {
		logger.Info("middleware-ops-svc listening", zap.String("addr", ":"+cfg.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("listen", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down middleware-ops-svc...")
	if natsSub != nil {
		if err := natsSub.Close(); err != nil {
			logger.Warn("failed to close NATS subscriber", zap.Error(err))
		}
	}
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	srv.Shutdown(shutdownCtx)
}
