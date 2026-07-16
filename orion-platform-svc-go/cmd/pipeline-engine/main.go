package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	pe_handler "orion/platform-svc-go/internal/pipeline-engine/handler"
	pe_repo "orion/platform-svc-go/internal/pipeline-engine/repository"
	pe_service "orion/platform-svc-go/internal/pipeline-engine/service"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	"orion/go-common/pkg/errors"
	"orion/go-common/pkg/middleware"
	redis "orion/go-common/pkg/redis"

	"github.com/gin-gonic/gin"
)

func getEnv(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}

func getEnvInt(key, defaultValue string) int {
	if v := os.Getenv(key); v != "" {
		n, _ := strconv.Atoi(v)
		return n
	}
	n, _ := strconv.Atoi(defaultValue)
	return n
}

func getEnvRequired(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("required environment variable not set: %s", key)
	}
	return v
}

func main() {
	log.Println("[pipeline-engine] starting independent deployment...")

	// Load database config from environment variables
	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		getEnv("PIPELINE_ENGINE_DB_HOST", "localhost"),
		getEnvInt("PIPELINE_ENGINE_DB_PORT", "5432"),
		getEnvRequired("PIPELINE_ENGINE_DB_USER"),
		getEnvRequired("PIPELINE_ENGINE_DB_PASSWORD"),
		getEnv("PIPELINE_ENGINE_DB_NAME", "orion_pipeline-engine"),
		getEnv("PIPELINE_ENGINE_DB_SSLMODE", "disable"),
	)
	dbCfg := database.DefaultConfig(dsn)

	// Connect to database
	db, err := database.Connect(context.Background(), dbCfg)
	if err != nil {
		log.Fatalf("[pipeline-engine] failed to connect to database: %v", err)
	}
	defer db.Close()

	// Connect to Redis (for auth token validation)
	rdb := redis.NewClient(redis.Config{Addr: getEnv("REDIS_ADDR", "localhost:6379")})
	defer rdb.Close()

	// Initialize pipeline-engine components
	peRepo := pe_repo.NewRepository(db.DB)
	peEngine := pe_service.NewPipelineEngine(peRepo)
	peH := pe_handler.NewHandler(peEngine)

	// Setup gin router
	r := gin.New()
	r.Use(errors.ErrorRecovery(nil))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(nil))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))

	// Auth middleware
	rg := r.Group("/api/v1")
	rg.Use(auth.Auth(auth.AuthConfig{
		JWTSecret:   getEnv("JWT_SECRET", "change-me-in-production"),
		RedisClient: rdb,
		SkipPaths:   []string{"/healthz", "/metrics"},
	}))

	// Register only pipeline-engine routes
	peH.RegisterRoutes(rg)

	// Health endpoints (no auth)
	r.GET("/healthz", middleware.HealthCheck("orion-pipeline-engine"))
	r.GET("/metrics", middleware.MetricsHandler())

	// Listen and serve
	port := getEnvInt("PIPELINE_ENGINE_PORT", "8081")
	addr := fmt.Sprintf(":%d", port)
	log.Printf("[pipeline-engine] listening on %s", addr)

	srv := &http.Server{Addr: addr, Handler: r}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[pipeline-engine] server error: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[pipeline-engine] shutting down...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("[pipeline-engine] server forced to shutdown: %v", err)
	}
	log.Println("[pipeline-engine] shutdown complete")
}
