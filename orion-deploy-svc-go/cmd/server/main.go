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
	nats_subscriber "orion/deploy-svc-go/pkg/nats"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	"orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	"orion/go-common/pkg/otel"
	"orion/go-common/pkg/redis"

	"github.com/gin-gonic/gin"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"go.uber.org/zap"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		panic("failed to load config: " + err.Error())
	}

	zapLogger := logger.Must(logger.Config{
		Level:       "info",
		Development: cfg.Environment == "development",
		ServiceName: cfg.ServiceName,
	})
	defer zapLogger.Sync()

	shutdown, err := otel.Init(otel.Config{
		ServiceName: cfg.ServiceName,
		Endpoint:    cfg.OTelEndpoint,
		Insecure:    true,
	})
	if err != nil {
		zapLogger.Warn("failed to init OTel", zap.Error(err))
	}
	defer shutdown(context.Background())

	db, err := database.Connect(context.Background(), database.DefaultConfig(cfg.DatabaseURL))
	if err != nil {
		zapLogger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	if err := runMigrations(cfg.DatabaseURL, zapLogger); err != nil {
		zapLogger.Fatal("migration failed", zap.Error(err))
	}

	rdb := redis.NewClient(redis.Config{Addr: cfg.RedisAddr, DB: cfg.RedisDB})
	defer rdb.Close()

	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(middleware.RequestID())
	r.Use(middleware.Recovery(zapLogger))
	r.Use(middleware.StructuredLogger(zapLogger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))

	r.GET("/healthz", middleware.HealthCheck("orion-deploy-svc"))
	r.GET("/health", func(c *gin.Context) {
		status := gin.H{"status": "healthy", "service": "orion-deploy-svc", "timestamp": time.Now().UTC().Format(time.RFC3339)}
		if err := db.Health(c.Request.Context()); err != nil {
			status["status"] = "unhealthy"
			status["db"] = "error"
			c.JSON(http.StatusServiceUnavailable, status)
			return
		}
		status["db"] = "ok"
		if err := rdb.Ping(c.Request.Context()).Err(); err != nil {
			status["status"] = "unhealthy"
			status["redis"] = "error"
			c.JSON(http.StatusServiceUnavailable, status)
			return
		}
		status["redis"] = "ok"
		c.JSON(http.StatusOK, status)
	})

	h := handler.New(db, zapLogger)

	api := r.Group("/api/v1")
	api.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz", "/health", "/metrics"}}))
	{
		deployments := api.Group("/deployments")
		{
			deployments.GET("", h.ListDeployments)
			deployments.POST("", auth.RequirePermission("deployment", "write"), h.CreateDeployment)
			deployments.GET("/count", h.Count)
			deployments.GET("/latest", h.GetLatestDeployment)
			deployments.GET("/environments", h.GetEnvironments)
			deployments.GET("/stats", h.GetDeployStats)
			deployments.GET("/build/:buildId", h.GetDeploymentsByBuild)
			deployments.GET("/:id", h.GetDeployment)
			deployments.PUT("/:id", auth.RequirePermission("deployment", "write"), h.UpdateDeployment)
			deployments.DELETE("/:id", auth.RequirePermission("deployment", "delete"), h.DeleteDeployment)
			deployments.POST("/:id/start", auth.RequirePermission("deployment", "execute"), h.StartDeployment)
			deployments.POST("/:id/complete", auth.RequirePermission("deployment", "execute"), h.CompleteDeployment)
			deployments.POST("/:id/cancel", auth.RequirePermission("deployment", "execute"), h.CancelDeployment)
			deployments.POST("/:id/rollback", auth.RequirePermission("deployment", "execute"), h.Rollback)
			deployments.GET("/:id/events", h.GetDeploymentEvents)
		}
	}

	// NATS JetStream subscriber
	var natsSub *nats_subscriber.NATSSubscriber
	if cfg.NATSAddr != "" {
		sub, err := nats_subscriber.NewNATSSubscriber(cfg.NATSAddr, cfg.NATSStream, zapLogger)
		if err != nil {
			zapLogger.Warn("failed to init NATS subscriber", zap.Error(err))
		} else {
			natsSub = sub
			if err := natsSub.Start(context.Background()); err != nil {
				zapLogger.Warn("failed to start NATS subscriber", zap.Error(err))
				natsSub = nil
			}
		}
	}

	zapLogger.Info("deploy service starting", zap.String("addr", cfg.HTTPAddr))

	srv := &http.Server{Addr: cfg.HTTPAddr, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			zapLogger.Fatal("server failed", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	zapLogger.Info("shutting down deploy service...")
	if natsSub != nil {
		if err := natsSub.Close(); err != nil {
			zapLogger.Warn("failed to close NATS subscriber", zap.Error(err))
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		zapLogger.Fatal("server forced to shutdown", zap.Error(err))
	}
}

func runMigrations(dbURL string, log *zap.Logger) error {
	m, err := migrate.New("file://migrations", dbURL)
	if err != nil {
		return err
	}
	defer m.Close()
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return err
	}
	log.Info("database migrations applied or up-to-date")
	return nil
}
