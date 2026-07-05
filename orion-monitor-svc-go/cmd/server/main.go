package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"orion/go-common/pkg/auth"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	"orion/go-common/pkg/otel"
	orionredis "orion/go-common/pkg/redis"

	"github.com/orion-platform/orion-monitor-svc-go/internal/config"
	"github.com/orion-platform/orion-monitor-svc-go/internal/handler"
	"github.com/orion-platform/orion-monitor-svc-go/internal/repository"
	"github.com/orion-platform/orion-monitor-svc-go/internal/service"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to load config: %v\n", err)
		os.Exit(1)
	}

	logger := orionlog.Must(orionlog.Config{
		Level:       "info",
		ServiceName: "orion-monitor-svc-go",
	})
	defer logger.Sync()

	logger.Info("starting orion-monitor-svc-go",
		zap.String("environment", cfg.Environment),
		zap.Int("port", cfg.ServerPort),
	)

	ctx := context.Background()
	if cfg.Environment != "test" {
		shutdown, err := otel.Init(otel.Config{
			ServiceName: "orion-monitor-svc-go",
			Endpoint:    cfg.OTLPEndpoint,
			Insecure:    true,
		})
		if err != nil {
			logger.Warn("failed to init OpenTelemetry, continuing without tracing", zap.Error(err))
		} else {
			defer shutdown(ctx)
		}
	}

	// Initialize PostgreSQL connection pool
	dbPool, err := pgxpool.New(ctx, cfg.DSN())
	if err != nil {
		logger.Fatal("failed to connect to PostgreSQL", zap.Error(err))
	}
	defer dbPool.Close()

	if err := dbPool.Ping(ctx); err != nil {
		logger.Fatal("failed to ping PostgreSQL", zap.Error(err))
	}
	logger.Info("connected to PostgreSQL")

	// Initialize Redis client
	rdb := orionredis.NewClient(orionredis.Config{Addr: cfg.RedisAddr, DB: cfg.RedisDB})
	defer rdb.Close()

	if err := rdb.Ping(ctx).Err(); err != nil {
		logger.Warn("failed to connect to Redis, continuing without caching", zap.Error(err))
	} else {
		logger.Info("connected to Redis")
	}

	// Run database migrations
	db := repository.NewDB(dbPool, logger)
	if err := db.RunMigrations(ctx, "migrations"); err != nil {
		logger.Fatal("failed to run migrations", zap.Error(err))
	}

	// Initialize repositories
	metricRepo := repository.NewMetricRepository(db)
	traceRepo := repository.NewTraceRepository(db)
	alertRepo := repository.NewAlertRepository(db)

	// Initialize services
	metricSvc := service.NewMetricService(metricRepo, traceRepo, logger)
	alertSvc := service.NewAlertService(alertRepo, logger)

	// Initialize handlers
	h := handler.New(metricSvc, alertSvc, logger)

	// Setup Gin router
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()

	// Global middleware
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))

	// Health check (no auth required)
	r.GET("/healthz", h.HealthCheck)
	r.GET("/readyz", h.HealthCheck)

	// API v1 group with Auth + TenantID middleware
	v1 := r.Group("/api/v1")
	v1.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))
	{
		// Metrics
		v1.POST("/metrics", auth.RequirePermission("alert", "write"), h.ReportMetric)
		v1.GET("/metrics", h.QueryMetrics)

		// Traces
		v1.GET("/traces", h.QueryTraces)
		v1.GET("/traces/:trace_id", h.GetTraceDetail)

		// Services
		v1.GET("/services", h.GetServices)
		v1.GET("/services/:service_name/overview", h.GetServiceOverview)

		// Alerts
		v1.GET("/alerts", h.QueryAlerts)
		v1.GET("/alerts/:id", h.GetAlertByID)
		v1.POST("/alerts/:id/silence", auth.RequirePermission("alert", "execute"), h.SilenceAlert)
		v1.POST("/alerts/:id/resolve", auth.RequirePermission("alert", "execute"), h.ResolveAlert)

		// Alert Rules
		v1.GET("/alert-rules", h.QueryAlertRules)
		v1.POST("/alert-rules", auth.RequirePermission("alert", "write"), h.CreateAlertRule)
		v1.GET("/alert-rules/:id", h.GetAlertRule)
		v1.PUT("/alert-rules/:id", auth.RequirePermission("alert", "write"), h.UpdateAlertRule)
		v1.DELETE("/alert-rules/:id", auth.RequirePermission("alert", "delete"), h.DeleteAlertRule)
		v1.GET("/count", h.Count)
	}

	// Start HTTP server
	srv := &http.Server{
		Addr:              cfg.Addr(),
		Handler:           r,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		logger.Info("HTTP server listening", zap.String("addr", cfg.Addr()))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("HTTP server failed", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down server...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}

	logger.Info("server exited gracefully")
}
