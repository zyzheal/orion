package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	"orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	"orion/go-common/pkg/otel"
	orionredis "orion/go-common/pkg/redis"
	"orion-tool-svc-go/internal/config"
	"orion-tool-svc-go/internal/handler"
	"orion-tool-svc-go/internal/repository"
	"orion-tool-svc-go/internal/service"
	"orion-tool-svc-go/pkg/nats"
)

func runMigrations(db *database.DB) error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS tools (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id VARCHAR(64) NOT NULL,
			name VARCHAR(128) NOT NULL,
			display_name VARCHAR(256),
			description TEXT,
			category VARCHAR(64) NOT NULL,
			type VARCHAR(32) NOT NULL,
			version VARCHAR(32) NOT NULL,
			config JSONB DEFAULT '{}',
			endpoint VARCHAR(512),
			auth_type VARCHAR(32) DEFAULT 'none',
			auth_config JSONB DEFAULT '{}',
			tags JSONB DEFAULT '[]',
			status VARCHAR(32) DEFAULT 'active',
			created_by VARCHAR(64) NOT NULL,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW(),
			deprecated_at TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS tool_versions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
			version VARCHAR(32) NOT NULL,
			config JSONB DEFAULT '{}',
			changelog TEXT,
			created_by VARCHAR(64),
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS tool_categories (
			id VARCHAR(64) PRIMARY KEY,
			tenant_id VARCHAR(64) NOT NULL,
			name VARCHAR(128) NOT NULL,
			display_name VARCHAR(256),
			description TEXT,
			icon VARCHAR(64),
			sort_order INT DEFAULT 0,
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS tool_invocations (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
			tenant_id VARCHAR(64) NOT NULL,
			input JSONB DEFAULT '{}',
			output JSONB DEFAULT '{}',
			status VARCHAR(32) NOT NULL,
			error TEXT,
			duration BIGINT DEFAULT 0,
			called_by VARCHAR(64),
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_tools_tenant ON tools(tenant_id)`,
		`CREATE INDEX IF NOT EXISTS idx_tools_category ON tools(tenant_id, category)`,
		`CREATE INDEX IF NOT EXISTS idx_tools_status ON tools(tenant_id, status)`,
		`CREATE INDEX IF NOT EXISTS idx_tools_name ON tools(tenant_id, name)`,
		`CREATE INDEX IF NOT EXISTS idx_tool_versions_tool ON tool_versions(tool_id)`,
		`CREATE INDEX IF NOT EXISTS idx_tool_invocations_tool ON tool_invocations(tool_id)`,
		`CREATE INDEX IF NOT EXISTS idx_tool_invocations_tenant ON tool_invocations(tenant_id)`,
		`CREATE INDEX IF NOT EXISTS idx_tool_categories_tenant ON tool_categories(tenant_id)`,
	}

	for _, m := range migrations {
		if _, err := db.Exec(m); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}
	return nil
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		panic("failed to load config: " + err.Error())
	}

	zapLogger := logger.Must(logger.Config{
		Level:       "info",
		Development: cfg.Server.Mode == "debug",
		ServiceName: cfg.Otel.ServiceName,
	})
	defer zapLogger.Sync()

	shutdown, err := otel.Init(otel.Config{
		ServiceName: cfg.Otel.ServiceName,
		Endpoint:    cfg.Otel.Endpoint,
		Insecure:    true,
	})
	if err != nil {
		zapLogger.Warn("failed to init OTel", zap.Error(err))
	}
	defer shutdown(context.Background())

	db, err := database.Connect(context.Background(), database.DefaultConfig(cfg.Database.DSN()))
	if err != nil {
		zapLogger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	if err := runMigrations(db); err != nil {
		zapLogger.Fatal("failed to run migrations", zap.Error(err))
	}
	zapLogger.Info("migrations completed")

	rdb := orionredis.NewClient(orionredis.Config{Addr: cfg.Redis.Addr, DB: cfg.Redis.DB})
	defer rdb.Close()

	gin.SetMode(cfg.Server.Mode)
	r := gin.New()
	r.Use(middleware.RequestID())
	r.Use(middleware.Recovery(zapLogger))
	r.Use(middleware.StructuredLogger(zapLogger))
	r.Use(middleware.CORS(middleware.CORSConfig{
		AllowOrigins: cfg.CORS.Origins,
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type", "Authorization", "X-Tenant-ID", "X-User-ID"},
	}))

	toolRepo := repository.NewToolRepository(db)
	invRepo := repository.NewInvocationRepository(db)
	versionRepo := repository.NewVersionRepository(db)
	toolSvc := service.NewToolService(toolRepo, invRepo, versionRepo)
	toolHandler := handler.NewToolHandler(toolSvc)

	v1 := r.Group("/api/v1")
	v1.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWT.Secret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))
	{
		v1.GET("/tools", toolHandler.ListTools)
		v1.POST("/tools", auth.RequirePermission("tool", "write"), toolHandler.CreateTool)
		v1.GET("/tools/search", toolHandler.SearchTools)
		v1.GET("/tools/categories", toolHandler.GetCategories)
		v1.GET("/tools/:id", toolHandler.GetTool)
		v1.PUT("/tools/:id", auth.RequirePermission("tool", "write"), toolHandler.UpdateTool)
		v1.DELETE("/tools/:id", auth.RequirePermission("tool", "delete"), toolHandler.DeleteTool)
		v1.GET("/tools/:id/versions", toolHandler.GetVersions)
		v1.GET("/tools/:id/invocations", toolHandler.GetInvocations)
	}

	r.GET("/healthz", func(c *gin.Context) {
		if err := db.Health(c.Request.Context()); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy", "db": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "orion-tool-svc", "version": "1.0.0"})
	})

	r.GET("/readyz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})

	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	zapLogger.Info("starting tool service", zap.Int("port", cfg.Server.Port))

	srv := &http.Server{Addr: addr, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			zapLogger.Fatal("server failed", zap.Error(err))
		}
	}()

	// Initialize NATS JetStream subscriber (graceful degradation)
	var natssub *nats.NATSSubscriber
	if natssub, err = nats.NewNATSSubscriber(cfg.NATS.Addr, cfg.NATS.Stream, zapLogger); err != nil {
		zapLogger.Warn("NATS subscriber unavailable, continuing without event streaming",
			zap.String("addr", cfg.NATS.Addr), zap.Error(err))
		natssub = nil
	}

	// Start NATS subscriber after server is running
	if natssub != nil {
		go func() {
			if err := natssub.Start(context.Background()); err != nil {
				zapLogger.Warn("failed to start NATS subscriber", zap.Error(err))
			}
		}()
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	zapLogger.Info("shutting down tool service...")
	if natssub != nil {
		natssub.Close()
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		zapLogger.Fatal("server forced to shutdown", zap.Error(err))
	}
}
