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
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	"orion/go-common/pkg/otel"
"orion/go-common/pkg/redis"
	cmdb_handler "orion-cmdb-svc-go/internal/cmdb/handler"
	cmdb_repo "orion-cmdb-svc-go/internal/cmdb/repository"
	cmdb_service "orion-cmdb-svc-go/internal/cmdb/service"
	servicetopology_handler "orion-cmdb-svc-go/internal/service-topology/handler"
	servicetopology_repo "orion-cmdb-svc-go/internal/service-topology/repository"
	servicetopology_service "orion-cmdb-svc-go/internal/service-topology/service"
	servicecatalog_handler "orion-cmdb-svc-go/internal/service-catalog/handler"
	servicecatalog_repo "orion-cmdb-svc-go/internal/service-catalog/repository"
	servicecatalog_service "orion-cmdb-svc-go/internal/service-catalog/service"
	datalineage_handler "orion-cmdb-svc-go/internal/data-lineage/handler"
	datalineage_repo "orion-cmdb-svc-go/internal/data-lineage/repository"
	datalineage_service "orion-cmdb-svc-go/internal/data-lineage/service"
	dataquality_handler "orion-cmdb-svc-go/internal/data-quality/handler"
	dataquality_repo "orion-cmdb-svc-go/internal/data-quality/repository"
	dataquality_service "orion-cmdb-svc-go/internal/data-quality/service"
	orionredis "orion/go-common/pkg/redis"

	"orion-cmdb-svc-go/internal/config"
	"orion-cmdb-svc-go/internal/handler"
	"orion-cmdb-svc-go/internal/repository"
	"orion-cmdb-svc-go/internal/service"

	nats_subscriber "orion-cmdb-svc-go/pkg/nats"
)

func runMigrations(db *database.DB) error {
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

	db, err := database.Connect(ctx, database.DefaultConfig(cfg.Database.DSN()))
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	if err := runMigrations(db); err != nil {
		logger.Fatal("failed to run migrations", zap.Error(err))
	}
	logger.Info("migrations completed")

	gin.SetMode(cfg.Server.Mode)


	// cmdb services
	cmdbRepo := cmdb_repo.NewRepository(db.DB)
	cmdbSvc := cmdb_service.NewService(cmdbRepo)
	cmdbH := cmdb_handler.NewHandler(cmdbSvc)

	// service-topology services
	servicetopologyRepo := servicetopology_repo.NewRepository(db.DB)
	servicetopologySvc := servicetopology_service.NewService(servicetopologyRepo)
	servicetopologyH := servicetopology_handler.NewHandler(servicetopologySvc)

	// service-catalog services
	servicecatalogRepo := servicecatalog_repo.NewRepository(db.DB)
	servicecatalogSvc := servicecatalog_service.NewService(servicecatalogRepo)
	servicecatalogH := servicecatalog_handler.NewHandler(servicecatalogSvc)

	// data-lineage services
	datalineageRepo := datalineage_repo.NewRepository(db.DB)
	datalineageSvc := datalineage_service.NewService(datalineageRepo)
	datalineageH := datalineage_handler.NewHandler(datalineageSvc)

	// data-quality services
	dataqualityRepo := dataquality_repo.NewRepository(db.DB)
	dataqualitySvc := dataquality_service.NewService(dataqualityRepo)
	dataqualityH := dataquality_handler.NewHandler(dataqualitySvc)

	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))

	rdb := orionredis.NewClient(redis.Config{Addr: cfg.RedisAddr})
	defer rdb.Close()
	// NATS JetStream subscriber
	var natsSub *nats_subscriber.NATSSubscriber
	if cfg.NATSAddr != "" {
	    sub, err := nats_subscriber.NewNATSSubscriber(cfg.NATSAddr, cfg.NATSStream, logger)
	    if err != nil {
	        logger.Warn("failed to init NATS subscriber", zap.Error(err))
	    } else {
	        natsSub = sub
	        if err := natsSub.Start(context.Background()); err != nil {
	            logger.Warn("failed to start NATS subscriber", zap.Error(err))
	            natsSub = nil
	        }
	    }
	}
	ciRepo := repository.NewCIRepository(db)
	relRepo := repository.NewCIRelationRepository(db)
	auditRepo := repository.NewCIAuditRepository(db)
	ciSvc := service.NewCIService(ciRepo, relRepo, auditRepo)
	ciHandler := handler.NewCIHandler(ciSvc)

	rg := r.Group("/api/v1")
	rg.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))

	v1 := rg
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


	cmdbH.RegisterRoutes(rg)
	servicetopologyH.RegisterRoutes(rg)
	servicecatalogH.RegisterRoutes(rg)
	datalineageH.RegisterRoutes(rg)
	dataqualityH.RegisterRoutes(rg)

	r.GET("/healthz", func(c *gin.Context) {
		if err := db.Health(c.Request.Context()); err != nil {
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

	srv := &http.Server{Addr: addr, Handler: r}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server failed", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down cmdb service...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if natsSub != nil {
	    if err := natsSub.Close(); err != nil {
	        logger.Warn("failed to close NATS subscriber", zap.Error(err))
	    }
	}
	srv.Shutdown(shutdownCtx)
}
