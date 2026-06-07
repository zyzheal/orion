package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"orion/build-svc-go/internal/config"
	"orion/build-svc-go/internal/handler"

	"orion/go-common/pkg/auth"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	"orion/go-common/pkg/otel"
	"orion/go-common/pkg/redis"

	"github.com/gin-gonic/gin"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"go.uber.org/zap"
)

func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-build-svc"))
	defer logger.Sync()

	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("failed to load config", zap.Error(err))
	}

	shutdown, err := otel.Init(otel.Config{
		ServiceName: cfg.ServiceName,
		Endpoint:    cfg.OTelEndpoint,
		Insecure:    true,
	})
	if err != nil {
		logger.Warn("failed to init OTel", zap.Error(err))
	}
	defer shutdown(context.Background())

	db, err := sqlx.Connect("postgres", cfg.DatabaseURL)
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := runMigrations(cfg.DatabaseURL, logger); err != nil {
		logger.Fatal("migration failed", zap.Error(err))
	}

	rdb := redis.NewClient(redis.Config{Addr: cfg.RedisAddr, DB: cfg.RedisDB})
	defer rdb.Close()

	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))

	r.GET("/health", func(c *gin.Context) {
		status := gin.H{
			"status":    "healthy",
			"service":   "orion-build-svc",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		}

		if err := db.Ping(); err != nil {
			status["status"] = "unhealthy"
			status["db"] = "error"
			status["db_error"] = err.Error()
			c.JSON(http.StatusServiceUnavailable, status)
			return
		}
		status["db"] = "ok"

		if err := rdb.Ping(c.Request.Context()).Err(); err != nil {
			status["status"] = "unhealthy"
			status["redis"] = "error"
			status["redis_error"] = err.Error()
			c.JSON(http.StatusServiceUnavailable, status)
			return
		}
		status["redis"] = "ok"

		c.JSON(http.StatusOK, status)
	})

	h := handler.New(db, logger)

	api := r.Group("/api/v1")
	api.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/health", "/metrics"}}))
	{
		// Build CRUD
		builds := api.Group("/builds")
		{
			builds.GET("", h.ListBuilds)
			builds.POST("", auth.RequirePermission("pipeline", "write"), h.CreateBuild)
			builds.GET("/stats", h.GetBuildStats)
			builds.GET("/count", h.Count)
			builds.GET("/pipeline-run/:runId", h.GetBuildByPipelineRun)
			builds.GET("/:id", h.GetBuild)
			builds.PUT("/:id", auth.RequirePermission("pipeline", "write"), h.UpdateBuild)
			builds.DELETE("/:id", auth.RequirePermission("pipeline", "delete"), h.DeleteBuild)

			// Build lifecycle (ported from Node.js)
			builds.POST("/:id/trigger", auth.RequirePermission("pipeline", "execute"), h.TriggerBuild)
			builds.GET("/:id/status", h.GetBuildStatus)
			builds.POST("/:id/cancel", auth.RequirePermission("pipeline", "execute"), h.CancelBuild)
			builds.POST("/:id/retry", auth.RequirePermission("pipeline", "execute"), h.RetryBuild)
			builds.GET("/:id/logs", h.GetBuildLogs)
		}

		// Build environments
		envs := api.Group("/environments")
		{
			envs.GET("", h.ListEnvironments)
			envs.POST("", auth.RequirePermission("pipeline", "write"), h.CreateEnvironment)
			envs.GET("/:id", h.GetEnvironment)
			envs.PUT("/:id", auth.RequirePermission("pipeline", "write"), h.UpdateEnvironment)
			envs.DELETE("/:id", auth.RequirePermission("pipeline", "delete"), h.DeleteEnvironment)
		}

		// Artifacts
		artifacts := api.Group("/artifacts")
		{
			artifacts.GET("", h.ListArtifacts)
			artifacts.POST("", auth.RequirePermission("pipeline", "write"), h.CreateArtifact)
			artifacts.GET("/:id", h.GetArtifact)
			artifacts.DELETE("/:id", auth.RequirePermission("pipeline", "delete"), h.DeleteArtifact)
			artifacts.POST("/:id/download", auth.RequirePermission("pipeline", "execute"), h.RecordDownload)
			artifacts.POST("/cleanup", auth.RequirePermission("pipeline", "execute"), h.CleanupExpiredArtifacts)
			artifacts.DELETE("/run/:runId", auth.RequirePermission("pipeline", "delete"), h.CleanupArtifactsByRun)
		}
	}

	logger.Info("build service starting", zap.String("addr", cfg.HTTPAddr))

	srv := &http.Server{Addr: cfg.HTTPAddr, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server failed", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down build service...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}
}

func runMigrations(dbURL string, logger *zap.Logger) error {
	m, err := migrate.New("file://migrations", dbURL)
	if err != nil {
		return err
	}
	defer m.Close()

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return err
	}
	logger.Info("database migrations applied or up-to-date")
	return nil
}
