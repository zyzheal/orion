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

	r.GET("/metrics", middleware.MetricsHandler())
	r.GET("/healthz", middleware.HealthCheck("orion-knowledge-svc-go"))
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
