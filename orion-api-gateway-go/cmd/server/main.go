package main

import (
	"context"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"

	"orion/api-gateway/internal/abac"
	"orion/api-gateway/internal/config"
	"orion/api-gateway/internal/middleware"
	"orion/api-gateway/internal/proxy"
	"orion/api-gateway/internal/rbac"
	"orion/api-gateway/internal/routesync"
	"orion/api-gateway/internal/service"
	ws "orion/api-gateway/internal/websocket"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/otel"
)

func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-api-gateway"))
	defer logger.Sync()

	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("failed to load config", zap.Error(err))
	}

	shutdown, err := otel.Init(otel.Config{
		ServiceName: cfg.ServiceName,
		Endpoint:    cfg.OTelEndpoint,
		Insecure:    true,
	})
	if err != nil {
		logger.Warn("failed to init OTel", zap.Error(err))
	}
	defer shutdown(context.Background())

	rdb := middleware.NewRedisClient(cfg.RedisURL)

	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(cfg.AllowedOrigins))
	r.Use(middleware.RateLimiter(rdb, cfg.RateLimitRPS))
	r.Use(middleware.ErrorHandler())

	// CSP middleware
	if cfg.CSPEnabled {
		cspCfg := middleware.DefaultCSPConfig()
		if cfg.CSPDirectives != "" {
			cspCfg.Enabled = true
		}
		r.Use(middleware.CSP(cspCfg))
		r.POST("/api/v1/csp-report", middleware.CSPReportHandler())
	}

	// --- Initialise RBAC + ABAC ---
	rbacSvc := rbac.NewService()
	abacEngine := abac.NewEngine()
	permMW := middleware.NewPermissionMiddleware(rbacSvc, abacEngine)

	// --- Initialise API Version Manager ---
	versionRegistry := service.NewApiVersionRegistry(cfg.APIVersion)
	versionManager := service.NewApiVersionManager(versionRegistry)
	versionMW := middleware.NewVersionMiddleware(versionManager)
	r.Use(versionMW.Handler())
	middleware.RegisterVersionRoutes(r, versionManager)

	// --- Initialise Service Registry ---
	serviceRegistry := service.NewServiceRegistry()
	serviceRegistry.Register("api-gateway",
		"http://"+cfg.HTTPAddr,
		"http://"+cfg.HTTPAddr+"/healthz",
		map[string]interface{}{
			"version": "1.0.0",
			"api_paths": []string{"/healthz", "/readyz", "/version", "/metrics"},
		},
	)

	// --- Initialise Token Blacklist Checker ---
	_ = service.NewTokenBlacklistChecker(rdb) // wired via JWTAuth middleware's Redis check

	// --- Initialise Gray Release Service ---
	grayRelease := service.NewGrayReleaseService(rdb, cfg.TSServiceURL, cfg.GoServiceURL, logger)
	if cfg.GrayReleaseEnabled {
		if err := grayRelease.Connect(context.Background()); err != nil {
			logger.Warn("gray release init failed", zap.Error(err))
		}
	}

	// --- Initialise Tenant Quota + Namespace Pool ---
	tenantQuota := service.NewTenantQuotaService(rdb)
	_ = tenantQuota // available for quota enforcement
	namespacePool := service.NewNamespacePoolManager(rdb)
	_ = namespacePool // available for pool allocation

	// --- Health checks ---
	healthMW := middleware.NewHealthMiddleware()
	healthMW.RegisterCheck("redis", func() (string, string) {
		if rdb == nil {
			return "down", "Redis not configured"
		}
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		if err := rdb.Ping(ctx).Err(); err != nil {
			return "down", err.Error()
		}
		return "up", ""
	})
	r.GET("/healthz", healthMW.Handler())
	r.GET("/readyz", middleware.ReadyHandler())
	r.GET("/version", middleware.VersionHandler())

	// Health (legacy endpoint)
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"service":   cfg.ServiceName,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	})

	// Metrics
	r.GET("/metrics", middleware.MetricsHandler())

	// --- Build reverse proxy targets from config ---
	targets := map[string]*httputil.ReverseProxy{}
	for prefix, upstream := range cfg.Upstreams {
		u, err := url.Parse(upstream)
		if err != nil {
			logger.Fatal("invalid upstream URL", zap.String("prefix", prefix), zap.String("url", upstream))
		}
		targets[prefix] = proxy.NewReverseProxy(u, logger)
	}

	// --- Register proxy routes with full middleware chain ---
	apiGroup := r.Group("/api")
	apiGroup.Use(middleware.TenantPropagation())
	apiGroup.Use(middleware.JWTAuth(rdb, cfg.JWTSecret))
	apiGroup.Use(middleware.SubAppAuth(middleware.SubAppAuthConfig{
		IncludeFullContext: cfg.Environment == "development",
	}))
	apiGroup.Use(permMW.Handler())
	apiGroup.Use(middleware.GrayRoute(grayRelease))

	for prefix, target := range targets {
		apiGroup.Any(prefix+"/*path", proxy.Handler(target, prefix, logger))
	}

	// SSE proxy for pipeline logs
	if sseUpstream, ok := cfg.Upstreams["/v1/pipeline"]; ok {
		sseCfg := &proxy.SSEHandlerConfig{UpstreamBaseURL: sseUpstream}
		r.Any("/api/v1/pipelines/:id/logs/sse", proxy.SSEHandler(logger, sseCfg))
	}

	// --- WebSocket Server ---
	var wsServer *ws.ServerManager
	if cfg.EnableWebSocket {
		wsConfig := ws.DefaultConfig
		wsConfig.HeartbeatInterval = 30 * time.Second
		wsConfig.HeartbeatTimeout = 15 * time.Second
		wsServer = ws.NewServerManager(wsConfig, cfg.JWTSecret, logger)
		wsServer.RegisterRoutes(r)
		logger.Info("WebSocket server enabled", zap.String("path", wsConfig.Path))
	}

	// --- Dynamic route sync from platform service ---
	if platformURL, ok := cfg.Upstreams["/v1/platform"]; ok {
		domainMap := routesync.DomainServiceMap{
			"knowledge": cfg.Upstreams["/v1/knowledge"],
		}
		syncer := routesync.NewSyncer(platformURL, domainMap, logger)
		stopSync := syncer.StartPeriodicSync(context.Background(), r, 60*time.Second)
		defer stopSync()
		logger.Info("dynamic route sync enabled", zap.String("platform", platformURL))
	}

	logger.Info("API Gateway starting",
		zap.String("addr", cfg.HTTPAddr),
		zap.Int("upstreams", len(targets)),
	)

	srv := &http.Server{
		Addr:    cfg.HTTPAddr,
		Handler: r,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("gateway failed", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down gateway...")
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// Graceful shutdown of components
	grayRelease.Close()
	if wsServer != nil {
		wsServer.Shutdown()
	}
	serviceRegistry.Shutdown()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("gateway forced shutdown", zap.Error(err))
	}
	logger.Info("gateway stopped")
}
