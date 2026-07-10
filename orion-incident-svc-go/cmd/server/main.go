package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"orion/incident-svc-go/internal/config"
	"orion/incident-svc-go/internal/handler"
	isvw "orion/incident-svc-go/internal/middleware"
	nats_subscriber "orion/incident-svc-go/pkg/nats"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	"orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	"orion/go-common/pkg/otel"
	"orion/go-common/pkg/redis"

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

	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(middleware.RequestID())
	r.Use(middleware.Recovery(zapLogger))
	r.Use(middleware.StructuredLogger(zapLogger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))

	r.GET("/metrics", middleware.MetricsHandler())
	r.GET("/healthz", middleware.HealthCheck("orion-incident-svc-go"))
	r.GET("/health", func(c *gin.Context) {
		status := gin.H{"status": "healthy", "service": "orion-incident-svc-go", "timestamp": time.Now().UTC().Format(time.RFC3339)}
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

	// NATS JetStream subscriber
	var natsSub *nats_subscriber.NATSSubscriber
	if cfg.NATSAddr != "" {
		sub, err := nats_subscriber.NewNATSSubscriber(cfg.NATSAddr, cfg.NATSStream, zapLogger)
		if err != nil {
			zapLogger.Warn("failed to init NATS subscriber", zap.Error(err))
		} else {
			natsSub = sub
			if err := natsSub.Start(ctx); err != nil {
				zapLogger.Warn("failed to start NATS subscriber", zap.Error(err))
				natsSub = nil
			}
		}
	}

	h := handler.New(db, rdb, zapLogger, cfg)

	incidents := r.Group("/api/v1/incidents")
	incidents.Use(isvw.Auth(rdb, cfg.JWTSecret))
	{
		incidents.POST("", auth.RequirePermission("incident", "write"), h.CreateIncident)
		incidents.GET("", h.ListIncidents)
		incidents.GET("/stats", h.GetStats)
		incidents.GET("/:id", h.GetIncident)
		incidents.PUT("/:id", auth.RequirePermission("incident", "write"), h.UpdateIncident)
		incidents.DELETE("/:id", auth.RequirePermission("incident", "delete"), h.DeleteIncident)
		incidents.PATCH("/:id/status", auth.RequirePermission("incident", "write"), h.UpdateStatus)
		incidents.PATCH("/:id/assign", auth.RequirePermission("incident", "write"), h.AssignCommander)
		incidents.POST("/:id/escalate", auth.RequirePermission("incident", "write"), h.EscalateIncident)
		incidents.GET("/:id/escalations", h.GetEscalationHistory)
		incidents.GET("/:id/sla", h.CheckSLABreach)
		incidents.POST("/:id/sla/breach", auth.RequirePermission("incident", "write"), h.MarkSLABreach)
		incidents.POST("/:id/timeline", auth.RequirePermission("incident", "write"), h.AddTimelineEvent)
		incidents.GET("/:id/timeline", h.GetTimeline)
		incidents.GET("/:id/knowledge", h.GetKnowledgeRecommendations)
		incidents.POST("/:id/link-problem", auth.RequirePermission("incident", "write"), h.LinkProblem)
		incidents.POST("/:id/link-change", auth.RequirePermission("incident", "write"), h.LinkChange)
		incidents.POST("/:id/postmortem", auth.RequirePermission("incident", "write"), h.CreatePostmortem)
		incidents.GET("/:id/postmortem", h.GetPostmortem)
		incidents.PUT("/:id/postmortem", auth.RequirePermission("incident", "write"), h.UpdatePostmortem)
		incidents.POST("/:id/postmortem/publish", auth.RequirePermission("incident", "write"), h.PublishPostmortem)
		incidents.POST("/:id/postmortem/archive", auth.RequirePermission("incident", "write"), h.ArchivePostmortem)
	}

	// Postmortems list (separate group)
	postmortems := r.Group("/api/v1/postmortems")
	postmortems.Use(isvw.Auth(rdb, cfg.JWTSecret))
	{
		postmortems.GET("", h.ListPostmortems)
	}

	zapLogger.Info("incident service (go) starting", zap.String("addr", cfg.HTTPAddr))

	srv := &http.Server{Addr: cfg.HTTPAddr, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			zapLogger.Fatal("server failed", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	zapLogger.Info("shutting down incident service (go)...")
	if natsSub != nil {
		if err := natsSub.Close(); err != nil {
			zapLogger.Warn("failed to close NATS subscriber", zap.Error(err))
		}
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		zapLogger.Fatal("server forced to shutdown", zap.Error(err))
	}
}
