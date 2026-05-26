package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"orion/tenant-svc/internal/config"
	"orion/tenant-svc/internal/handler"
	"orion/tenant-svc/internal/middleware"
	"orion/tenant-svc/internal/otel"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
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
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "orion-tenant-svc", "timestamp": time.Now().UTC().Format(time.RFC3339)})
	})

	h := handler.New(db, logger, cfg)

	// Tenant routes (system admin only)
	admin := r.Group("/api/v1/tenants")
	admin.Use(middleware.Auth(cfg.JWTSecret))
	admin.Use(middleware.RequireRole("admin"))
	{
		admin.POST("", h.CreateTenant)
		admin.GET("", h.ListTenants)
		admin.GET("/:id", h.GetTenant)
		admin.PUT("/:id", h.UpdateTenant)
		admin.DELETE("/:id", h.DeleteTenant)
		admin.PUT("/:id/status", h.UpdateTenantStatus)
	}

	// Tenant self-service (authenticated with tenant context)
	self := r.Group("/api/v1/tenant")
	self.Use(middleware.Auth(cfg.JWTSecret))
	self.Use(middleware.TenantID())
	{
		self.GET("/info", h.GetMyTenant)
		self.PUT("/settings", h.UpdateTenantSettings)
		self.GET("/quota", h.GetQuota)
	}

	logger.Info("tenant service starting", zap.String("addr", cfg.HTTPAddr))

	srv := &http.Server{Addr: cfg.HTTPAddr, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server failed", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down tenant service...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}
}
