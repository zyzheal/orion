package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"orion/user-svc/internal/config"
	"orion/user-svc/internal/handler"
	usmw "orion/user-svc/internal/middleware"

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

	r.GET("/metrics", middleware.MetricsHandler())
	r.GET("/healthz", middleware.HealthCheck("orion-user-svc"))
	r.GET("/health", func(c *gin.Context) {
		status := gin.H{"status": "healthy", "service": "orion-user-svc", "timestamp": time.Now().UTC().Format(time.RFC3339)}
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

	h := handler.New(db, rdb, zapLogger, cfg)

	users := r.Group("/api/v1/users")
	users.Use(usmw.Auth(rdb, cfg.JWTSecret))
	{
		users.GET("", h.ListUsers)
		users.GET("/:id", h.GetUser)
		users.PUT("/:id", auth.RequirePermission("user", "write"), h.UpdateUser)
		users.DELETE("/:id", auth.RequirePermission("user", "delete"), h.DeleteUser)
		users.PUT("/:id/status", auth.RequirePermission("user", "write"), h.UpdateUserStatus)
	}

	roles := r.Group("/api/v1/roles")
	roles.Use(usmw.Auth(rdb, cfg.JWTSecret))
	roles.Use(usmw.RequireRole("admin"))
	{
		roles.POST("", auth.RequirePermission("user", "write"), h.CreateRole)
		roles.GET("", h.ListRoles)
		roles.GET("/:id", h.GetRole)
		roles.PUT("/:id", auth.RequirePermission("user", "write"), h.UpdateRole)
		roles.DELETE("/:id", auth.RequirePermission("user", "delete"), h.DeleteRole)
	}

	perms := r.Group("/api/v1/permissions")
	perms.Use(usmw.Auth(rdb, cfg.JWTSecret))
	perms.Use(usmw.RequireRole("admin"))
	{
		perms.POST("", auth.RequirePermission("user", "write"), h.CreatePermission)
		perms.GET("", h.ListPermissions)
		perms.PUT("/:id", auth.RequirePermission("user", "write"), h.UpdatePermission)
		perms.DELETE("/:id", auth.RequirePermission("user", "delete"), h.DeletePermission)
	}

	rp := r.Group("/api/v1/role-permissions")
	rp.Use(usmw.Auth(rdb, cfg.JWTSecret))
	rp.Use(usmw.RequireRole("admin"))
	{
		rp.POST("", auth.RequirePermission("user", "write"), h.AssignPermissionToRole)
		rp.DELETE("", auth.RequirePermission("user", "delete"), h.RemovePermissionFromRole)
		rp.GET("/:role_id", h.GetRolePermissions)
	}

	zapLogger.Info("user service starting", zap.String("addr", cfg.HTTPAddr))

	srv := &http.Server{Addr: cfg.HTTPAddr, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			zapLogger.Fatal("server failed", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	zapLogger.Info("shutting down user service...")
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
