package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"

	"github.com/orion-platform/orion-monitor-svc-go/internal/config"
	"github.com/orion-platform/orion-monitor-svc-go/internal/handler"
	"github.com/orion-platform/orion-monitor-svc-go/internal/middleware"
	"github.com/orion-platform/orion-monitor-svc-go/internal/otel"
	"github.com/orion-platform/orion-monitor-svc-go/internal/repository"
	"github.com/orion-platform/orion-monitor-svc-go/internal/service"
	"go.uber.org/zap"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to load config: %v\n", err)
		os.Exit(1)
	}

	// Initialize structured logger (zap)
	logger, err := zap.NewProduction()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	middleware.InitMiddleware(logger)

	logger.Info("starting orion-monitor-svc-go",
		zap.String("environment", cfg.Environment),
		zap.Int("port", cfg.ServerPort),
	)

	// Initialize OpenTelemetry tracer
	ctx := context.Background()
	var tp *sdktrace.TracerProvider
	if cfg.Environment != "test" {
		tp, err = otel.InitTracer(ctx, cfg.OTLPEndpoint, "orion-monitor-svc-go", "1.0.0", logger)
		if err != nil {
			logger.Warn("failed to init OpenTelemetry, continuing without tracing", zap.Error(err))
		}
	}
	if tp != nil {
		defer otel.Shutdown(context.Background(), tp, logger)
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
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		DB:       cfg.RedisDB,
		PoolSize: 10,
	})
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
	r.Use(middleware.Recover())
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLog())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Tenant-Id", "X-Request-Id"},
		ExposeHeaders:    []string{"X-Request-Id"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}))

	// Health check (no auth required)
	r.GET("/healthz", h.HealthCheck)
	r.GET("/readyz", h.HealthCheck)

	// API v1 group with Auth + TenantID middleware
	v1 := r.Group("/api/v1")
	v1.Use(middleware.Auth())
	v1.Use(middleware.TenantID())
	{
		// Metrics
		v1.POST("/metrics", h.ReportMetric)
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
		v1.POST("/alerts/:id/silence", h.SilenceAlert)
		v1.POST("/alerts/:id/resolve", h.ResolveAlert)

		// Alert Rules
		v1.GET("/alert-rules", h.QueryAlertRules)
		v1.POST("/alert-rules", h.CreateAlertRule)
		v1.GET("/alert-rules/:id", h.GetAlertRule)
		v1.PUT("/alert-rules/:id", h.UpdateAlertRule)
		v1.DELETE("/alert-rules/:id", h.DeleteAlertRule)
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

	// Graceful shutdown
	go func() {
		logger.Info("HTTP server listening", zap.String("addr", cfg.Addr()))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("HTTP server failed", zap.Error(err))
		}
	}()

	// Wait for interrupt signal
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
