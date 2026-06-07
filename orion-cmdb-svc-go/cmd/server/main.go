package main

import (
	"context"
	"fmt"
	"net/http"

	_ "github.com/lib/pq"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"

	"orion/go-common/pkg/auth"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	"orion/go-common/pkg/otel"
	"orion/go-common/pkg/redis"
	orionredis "orion/go-common/pkg/redis"

	"orion-cmdb-svc-go/internal/config"
	"orion-cmdb-svc-go/internal/handler"
	"orion-cmdb-svc-go/internal/repository"
	"orion-cmdb-svc-go/internal/service"
)

func runMigrations(db *sqlx.DB) error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS ci_items (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			name VARCHAR(255),
			ci_type VARCHAR(100),
			status VARCHAR(50),
			owner VARCHAR(255),
			attributes JSONB,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS ci_relations (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			source_ci_id UUID,
			target_ci_id UUID,
			relation_type VARCHAR(100)
		)`,
		`CREATE TABLE IF NOT EXISTS ci_audit_log (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			ci_id UUID,
			action VARCHAR(50),
			actor VARCHAR(255),
			old_value JSONB,
			new_value JSONB,
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_ci_tenant ON ci_items(tenant_id)`,
		`CREATE INDEX IF NOT EXISTS idx_ci_type ON ci_items(ci_type)`,
		`CREATE INDEX IF NOT EXISTS idx_ci_status ON ci_items(status)`,
		`CREATE INDEX IF NOT EXISTS idx_relations_tenant ON ci_relations(tenant_id)`,
		`CREATE INDEX IF NOT EXISTS idx_relations_source ON ci_relations(source_ci_id)`,
		`CREATE INDEX IF NOT EXISTS idx_relations_target ON ci_relations(target_ci_id)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_tenant ON ci_audit_log(tenant_id)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_ci ON ci_audit_log(ci_id)`,
	}

	for _, sql := range migrations {
		if _, err := db.Exec(sql); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}
	return nil
}

func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-cmdb-svc"))
	defer logger.Sync()

	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("failed to load config", zap.Error(err))
	}

	ctx := context.Background()
	shutdown, err := otel.Init(otel.Config{
		ServiceName: cfg.Otel.ServiceName,
		Endpoint:    cfg.Otel.Endpoint,
		Insecure:    true,
	})
	if err != nil {
		logger.Warn("failed to init tracer", zap.Error(err))
	}
	defer shutdown(ctx)

	db, err := sqlx.Connect("postgres", cfg.Database.DSN())
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	if err := runMigrations(db); err != nil {
		logger.Fatal("failed to run migrations", zap.Error(err))
	}
	logger.Info("migrations completed")

	gin.SetMode(cfg.Server.Mode)
	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))

	rdb := orionredis.NewClient(redis.Config{Addr: cfg.RedisAddr})
	defer rdb.Close()

	ciRepo := repository.NewCIRepository(db)
	relRepo := repository.NewCIRelationRepository(db)
	auditRepo := repository.NewCIAuditRepository(db)
	ciSvc := service.NewCIService(ciRepo, relRepo, auditRepo)
	ciHandler := handler.NewCIHandler(ciSvc)

	v1 := r.Group("/api/v1")
	v1.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))
	{
		v1.GET("/ci-items", ciHandler.ListCIItems)
		v1.POST("/ci-items", auth.RequirePermission("cmdb", "write"), ciHandler.CreateCIItem)
		v1.GET("/ci-items/:id", ciHandler.GetCIItem)
		v1.PUT("/ci-items/:id", auth.RequirePermission("cmdb", "write"), ciHandler.UpdateCIItem)
		v1.DELETE("/ci-items/:id", auth.RequirePermission("cmdb", "delete"), ciHandler.DeleteCIItem)
		v1.GET("/ci-items/:id/topology", ciHandler.GetTopology)
		v1.GET("/ci-relations", ciHandler.ListCIRelations)
		v1.POST("/ci-relations", auth.RequirePermission("cmdb", "write"), ciHandler.CreateRelation)
		v1.DELETE("/ci-relations/:id", auth.RequirePermission("cmdb", "delete"), ciHandler.DeleteRelation)
		v1.GET("/ci-items/count", ciHandler.Count)
	}

	r.GET("/healthz", func(c *gin.Context) {
		if err := db.Ping(); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy", "db": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "orion-cmdb-svc",
			"version": "1.0.0",
		})
	})

	r.GET("/readyz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})

	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	logger.Info("starting cmdb service", zap.Int("port", cfg.Server.Port))
	if err := r.Run(addr); err != nil {
		logger.Fatal("server failed", zap.Error(err))
	}
}
