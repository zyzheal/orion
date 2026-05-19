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

	"github.com/orion-platform/orion-ops/internal/config"
	"github.com/orion-platform/orion-ops/internal/database"
)

var (
	logger *zap.Logger
	server *http.Server
)

func main() {
	// Initialize logger
	initLogger()

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

	// Setup Gin router
	router := setupRouter()

	// Create HTTP server
	server = &http.Server{
		Addr:           cfg.Server.Addr,
		Handler:        router,
		ReadTimeout:    30 * time.Second,
		WriteTimeout:   30 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}

	// Start server in goroutine
	go func() {
		logger.Info("Starting OPS service", zap.String("addr", cfg.Server.Addr))
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

func initLogger() {
	var err error
	logger, err = zap.NewProduction()
	if err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}
	defer logger.Sync()
}

func setupRouter() *gin.Engine {
	router := gin.Default()

	// Health check endpoint
	router.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"service": "orion-ops",
		})
	})

	// API routes
	router.GET("/api/v1/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"timestamp": time.Now().Unix(),
		})
	})

	// Example API endpoint
	router.GET("/api/v1/ops", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "OPS API is running",
			"endpoints": []string{
				"GET /healthz",
				"GET /api/v1/health",
				"GET /api/v1/ops",
			},
		})
	})

	return router
}

// GetLogger returns the logger instance
func GetLogger() *zap.Logger {
	return logger
}

// Custom error type for OPS errors
type OPSError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (e *OPSError) Error() string {
	return fmt.Sprintf("OPS error: %s", e.Message)
}