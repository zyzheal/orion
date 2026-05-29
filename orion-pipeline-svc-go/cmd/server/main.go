package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"orion/pipeline-svc-go/internal/config"
	"orion/pipeline-svc-go/internal/handler"
	"orion/pipeline-svc-go/internal/repository"
	"orion/pipeline-svc-go/internal/service"
	"orion/go-common/pkg/database"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db, err := database.ConnectWithRetry(ctx, database.DefaultConfig(cfg.DatabaseURL), 3)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Close()

	// Run migrations
	if err := database.RunMigrations(db, "migrations"); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	}

	// Initialize repositories
	pipelineRepo := repository.NewPipelineRepository(db.DB)
	runRepo := repository.NewRunRepository(db.DB)
	stageRepo := repository.NewStageRepository(db.DB)

	// Initialize services
	pipelineSvc := service.NewPipelineService(pipelineRepo, runRepo, stageRepo)

	// Initialize handler
	h := handler.NewHandler(pipelineSvc)

	// Setup router
	r := gin.Default()

	// Health check
	r.GET("/healthz", func(c *gin.Context) {
		if err := db.Health(c.Request.Context()); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy", "error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// API routes
	v1 := r.Group("/api/v1")
	h.RegisterRoutes(v1)

	// Graceful shutdown
	srv := &http.Server{
		Addr:    cfg.HTTPAddr,
		Handler: r,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	log.Printf("%s started on %s", cfg.ServiceName, cfg.HTTPAddr)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("server forced to shutdown: %v", err)
	}
	log.Println("server exited")
}
