package main

import (
	"context"
	"fmt"
	"net/http"

	_ "github.com/lib/pq"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
	"go.uber.org/zap"

	"orion-cmdb-svc-go/internal/config"
	"orion-cmdb-svc-go/internal/handler"
	"orion-cmdb-svc-go/internal/middleware"
	"orion-cmdb-svc-go/internal/otel"
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
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("failed to load config", zap.Error(err))
	}

	ctx := context.Background()
	cleanupTracer, err := otel.InitTracer(ctx, &cfg.Otel, logger)
	if err != nil {
		logger.Warn("failed to init tracer", zap.Error(err))
	}
	defer cleanupTracer()

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
	r.Use(gin.Recovery())
	r.Use(otelgin.Middleware(cfg.Otel.ServiceName))
	r.Use(cors.Default())

	authMW := middleware.NewAuthMiddleware(cfg)

	ciRepo := repository.NewCIRepository(db)
	relRepo := repository.NewCIRelationRepository(db)
	auditRepo := repository.NewCIAuditRepository(db)
	ciSvc := service.NewCIService(ciRepo, relRepo, auditRepo)
	ciHandler := handler.NewCIHandler(ciSvc)

	v1 := r.Group("/api/v1")
	v1.Use(authMW.Handle(), middleware.TenantMiddleware())
	{
		v1.GET("/ci-items", ciHandler.ListCIItems)
		v1.POST("/ci-items", ciHandler.CreateCIItem)
		v1.GET("/ci-items/:id", ciHandler.GetCIItem)
		v1.PUT("/ci-items/:id", ciHandler.UpdateCIItem)
		v1.DELETE("/ci-items/:id", ciHandler.DeleteCIItem)
		v1.GET("/ci-items/:id/topology", ciHandler.GetTopology)
		v1.GET("/ci-relations", ciHandler.ListCIRelations)
		v1.POST("/ci-relations", ciHandler.CreateRelation)
		v1.DELETE("/ci-relations/:id", ciHandler.DeleteRelation)
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
