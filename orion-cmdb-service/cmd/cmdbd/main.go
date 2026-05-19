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

	"github.com/orion-platform/orion-cmdb/api/rest"
	"github.com/orion-platform/orion-cmdb/internal/cmdb"
	"github.com/orion-platform/orion-cmdb/internal/config"
	"github.com/orion-platform/orion-cmdb/internal/database"
	"github.com/orion-platform/orion-cmdb/internal/relation"
	"github.com/orion-platform/orion-cmdb/internal/topology"
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

	// Initialize repositories
	db := database.GetDB()
	cmdbRepo := cmdb.NewRepository(db)
	relationRepo := relation.NewRepository(db)

	// Initialize services
	cmdbSvc := cmdb.NewService(cmdbRepo)
	relationSvc := relation.NewService(relationRepo)
	topologySvc := topology.NewService(cmdbSvc, relationSvc)

	// Setup Gin router with registered routes
	router := setupRouter(cmdbSvc, relationSvc, topologySvc)

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
		logger.Info("Starting CMDB service", zap.String("addr", cfg.Server.Addr))
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

// setupRouter creates and configures the Gin router with all routes registered
func setupRouter(cmdbSvc *cmdb.Service, relationSvc *relation.Service, topologySvc *topology.Service) *gin.Engine {
	router := gin.Default()

	// Health check endpoints
	router.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"service": "orion-cmdb",
		})
	})

	router.GET("/api/v1/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"timestamp": time.Now().Unix(),
		})
	})

	// Register all CMDB API routes
	rest.RegisterRoutes(router, cmdbSvc, relationSvc, topologySvc)

	return router
}

// GetLogger returns the logger instance (kept for compatibility)
func GetLogger() *zap.Logger {
	// In production, logger should be injected via dependency injection
	// This is a temporary compatibility function
	return nil
}

// Custom error type for CMDB errors
type CMDBError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (e *CMDBError) Error() string {
	return fmt.Sprintf("CMDB error: %s", e.Message)
}
