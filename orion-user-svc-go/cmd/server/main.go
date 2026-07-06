package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"orion/user-svc-go/internal/config"
	"orion/user-svc-go/internal/handler"
	"orion/user-svc-go/internal/nats"
	usmw "orion/user-svc-go/internal/middleware"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	"orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	"orion/go-common/pkg/otel"
	"orion/go-common/pkg/redis"

	"github.com/gin-gonic/gin"
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
	r.GET("/healthz", middleware.HealthCheck("orion-user-svc-go"))
	r.GET("/health", func(c *gin.Context) {
		status := gin.H{"status": "healthy", "service": "orion-user-svc-go", "timestamp": time.Now().UTC().Format(time.RFC3339)}
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

	// NATS JetStream subscriber
	var natsSub *nats.NATSSubscriber
	if cfg.NATSAddr != "" {
		sub, err := nats.NewNATSSubscriber(cfg.NATSAddr, cfg.NATSStream, zapLogger)
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

	zapLogger.Info("user service (go) starting", zap.String("addr", cfg.HTTPAddr))

	srv := &http.Server{Addr: cfg.HTTPAddr, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			zapLogger.Fatal("server failed", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	zapLogger.Info("shutting down user service (go)...")
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
