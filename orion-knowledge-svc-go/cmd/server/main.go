package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"orion/go-common/pkg/auth"
	 nats_subscriber "orion/knowledge-svc-go/internal/nats"
	"orion/go-common/pkg/database"
	"orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	"orion/go-common/pkg/otel"
	"orion/go-common/pkg/redis"
	"orion/knowledge-svc-go/internal/config"
	"orion/knowledge-svc-go/internal/handler"
	ksvw "orion/knowledge-svc-go/internal/middleware"
	"orion/knowledge-svc-go/internal/repository"
	"orion/knowledge-svc-go/internal/service"

	knowledge_handler "orion/knowledge-svc-go/internal/knowledge/handler"
	knowledge_repo "orion/knowledge-svc-go/internal/knowledge/repository"
	knowledge_service "orion/knowledge-svc-go/internal/knowledge/service"
	mcp_handler "orion/knowledge-svc-go/internal/mcp/handler"
	mcp_repo "orion/knowledge-svc-go/internal/mcp/repository"
	mcp_service "orion/knowledge-svc-go/internal/mcp/service"
	vectorstore_handler "orion/knowledge-svc-go/internal/vector-store/handler"
	vectorstore_repo "orion/knowledge-svc-go/internal/vector-store/repository"
	vectorstore_service "orion/knowledge-svc-go/internal/vector-store/service"
	vectorizerules_handler "orion/knowledge-svc-go/internal/vectorize-rules/handler"
	vectorizerules_repo "orion/knowledge-svc-go/internal/vectorize-rules/repository"
	vectorizerules_service "orion/knowledge-svc-go/internal/vectorize-rules/service"
	vector_handler "orion/knowledge-svc-go/internal/vector/handler"
	vector_repo "orion/knowledge-svc-go/internal/vector/repository"
	vector_service "orion/knowledge-svc-go/internal/vector/service"

	"github.com/gin-gonic/gin"
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

	ctx := context.Background()
	db, err := database.Connect(ctx, database.DefaultConfig(cfg.DatabaseURL))
	if err != nil {
		zapLogger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	rdb := redis.NewClient(redis.Config{Addr: cfg.RedisAddr, DB: cfg.RedisDB})
	defer rdb.Close()

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
	r.Use(gin.Logger())

	r.GET("/healthz", middleware.HealthCheck("orion-knowledge-svc"))
	r.GET("/readyz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})

	rg := r.Group("/api/v1")
	rg.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))

	// knowledge services
	knowledgeModRepo := knowledge_repo.NewRepository(db.DB)
	knowledgeModSvc := knowledge_service.NewService(knowledgeModRepo)
	knowledgeModH := knowledge_handler.NewHandler(knowledgeModSvc)

	// mcp services
	mcpModRepo := mcp_repo.NewRepository(db.DB)
	mcpModSvc := mcp_service.NewService(mcpModRepo)
	mcpModH := mcp_handler.NewHandler(mcpModSvc)

	// vector-store services
	vstoreModRepo := vectorstore_repo.NewRepository(db.DB)
	vstoreModSvc := vectorstore_service.NewService(vstoreModRepo)
	vstoreModH := vectorstore_handler.NewHandler(vstoreModSvc)

	// vectorize-rules services
	vrulesModRepo := vectorizerules_repo.NewRepository(db.DB)
	vrulesModSvc := vectorizerules_service.NewService(vrulesModRepo)
	vrulesModH := vectorizerules_handler.NewHandler(vrulesModSvc)

	// vector services
	vectorModRepo := vector_repo.NewRepository(db.DB)
	vectorModSvc := vector_service.NewService(vectorModRepo)
	vectorModH := vector_handler.NewHandler(vectorModSvc)


	r.GET("/metrics", middleware.MetricsHandler())

	knowledgeModH.RegisterRoutes(rg)
	mcpModH.RegisterRoutes(rg)
	vstoreModH.RegisterRoutes(rg)
	vrulesModH.RegisterRoutes(rg)
	vectorModH.RegisterRoutes(rg)

	r.GET("/health", func(c *gin.Context) {
		status := gin.H{"status": "healthy", "service": "orion-knowledge-svc-go", "timestamp": time.Now().UTC().Format(time.RFC3339)}
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

	knowledgeRepo := repository.NewKnowledgeRepository(db)
	knowledgeSvc := service.NewKnowledgeService(knowledgeRepo)
	h := handler.New(cfg, knowledgeSvc, zapLogger)

	api := r.Group("/api/v1")
	api.Use(ksvw.Auth(rdb, cfg.JWTSecret))
	{
		// Spaces
		spaces := api.Group("/knowledge/spaces")
		{
			spaces.GET("", h.ListSpaces)
			spaces.POST("", auth.RequirePermission("knowledge", "write"), h.CreateSpace)
			spaces.GET("/:id", h.GetSpace)
			spaces.PUT("/:id", auth.RequirePermission("knowledge", "write"), h.UpdateSpace)
			spaces.DELETE("/:id", auth.RequirePermission("knowledge", "delete"), h.DeleteSpace)
		}

		// Documents
		docs := api.Group("/knowledge/docs")
		{
			docs.GET("", h.ListDocs)
			docs.GET("/tags", h.GetDocTags)
			docs.GET("/toc", h.GetDocToc)
			docs.POST("", auth.RequirePermission("knowledge", "write"), h.CreateDoc)
			docs.GET("/:id", h.GetDoc)
			docs.PUT("/:id", auth.RequirePermission("knowledge", "write"), h.UpdateDoc)
			docs.DELETE("/:id", auth.RequirePermission("knowledge", "delete"), h.DeleteDoc)
			docs.GET("/:id/versions", h.GetDocVersions)
		}

		// Sync
		api.POST("/knowledge/sync", auth.RequirePermission("knowledge", "write"), h.TriggerSync)
		api.GET("/knowledge/sync/logs", h.GetSyncLogs)

		// RAG
		rag := api.Group("/knowledge/rag")
		{
			rag.POST("/retrieve", h.RAGRetrieve)
			rag.POST("/query", h.RAGQuery)
		}

		// Knowledge Graph
		api.GET("/knowledge/graph", h.GetGraph)
	}

	zapLogger.Info("knowledge service (go) starting", zap.String("addr", cfg.HTTPAddr))

	srv := &http.Server{Addr: cfg.HTTPAddr, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			zapLogger.Fatal("server failed", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	zapLogger.Info("shutting down knowledge service (go)...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if natsSub != nil {
	    if err := natsSub.Close(); err != nil {
	        zapLogger.Warn("failed to close NATS subscriber", zap.Error(err))
	    }
	}
	if err := srv.Shutdown(ctx); err != nil {
		zapLogger.Fatal("server forced to shutdown", zap.Error(err))
	}
}
