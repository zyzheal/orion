package main

import (
	"context"
	"log"
	"orion/inspection-svc-go/internal/config"
	"orion/inspection-svc-go/internal/handler"
	"orion/inspection-svc-go/internal/repository"
	"orion/inspection-svc-go/internal/service"
	"orion/go-common/pkg/database"
	"github.com/gin-gonic/gin"
)

func main() {
	ctx := context.Background()
	cfg := config.Load()

	dbCfg := database.DefaultConfig(cfg.DSN)
	db, err := database.Connect(ctx, dbCfg)
	if err != nil { log.Fatalf("db connect: %v", err) }
	defer db.Close()

	if err := database.RunMigrations(db, "migrations"); err != nil { log.Fatalf("migrations: %v", err) }

	ruleRepo := repository.NewRuleRepository(db.DB)
	resultRepo := repository.NewResultRepository(db.DB)
	svc := service.NewService(ruleRepo, resultRepo)
	h := handler.NewHandler(svc)

	r := gin.Default()
	rg := r.Group("/api/v1")
	h.RegisterRoutes(rg)

	log.Printf("inspection-svc listening on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil { log.Fatalf("server: %v", err) }
}
