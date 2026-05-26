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
	"orion/user-svc/internal/middleware"
	"orion/user-svc/internal/otel"

	"github.com/gin-gonic/gin"
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
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "orion-user-svc", "timestamp": time.Now().UTC().Format(time.RFC3339)})
	})

	h := handler.New(db, rdb, logger, cfg)

	// User CRUD (authenticated)
	users := r.Group("/api/v1/users")
	users.Use(middleware.Auth(cfg.JWTSecret))
	{
		users.GET("", h.ListUsers)
		users.GET("/:id", h.GetUser)
		users.PUT("/:id", h.UpdateUser)
		users.DELETE("/:id", h.DeleteUser)
		users.PUT("/:id/status", h.UpdateUserStatus)
	}

	// Role management (admin only)
	roles := r.Group("/api/v1/roles")
	roles.Use(middleware.Auth(cfg.JWTSecret))
	roles.Use(middleware.RequireRole("admin"))
	{
		roles.POST("", h.CreateRole)
		roles.GET("", h.ListRoles)
		roles.GET("/:id", h.GetRole)
		roles.PUT("/:id", h.UpdateRole)
		roles.DELETE("/:id", h.DeleteRole)
	}

	// Permission management (admin only)
	perms := r.Group("/api/v1/permissions")
	perms.Use(middleware.Auth(cfg.JWTSecret))
	perms.Use(middleware.RequireRole("admin"))
	{
		perms.POST("", h.CreatePermission)
		perms.GET("", h.ListPermissions)
		perms.PUT("/:id", h.UpdatePermission)
		perms.DELETE("/:id", h.DeletePermission)
	}

	// Role-permission assignment
	rp := r.Group("/api/v1/role-permissions")
	rp.Use(middleware.Auth(cfg.JWTSecret))
	rp.Use(middleware.RequireRole("admin"))
	{
		rp.POST("", h.AssignPermissionToRole)
		rp.DELETE("", h.RemovePermissionFromRole)
		rp.GET("/:role_id", h.GetRolePermissions)
	}

	logger.Info("user service starting", zap.String("addr", cfg.HTTPAddr))

	srv := &http.Server{Addr: cfg.HTTPAddr, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server failed", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down user service...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}
}
