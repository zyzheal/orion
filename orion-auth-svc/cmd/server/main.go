package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"orion/auth-svc/internal/config"
	"orion/auth-svc/internal/handler"
	"orion/auth-svc/internal/middleware"
	"orion/auth-svc/internal/otel"

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
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"service":   "orion-auth-svc",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	})

	h := handler.New(db, rdb, logger, cfg)

	// Auth routes (public)
	auth := r.Group("/api/v1/auth")
	{
		auth.POST("/login", h.Login)
		auth.POST("/register", h.Register)
		auth.POST("/refresh", h.RefreshToken)
		auth.POST("/logout", h.Logout)
		auth.POST("/ldap/login", h.LDAPLogin)
		auth.POST("/wechat/login", h.WechatLogin)
	}

	// Auth routes (authenticated)
	authProtected := r.Group("/api/v1/auth")
	authProtected.Use(middleware.Auth(rdb, cfg.JWTSecret))
	{
		authProtected.GET("/me", h.GetMe)
		authProtected.PUT("/password", h.ChangePassword)
		authProtected.POST("/sessions", h.ListSessions)
		authProtected.DELETE("/sessions/:id", h.RevokeSession)
	}

	// Token management (admin)
	tokens := r.Group("/api/v1/tokens")
	tokens.Use(middleware.Auth(rdb, cfg.JWTSecret))
	tokens.Use(middleware.RequireRole("admin"))
	{
		tokens.POST("/blacklist", h.AddToBlacklist)
		tokens.GET("/blacklist/:token_id", h.GetBlacklistEntry)
		tokens.DELETE("/blacklist/:token_id", h.RemoveFromBlacklist)
	}

	logger.Info("auth service starting",
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

	logger.Info("shutting down auth service...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}
}
