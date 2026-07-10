package main

import (
	"context"

	"orion/artifact-svc-go/internal/artifact/handler"
	"orion/artifact-svc-go/internal/artifact/repository"
	"orion/artifact-svc-go/internal/artifact/service"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/config"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	"orion/go-common/pkg/otel"
	"orion/go-common/pkg/redis"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	// Load configuration from environment
	dbCfg := config.LoadDatabaseConfig()
	jwtCfg := config.LoadJWTConfig()
	redisCfg := config.LoadRedisConfig()
	httpAddr := config.Getenv("HTTP_ADDR", ":8080")

	// Initialize structured logger
	logger := orionlog.Must(orionlog.Config{
		Level:       config.Getenv("LOG_LEVEL", "info"),
		Development: config.Getenv("ENVIRONMENT", "development") == "development",
		ServiceName: "artifact-svc",
	})
	defer logger.Sync()

	// Initialize OpenTelemetry
	shutdown, err := otel.Init(otel.Config{
		ServiceName: "artifact-svc",
		Endpoint:    config.Getenv("OTEL_ENDPOINT", ""),
		Insecure:    true,
	})
	if err != nil {
		logger.Fatal("failed to init OTel", zap.Error(err))
	}
	defer shutdown(context.Background())

	// Connect to database
	ctx := context.Background()
	db, err := database.Connect(ctx, database.DefaultConfig(dbCfg.DSN()))
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	// Run migrations
	if err := database.RunMigrations(db, "migrations"); err != nil {
		logger.Warn("failed to run migrations", zap.Error(err))
	}

	// Initialize Redis client
	rdb := redis.NewClient(redis.Config{
		Addr:     redisCfg.Addr,
		Password: redisCfg.Password,
		DB:       redisCfg.DB,
	})
	defer rdb.Close()

	// Wire up layers
	repo := repository.NewRepository(db.DB)
	svc := service.NewService(repo)
	h := handler.NewHandler(svc)

	// Setup router with shared middleware
	r := gin.New()
	r.Use(middleware.RequestID())
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))

	// Health check
	r.GET("/healthz", middleware.HealthCheck("artifact-svc"))

	// API routes with auth
	rg := r.Group("/api/v1")
	rg.Use(auth.Auth(auth.AuthConfig{
		JWTSecret:   jwtCfg.Secret,
		RedisClient: rdb,
		SkipPaths:   []string{"/healthz"},
	}))
	h.RegisterRoutes(rg)

	logger.Info("artifact-svc starting", zap.String("addr", httpAddr))
	if err := r.Run(httpAddr); err != nil {
		logger.Fatal("server error", zap.Error(err))
	}
}
