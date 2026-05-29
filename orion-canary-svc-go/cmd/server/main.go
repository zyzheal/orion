package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"orion/canary-svc-go/internal/config"
	"orion/canary-svc-go/internal/handler"
	"orion/canary-svc-go/internal/repository"
	"orion/canary-svc-go/internal/service"
	"orion/go-common/pkg/database"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	// Build DSN from config
	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode)

	dbCfg := database.DefaultConfig(dsn)

	ctx := context.Background()
	db, err := database.Connect(ctx, dbCfg)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Close()

	// Run migrations
	migrationsDir := "migrations"
	if _, err := os.Stat(migrationsDir); err == nil {
		if err := database.RunMigrations(db, migrationsDir); err != nil {
			log.Printf("warning: failed to run migrations: %v", err)
		}
	}

	canaryRepo := repository.NewCanaryRepository(db.DB)
	canarySvc := service.NewCanaryService(canaryRepo)
	h := handler.NewHandler(canarySvc)

	r := gin.Default()
	rg := r.Group("/api/v1")
	h.RegisterRoutes(rg)

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	addr := fmt.Sprintf(":%d", cfg.ServerPort)
	log.Printf("canary-svc starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}
