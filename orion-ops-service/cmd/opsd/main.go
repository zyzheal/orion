package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/orion-platform/orion-ops/api/rest"
	"github.com/orion-platform/orion-ops/internal/config"
	"github.com/orion-platform/orion-ops/internal/database"
	"github.com/orion-platform/orion-ops/internal/executor"
	"github.com/orion-platform/orion-ops/internal/middleware"
	"github.com/orion-platform/orion-ops/internal/scheduler"
	"github.com/orion-platform/orion-ops/internal/terminal"
)

func main() {
	// Initialize logger
	logger, err := zap.NewProduction()
	if err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}
	defer logger.Sync()

	// Load configuration
	cfg, err := config.Load("")
	if err != nil {
		logger.Fatal("Failed to load configuration", zap.Error(err))
	}

	// Initialize database
	if err := database.Init(&cfg.Database); err != nil {
		logger.Fatal("Failed to initialize database", zap.Error(err))
	}
	defer func() {
		if err := database.Close(); err != nil {
			logger.Error("Failed to close database", zap.Error(err))
		}
	}()

	// Auto-migrate database schema
	if err := database.AutoMigrate(); err != nil {
		logger.Fatal("Failed to migrate database schema", zap.Error(err))
	}
	logger.Info("Database schema migrated successfully")

	// Initialize database
	db := database.GetDB()

	// Initialize terminal manager
	terminalMgr := terminal.NewManager(db, nil)

	// Initialize batch executor
	batchExecutor := executor.NewBatchExecutor(db)

	// Initialize cron scheduler
	cronScheduler := scheduler.NewCronScheduler(db)

	// Setup Gin router with auth middleware and registered routes
	router := setupRouter(terminalMgr, batchExecutor, cronScheduler)

	// Create HTTP server
	server := &http.Server{
		Addr:           cfg.Server.Addr,
		Handler:        router,
		ReadTimeout:    30 * time.Second,
		WriteTimeout:   30 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}

	// Start server in goroutine
	go func() {
		logger.Info("Starting Ops service", zap.String("addr", cfg.Server.Addr))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Failed to start server", zap.Error(err))
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.Error("Server forced to shutdown", zap.Error(err))
	}

	logger.Info("Server exited")
}

// setupRouter creates and configures the Gin router with auth middleware and all routes registered
func setupRouter(terminalMgr *terminal.Manager, batchExecutor *executor.BatchExecutor, cronScheduler *scheduler.CronScheduler) *gin.Engine {
	router := gin.Default()

	// Health check endpoints (no auth required)
	router.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"service": "orion-ops",
		})
	})

	router.GET("/api/v1/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"timestamp": time.Now().Unix(),
		})
	})

	// Register all Ops API routes with JWT auth middleware
	rest.RegisterRoutes(router, terminalMgr, batchExecutor, cronScheduler, middleware.AuthMiddleware())

	return router
}

// Custom error type for Ops errors
type OPSError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (e *OPSError) Error() string {
	return fmt.Sprintf("OPS error: %s", e.Message)
}
