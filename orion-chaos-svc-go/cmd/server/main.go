package main

import (
	"context"
	"fmt"

	"orion/chaos-svc-go/internal/config"
	"orion/chaos-svc-go/internal/handler"
	"orion/chaos-svc-go/internal/repository"
	"orion/chaos-svc-go/internal/service"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	"orion/go-common/pkg/redis"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-chaos-svc"))
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

	rdb := redis.NewClient(redis.Config{Addr: cfg.RedisAddr})
	defer rdb.Close()

	chaosRepo := repository.NewChaosRepository(db.DB)
	chaosSvc := service.NewChaosService(chaosRepo)
	h := handler.NewHandler(chaosSvc)

	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))

	rg := r.Group("/api/v1")
	rg.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))

	h.RegisterRoutes(rg)

	r.GET("/healthz", middleware.HealthCheck("orion-chaos-svc"))

	addr := fmt.Sprintf(":%d", cfg.ServerPort)
	logger.Info("chaos-svc starting", zap.String("addr", addr))
	if err := r.Run(addr); err != nil {
		logger.Fatal("failed to start server", zap.Error(err))
	}
}
