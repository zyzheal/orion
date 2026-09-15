package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	auth_config "orion/identity-svc-go/internal/auth/config"
	auth_handler "orion/identity-svc-go/internal/auth/handler"
	auth_nats "orion/identity-svc-go/pkg/nats"

	user_config "orion/identity-svc-go/internal/user/config"
	user_handler "orion/identity-svc-go/internal/user/handler"
	user_nats "orion/identity-svc-go/internal/user/nats"
	usermw "orion/identity-svc-go/internal/user/middleware"

	tenant_handler "orion/identity-svc-go/internal/tenant/handler"
	tenant_repo "orion/identity-svc-go/internal/tenant/repository"
	tenant_service "orion/identity-svc-go/internal/tenant/service"
	session_handler "orion/identity-svc-go/internal/session/handler"
	session_repo "orion/identity-svc-go/internal/session/repository"
	session_service "orion/identity-svc-go/internal/session/service"
	apikey_handler "orion/identity-svc-go/internal/apikey/handler"
	apikey_repo "orion/identity-svc-go/internal/apikey/repository"
	apikey_service "orion/identity-svc-go/internal/apikey/service"
	confirmation_handler "orion/identity-svc-go/internal/confirmation/handler"
	confirmation_repo "orion/identity-svc-go/internal/confirmation/repository"
	confirmation_service "orion/identity-svc-go/internal/confirmation/service"
	sso_handler "orion/identity-svc-go/internal/sso/handler"
	sso_repo "orion/identity-svc-go/internal/sso/repository"
	sso_service "orion/identity-svc-go/internal/sso/service"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	"orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	"orion/go-common/pkg/otel"
	"orion/go-common/pkg/redis"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"go.uber.org/zap"
)

