package main

import (
	"context"
	"net/http"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"orion/pandawiki-svc-go/internal/config"
	"orion/pandawiki-svc-go/internal/handler"
	"orion/pandawiki-svc-go/internal/repository"
	"orion/pandawiki-svc-go/internal/service"
	"orion/go-common/pkg/auth"
	 nats_subscriber "orion/pandawiki-svc-go/internal/nats"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"

	orionredis "orion/go-common/pkg/redis"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-pandawiki-svc"))
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

	// NATS JetStream subscriber
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

	repo := repository.NewRepository(db.DB)
	svc := service.NewService(repo)
	h := handler.NewHandler(svc)

	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))
	rg := r.Group("/api/v1")
	rg.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))
	h.RegisterRoutes(rg)

	r.GET("/healthz", middleware.HealthCheck("orion-pandawiki-svc"))

	addr := fmt.Sprintf(":%d", cfg.Port)
	logger.Info("pandawiki-svc listening", zap.String("addr", addr))
	srv := &http.Server{Addr: addr, Handler: r}

	go func() {
	    if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
	        logger.Fatal("server failed", zap.Error(err))
	    }
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	if natsSub != nil {
	    if err := natsSub.Close(); err != nil {
	        logger.Warn("failed to close NATS subscriber", zap.Error(err))
	    }
	}
	srv.Shutdown(shutdownCtx)
}
