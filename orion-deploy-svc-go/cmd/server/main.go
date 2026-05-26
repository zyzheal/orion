package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"orion/deploy-svc-go/internal/config"
	"orion/deploy-svc-go/internal/handler"
	"orion/deploy-svc-go/internal/middleware"
	"orion/deploy-svc-go/internal/otel"

	"github.com/gin-gonic/gin"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("failed to load config", zap.Error(err))
	}

	shutdown, err := otel.Init(cfg.ServiceName, cfg.OTelEndpoint)
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

	rdb := redis.NewClient(&redis.Options{
		Addr: cfg.RedisAddr,
		DB:   cfg.RedisDB,
	})
	defer rdb.Close()

	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS())

	r.GET("/metrics", middleware.MetricsHandler())

	r.GET("/health", func(c *gin.Context) {
		status := gin.H{
			"status":    "healthy",
			"service":   "orion-deploy-svc",
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
	api.Use(middleware.Auth(rdb, cfg.JWTSecret))
	{
		deployments := api.Group("/deployments")
		{
			deployments.GET("", h.ListDeployments)
			deployments.POST("", h.CreateDeployment)
			deployments.GET("/:id", h.GetDeployment)
			deployments.PUT("/:id", h.UpdateDeployment)
			deployments.DELETE("/:id", h.DeleteDeployment)
			deployments.POST("/:id/rollback", h.Rollback)
		}
	}

	logger.Info("deploy service starting",
		zap.String("addr", cfg.HTTPAddr),
	)

	srv := &http.Server{Addr: cfg.HTTPAddr, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server failed", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down deploy service...")
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
