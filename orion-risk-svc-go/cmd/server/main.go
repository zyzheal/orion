package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"orion/risk-svc-go/internal/config"
	"orion/risk-svc-go/internal/handler"
	"orion/risk-svc-go/internal/repository"
	"orion/risk-svc-go/internal/service"
	"orion/go-common/pkg/database"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode)
	dbCfg := database.DefaultConfig(dsn)

	ctx := context.Background()
	db, err := database.Connect(ctx, dbCfg)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Close()

	migrationsDir := "migrations"
	if _, err := os.Stat(migrationsDir); err == nil {
		if err := database.RunMigrations(db, migrationsDir); err != nil {
			log.Printf("warning: failed to run migrations: %v", err)
		}
	}

	repo := repository.NewRepository(db.DB)
	svc := service.NewService(repo)
	h := handler.NewHandler(svc)

	r := gin.Default()
	rg := r.Group("/api/v1")
	h.RegisterRoutes(rg)

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("risk-svc listening on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
