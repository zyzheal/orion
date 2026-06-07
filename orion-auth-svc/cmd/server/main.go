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
	authmw "orion/auth-svc/internal/middleware"
	"orion/auth-svc/internal/sso"
	"orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	"orion/go-common/pkg/otel"
	"orion/go-common/pkg/redis"

	"github.com/gin-gonic/gin"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"go.uber.org/zap"
)

func main() {
	// Load config (auth-svc has service-specific fields like RS256 keys)
	cfg, err := config.Load()
	if err != nil {
		panic("failed to load config: " + err.Error())
	}

	// Initialize structured logger via go-common
	zapLogger := logger.Must(logger.Config{
		Level:       "info",
		Development: cfg.Environment == "development",
		ServiceName: cfg.ServiceName,
	})
	defer zapLogger.Sync()

	// Initialize OTel via go-common
	shutdown, err := otel.Init(otel.Config{
		ServiceName: cfg.ServiceName,
		Endpoint:    cfg.OTelEndpoint,
		Insecure:    true,
	})
	if err != nil {
		zapLogger.Warn("failed to init OTel", zap.Error(err))
	}
	defer shutdown(context.Background())

	// Connect to database
	db, err := sqlx.Connect("postgres", cfg.DatabaseURL)
	if err != nil {
		zapLogger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Run database migrations
	if err := runMigrations(cfg.DatabaseURL, zapLogger); err != nil {
		zapLogger.Fatal("migration failed", zap.Error(err))
	}

	// Initialize Redis via go-common
	rdb := redis.NewClient(redis.Config{
		Addr: cfg.RedisAddr,
		DB:   cfg.RedisDB,
	})
	defer rdb.Close()

	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Setup router with shared middleware
	r := gin.New()
	r.Use(middleware.RequestID())
	r.Use(middleware.Recovery(zapLogger))
	r.Use(middleware.StructuredLogger(zapLogger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))

	r.GET("/metrics", middleware.MetricsHandler())

	// Health check with dependency verification
	r.GET("/health", func(c *gin.Context) {
		status := gin.H{
			"status":    "healthy",
			"service":   cfg.ServiceName,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		}
		if err := db.Ping(); err != nil {
			status["status"] = "unhealthy"
			status["db"] = "error"
			status["db_error"] = err.Error()
			c.JSON(http.StatusServiceUnavailable, status)
			return
		}
		status["db"] = "ok"
		if err := rdb.Ping(c.Request.Context()).Err(); err != nil {
			status["status"] = "unhealthy"
			status["redis"] = "error"
			status["redis_error"] = err.Error()
			c.JSON(http.StatusServiceUnavailable, status)
			return
		}
		status["redis"] = "ok"
		c.JSON(http.StatusOK, status)
	})

	h := handler.New(db, rdb, zapLogger, cfg)

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

	// SSO routes (OIDC, LDAP, WeChat via unified SSO handler)
	ssoH := handler.NewSSOHandler(handler.SSOConfig{
		OIDC: sso.OIDCConfig{
			Issuer:       cfg.OIDCIssuer,
			ClientID:     cfg.OIDCClientID,
			ClientSecret: cfg.OIDCClientSecret,
			RedirectURI:  cfg.OIDCRedirectURI,
		},
		LDAP: sso.LDAPConfig{
			URL:            cfg.LDAPURL,
			BindDN:         cfg.LDAPBindDN,
			BindPassword:   cfg.LDAPBindPassword,
			UserSearchBase: cfg.LDAPUserBaseDN,
			UserFilter:     cfg.LDAPUserFilter,
			GroupBaseDN:    cfg.LDAPGroupBaseDN,
		},
		WeChat: sso.WeChatConfig{
			AppID:       cfg.WeChatCorpID,
			AppSecret:   cfg.WeChatCorpSecret,
			RedirectURI: cfg.OIDCRedirectURI,
			AgentID:     cfg.WeChatAgentID,
		},
		Logger: zapLogger,
	}, func(ctx context.Context, tenantID, email, username, source string) (string, string, int, error) {
		// Token issuer: find or create user, then issue JWT tokens
		user, err := h.FindOrCreateSSOUser(ctx, tenantID, email, username, source)
		if err != nil {
			return "", "", 0, err
		}
		tokens, err := h.IssueTokensForUser(ctx, user)
		if err != nil {
			return "", "", 0, err
		}
		return tokens.AccessToken, tokens.RefreshToken, tokens.ExpiresIn, nil
	})

	ssoRoutes := r.Group("/api/v1/auth/sso")
	{
		ssoRoutes.GET("/oidc/login", ssoH.OIDCLoginRedirect)
		ssoRoutes.GET("/oidc/callback", ssoH.OIDCCallback)
		ssoRoutes.GET("/oidc/providers", ssoH.OIDCProviders)
		ssoRoutes.POST("/ldap/login", ssoH.LDAPLogin)
		ssoRoutes.GET("/wechat/login", ssoH.WechatLoginRedirect)
		ssoRoutes.GET("/wechat/callback", ssoH.WechatCallback)
		ssoRoutes.GET("/wechat-work/login", ssoH.WechatWorkLoginRedirect)
		ssoRoutes.GET("/wechat-work/callback", ssoH.WechatWorkCallback)
	}

	// Auth routes (authenticated) — uses auth-svc's own Auth middleware
	authProtected := r.Group("/api/v1/auth")
	authProtected.Use(authmw.Auth(rdb, cfg.JWTSecret))
	{
		authProtected.GET("/me", h.GetMe)
		authProtected.PUT("/password", h.ChangePassword)
		authProtected.POST("/sessions", h.ListSessions)
		authProtected.DELETE("/sessions/:id", h.RevokeSession)
	}

	// Token management (admin)
	tokens := r.Group("/api/v1/tokens")
	tokens.Use(authmw.Auth(rdb, cfg.JWTSecret))
	tokens.Use(authmw.RequireRole("admin"))
	{
		tokens.POST("/blacklist", h.AddToBlacklist)
		tokens.GET("/blacklist/:token_id", h.GetBlacklistEntry)
		tokens.DELETE("/blacklist/:token_id", h.RemoveFromBlacklist)
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
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		zapLogger.Fatal("server forced to shutdown", zap.Error(err))
	}
}

func runMigrations(dbURL string, logger *zap.Logger) error {
	m, err := migrate.New("file://migrations", dbURL)
	if err != nil {
		return err
	}
	defer m.Close()

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return err
	}
	logger.Info("database migrations applied or up-to-date")
	return nil
}