func main() {
	authCfg, err := auth_config.Load()
	if err != nil {
		panic("failed to load auth config: " + err.Error())
	}

	zapLogger := logger.Must(logger.Config{
		Level:       "info",
		Development: authCfg.Environment == "development",
		ServiceName: "orion-identity-svc",
	})
	defer zapLogger.Sync()

	shutdown, err := otel.Init(otel.Config{
		ServiceName: "orion-identity-svc",
		Endpoint:    authCfg.OTelEndpoint,
		Insecure:    true,
	})
	if err != nil {
		zapLogger.Warn("failed to init OTel", zap.Error(err))
	}
	defer shutdown(context.Background())

	db, err := database.Connect(context.Background(), database.DefaultConfig(authCfg.DatabaseURL))
	if err != nil {
		zapLogger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	// Run database migrations
	if _, err := os.Stat("migrations"); err == nil {
		if err := database.RunMigrations(db, "migrations/auth"); err != nil {
			log.Printf("warning: failed to run migrations: %v", err)
		}
	}

	rdb := redis.NewClient(redis.Config{Addr: authCfg.RedisAddr, DB: authCfg.RedisDB})
	defer rdb.Close()

	if authCfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(middleware.RequestID())
	r.Use(middleware.Recovery(zapLogger))
	r.Use(middleware.StructuredLogger(zapLogger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))

	r.GET("/healthz", middleware.HealthCheck("orion-identity-svc"))
	r.GET("/health", func(c *gin.Context) {
		status := gin.H{"status": "healthy", "service": "orion-identity-svc", "timestamp": time.Now().UTC().Format(time.RFC3339)}
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

	// Auth handler
	ah := auth_handler.New(db, zapLogger, authCfg.JWTSecret, rdb)

	// Auth NATS
	var authNatsSub *auth_nats.NATSSubscriber
	if authCfg.NATSAddr != "" {
		sub, err := auth_nats.NewNATSSubscriber(authCfg.NATSAddr, authCfg.NATSStream, zapLogger)
		if err != nil {
			zapLogger.Warn("failed to init NATS subscriber", zap.Error(err))
		} else {
			authNatsSub = sub
			if err := authNatsSub.Start(context.Background()); err != nil {
				zapLogger.Warn("failed to start NATS subscriber", zap.Error(err))
				authNatsSub = nil
			}
		}
	}

	// User handler
	userCfg, _ := user_config.Load()
	uh := user_handler.New(db, rdb, zapLogger, userCfg)

	// User NATS
	var userNatsSub *user_nats.NATSSubscriber
	if userCfg.NATSAddr != "" {
		sub, err := user_nats.NewNATSSubscriber(userCfg.NATSAddr, userCfg.NATSStream, zapLogger)
		if err != nil {
			zapLogger.Warn("failed to init user NATS subscriber", zap.Error(err))
		} else {
			userNatsSub = sub
			if err := userNatsSub.Start(context.Background()); err != nil {
				zapLogger.Warn("failed to start user NATS subscriber", zap.Error(err))
				userNatsSub = nil
			}
		}
	}

	// Tenant handler
	tenantRepo := tenant_repo.NewTenantRepository(db)
	tenantSvc := tenant_service.NewTenantService(tenantRepo, zapLogger)
	quotaSvc := tenant_service.NewQuotaService(tenantRepo, zapLogger)
	isolationSvc := tenant_service.NewTenantIsolationService(zapLogger)

	// session services
	sessionRepo := session_repo.NewRepository(db.DB)
	sessionSvc := session_service.NewService(sessionRepo)
	sessionH := session_handler.NewHandler(sessionSvc)

	// apikey services
	apikeyRepo := apikey_repo.NewRepository(db.DB)
	apikeySvc := apikey_service.NewService(apikeyRepo)
	apikeyH := apikey_handler.NewHandler(apikeySvc)

	// confirmation services
	confirmationRepo := confirmation_repo.NewRepository(db.DB)
	confirmationSvc := confirmation_service.NewService(confirmationRepo)
	confirmationH := confirmation_handler.NewHandler(confirmationSvc)

	// sso services
	ssoRepo := sso_repo.NewRepository(db.DB)
	ssoSvc := sso_service.NewService(ssoRepo)
	ssoH := sso_handler.NewHandler(ssoSvc)
	th := tenant_handler.New(tenantSvc, quotaSvc, isolationSvc, tenantRepo, zapLogger)

	// ========= Routes =========

	// Auth routes
	authAPI := r.Group("/api/auth")
	{
		authAPI.POST("/login", ah.Login)
		authAPI.POST("/refresh", ah.RefreshToken)
		authAPI.POST("/logout", ah.Logout)

		protected := authAPI.Group("")
		protected.Use(auth.Auth(auth.AuthConfig{JWTSecret: authCfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))
		{
			protected.GET("/me", ah.Me)
			protected.GET("/permissions", ah.Permissions)
		}
	}

	// Legacy /api/v1 routes (auth + user)
	api := r.Group("/api/v1")
	{
		api.POST("/login", ah.Login)
		api.POST("/refresh", ah.RefreshToken)

		users := api.Group("/users")
		users.Use(usermw.Auth(rdb, authCfg.JWTSecret))
		{
			users.GET("", uh.ListUsers)
			users.GET("/:id", uh.GetUser)
			users.PUT("/:id", auth.RequirePermission("user", "write"), uh.UpdateUser)
			users.DELETE("/:id", auth.RequirePermission("user", "delete"), uh.DeleteUser)
			users.PUT("/:id/status", auth.RequirePermission("user", "write"), uh.UpdateUserStatus)
		}

		roles := api.Group("/roles")
		roles.Use(usermw.Auth(rdb, authCfg.JWTSecret))
		roles.Use(usermw.RequireRole("admin"))
		{
			roles.POST("", auth.RequirePermission("user", "write"), uh.CreateRole)
			roles.GET("", uh.ListRoles)
			roles.GET("/:id", uh.GetRole)
			roles.PUT("/:id", auth.RequirePermission("user", "write"), uh.UpdateRole)
			roles.DELETE("/:id", auth.RequirePermission("user", "delete"), uh.DeleteRole)
		}

		perms := api.Group("/permissions")
		perms.Use(usermw.Auth(rdb, authCfg.JWTSecret))
		perms.Use(usermw.RequireRole("admin"))
		{
			perms.POST("", auth.RequirePermission("user", "write"), uh.CreatePermission)
			perms.GET("", uh.ListPermissions)
			perms.PUT("/:id", auth.RequirePermission("user", "write"), uh.UpdatePermission)
			perms.DELETE("/:id", auth.RequirePermission("user", "delete"), uh.DeletePermission)
		}

		rp := api.Group("/role-permissions")
		rp.Use(usermw.Auth(rdb, authCfg.JWTSecret))
		rp.Use(usermw.RequireRole("admin"))
		{
			rp.POST("", auth.RequirePermission("user", "write"), uh.AssignPermissionToRole)
			rp.DELETE("", auth.RequirePermission("user", "delete"), uh.RemovePermissionFromRole)
			rp.GET("/:role_id", uh.GetRolePermissions)
		}
	}

	// SSO OIDC
	sso := r.Group("/sso/oidc")
	{
		sso.GET("/authorize", ah.OIDCAuthorize)
		sso.GET("/callback", ah.OIDCCallback)
		sso.GET("/providers", ah.OIDCListProviders)
		sso.POST("/providers", ah.OIDCCreateProvider)
		sso.GET("/providers/:id", ah.OIDCGetProvider)
		sso.PUT("/providers/:id", ah.OIDCUpdateProvider)
		sso.DELETE("/providers/:id", ah.OIDCDeleteProvider)
		sso.GET("/links", ah.OIDCListLinks)
		sso.DELETE("/links/:id", ah.OIDCDeleteLink)
	}

	// Tenant routes
	tenantAPI := r.Group("/api/v1/tenant")
	{
		tenantAPI.POST("", th.CreateTenant)
		tenantAPI.GET("", th.ListTenants)
		tenantAPI.GET("/:id", th.GetTenant)
		tenantAPI.PUT("/:id", th.UpdateTenant)
		tenantAPI.DELETE("/:id", th.DeleteTenant)

		tenantAPI.GET("/:id/quota", th.GetQuota)
		tenantAPI.PUT("/:id/quota", th.UpdateQuota)

		tenantAPI.GET("/:id/namespaces", th.GetNamespaces)
		tenantAPI.POST("/:id/namespaces/allocate", th.AllocateNamespace)
		tenantAPI.DELETE("/:id/namespaces/:namespace_name", th.ReleaseNamespace)

		tenantAPI.GET("/pool/status", th.GetPoolStatus)
		sessionH.RegisterRoutes(api)
		apikeyH.RegisterRoutes(api)
		confirmationH.RegisterRoutes(api)
		ssoH.RegisterRoutes(api)
		tenantAPI.GET("/namespaces", th.GetTenantNamespacesList)

		tenantAPI.GET("/rls/status/:table", th.GetRLSStatus)
		tenantAPI.POST("/session/variable", th.SetTenantSessionVariable)
	}

	zapLogger.Info("identity service starting", zap.String("addr", authCfg.HTTPAddr))

	srv := &http.Server{Addr: authCfg.HTTPAddr, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			zapLogger.Fatal("server failed", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	zapLogger.Info("shutting down identity service...")
	if authNatsSub != nil {
		if err := authNatsSub.Close(); err != nil {
			zapLogger.Warn("failed to close auth NATS subscriber", zap.Error(err))
		}
	}
	if userNatsSub != nil {
		if err := userNatsSub.Close(); err != nil {
			zapLogger.Warn("failed to close user NATS subscriber", zap.Error(err))
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		zapLogger.Fatal("server forced to shutdown", zap.Error(err))
	}
}
