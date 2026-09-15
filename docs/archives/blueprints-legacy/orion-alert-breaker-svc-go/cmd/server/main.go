package main

import (
	"context"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/config"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	"orion/go-common/pkg/otel"

	"orion-alert-breaker-svc-go/internal/handler"
	"orion-alert-breaker-svc-go/internal/repository"
	"orion-alert-breaker-svc-go/internal/service"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	dbCfg := config.LoadDatabaseConfig()
	jwtCfg := config.LoadJWTConfig()
	httpAddr := config.Getenv("HTTP_ADDR", ":8083")

	logger := orionlog.Must(orionlog.Config{
		Level:       config.Getenv("LOG_LEVEL", "info"),
		Development: config.Getenv("ENVIRONMENT", "development") == "development",
		ServiceName: "alert-breaker-svc",
	})
	defer logger.Sync()

	shutdown, err := otel.Init(otel.Config{
		ServiceName: "alert-breaker-svc",
		Endpoint:    config.Getenv("OTEL_ENDPOINT", ""),
		Insecure:    true,
	})
	if err != nil {
		logger.Fatal("failed to init OTel", zap.Error(err))
	}
	defer shutdown(context.Background())

	ctx := context.Background()
	db, err := database.Connect(ctx, database.DefaultConfig(dbCfg.DSN()))
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	if err := database.RunMigrations(db, "migrations"); err != nil {
		logger.Warn("failed to run migrations", zap.Error(err))
	}

	// Repositories
	abRepo := repository.NewAlertBreakerRepository(db.DB)

	// Services
	abSvc := service.NewAlertBreakerService(abRepo)

	// Handlers
	abHandler := handler.NewHandler(abSvc)

	// Setup gin
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))

	// Routes
	v1 := r.Group("/api/v1")
	{
		v1.Use(auth.Auth(auth.AuthConfig{
			JWTSecret: jwtCfg.Secret,
			SkipPaths: []string{"/healthz"},
		}))
		abHandler.RegisterRoutes(v1)
	}

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	logger.Info("starting alert-breaker-svc", zap.String("addr", httpAddr))
	if err := r.Run(httpAddr); err != nil {
		logger.Fatal("server failed", zap.Error(err))
	}
}
