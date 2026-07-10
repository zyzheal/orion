package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"orion/auth-svc-go/internal/config"
	"orion/auth-svc-go/internal/handler"
	nats_subscriber "orion/auth-svc-go/pkg/nats"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	"orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	"orion/go-common/pkg/otel"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
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

	// Redis client (optional — required for token blacklist on logout)
	var rdb *redis.Client
	if cfg.RedisAddr != "" {
		rdb = redis.NewClient(&redis.Options{Addr: cfg.RedisAddr, DB: cfg.RedisDB})
		defer rdb.Close()
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

	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(middleware.RequestID())
	r.Use(middleware.Recovery(zapLogger))
	r.Use(middleware.StructuredLogger(zapLogger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))

	r.GET("/healthz", middleware.HealthCheck("orion-auth-svc"))
	r.GET("/health", func(c *gin.Context) {
		status := gin.H{"status": "healthy", "service": "orion-auth-svc", "timestamp": time.Now().UTC().Format(time.RFC3339)}
		if err := db.Health(c.Request.Context()); err != nil {
			status["status"] = "unhealthy"
			status["db"] = "error"
			c.JSON(http.StatusServiceUnavailable, status)
			return
		}
		status["db"] = "ok"
		if rdb != nil {
			if err := rdb.Ping(c.Request.Context()).Err(); err != nil {
				status["status"] = "unhealthy"
				status["redis"] = "error"
				c.JSON(http.StatusServiceUnavailable, status)
				return
			}
			status["redis"] = "ok"
		}
		c.JSON(http.StatusOK, status)
	})

	h := handler.New(db, zapLogger, cfg.JWTSecret, rdb)

	// --- /api/auth group (public auth endpoints) ---
	authAPI := r.Group("/api/auth")
	{
		authAPI.POST("/login", h.Login)
		authAPI.POST("/refresh", h.RefreshToken)
		authAPI.POST("/logout", h.Logout)

		// Protected endpoints — require valid JWT
		protected := authAPI.Group("")
		protected.Use(auth.Auth(auth.AuthConfig{
			JWTSecret:   cfg.JWTSecret,
			RedisClient: rdb,
			SkipPaths:   []string{"/healthz"},
		}))
		{
			protected.GET("/me", h.Me)
			protected.GET("/permissions", h.Permissions)
		}
	}

	// --- /api/v1 group (existing user management endpoints) ---
	api := r.Group("/api/v1")
	{
		api.POST("/login", h.Login)
		api.POST("/refresh", h.RefreshToken)

		users := api.Group("/users")
		users.Use(auth.Auth(auth.AuthConfig{
			JWTSecret:   cfg.JWTSecret,
			RedisClient: rdb,
			SkipPaths:   []string{"/healthz"},
		}))
		{
			users.GET("", h.ListUsers)
			users.POST("", auth.RequirePermission("user", "write"), h.CreateUser)
			users.GET("/:id", h.GetUser)
			users.PUT("/:id", auth.RequirePermission("user", "write"), h.UpdateUser)
		}
	}

	// --- /sso/oidc group (OIDC SSO endpoints) ---
	sso := r.Group("/sso/oidc")
	{
		sso.GET("/authorize", h.OIDCAuthorize)
		sso.GET("/callback", h.OIDCCallback)
		sso.GET("/providers", h.OIDCListProviders)
		sso.POST("/providers", h.OIDCCreateProvider)
		sso.GET("/providers/:id", h.OIDCGetProvider)
		sso.PUT("/providers/:id", h.OIDCUpdateProvider)
		sso.DELETE("/providers/:id", h.OIDCDeleteProvider)
		sso.GET("/links", h.OIDCListLinks)
		sso.DELETE("/links/:id", h.OIDCDeleteLink)
	}

	zapLogger.Info("auth service starting", zap.String("addr", cfg.HTTPAddr))

	srv := &http.Server{Addr: cfg.HTTPAddr, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			zapLogger.Fatal("server failed", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	zapLogger.Info("shutting down auth service...")
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
