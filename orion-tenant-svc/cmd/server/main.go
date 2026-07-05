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
	tenmw "orion/tenant-svc/internal/middleware"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	"orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	"orion/go-common/pkg/otel"

	"github.com/gin-gonic/gin"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/lib/pq"
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

	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(middleware.RequestID())
	r.Use(middleware.Recovery(zapLogger))
	r.Use(middleware.StructuredLogger(zapLogger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))

	r.GET("/metrics", middleware.MetricsHandler())
	r.GET("/healthz", middleware.HealthCheck("orion-tenant-svc"))
	r.GET("/health", func(c *gin.Context) {
		status := gin.H{"status": "healthy", "service": "orion-tenant-svc", "timestamp": time.Now().UTC().Format(time.RFC3339)}
		if err := db.Health(c.Request.Context()); err != nil {
			status["status"] = "unhealthy"
			status["db"] = "error"
			c.JSON(http.StatusServiceUnavailable, status)
			return
		}
		status["db"] = "ok"
		c.JSON(http.StatusOK, status)
	})

	h := handler.New(db, zapLogger, cfg)

	// Tenant routes (system admin only)
	admin := r.Group("/api/v1/tenants")
	admin.Use(tenmw.Auth(nil, cfg.JWTSecret))
	admin.Use(tenmw.RequireRole("admin"))
	{
		admin.POST("", auth.RequirePermission("tenant", "write"), h.CreateTenant)
		admin.GET("", h.ListTenants)
		admin.GET("/:id", h.GetTenant)
		admin.PUT("/:id", auth.RequirePermission("tenant", "write"), h.UpdateTenant)
		admin.DELETE("/:id", auth.RequirePermission("tenant", "delete"), h.DeleteTenant)
		admin.PUT("/:id/status", auth.RequirePermission("tenant", "write"), h.UpdateTenantStatus)
	}

	self := r.Group("/api/v1/tenant")
	self.Use(tenmw.Auth(nil, cfg.JWTSecret))
	self.Use(tenmw.TenantID())
	{
		self.GET("/info", h.GetMyTenant)
		self.PUT("/settings", auth.RequirePermission("tenant", "write"), h.UpdateTenantSettings)
		self.GET("/quota", h.GetQuota)
	}

	zapLogger.Info("tenant service starting", zap.String("addr", cfg.HTTPAddr))

	srv := &http.Server{Addr: cfg.HTTPAddr, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			zapLogger.Fatal("server failed", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	zapLogger.Info("shutting down tenant service...")
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
