package main

import (
	"context"
	"log"
	"orion/inspection-svc-go/internal/config"
	"orion/inspection-svc-go/internal/handler"
	"orion/inspection-svc-go/internal/repository"
	"orion/inspection-svc-go/internal/service"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	orionredis "orion/go-common/pkg/redis"
	"github.com/gin-gonic/gin"
)

func main() {
	ctx := context.Background()
	logger := orionlog.Must(orionlog.DefaultConfig("orion-inspection-svc"))
	defer logger.Sync()

	cfg := config.Load()

	dbCfg := database.DefaultConfig(cfg.DSN)
	db, err := database.Connect(ctx, dbCfg)
	if err != nil { log.Fatalf("db connect: %v", err) }
	defer db.Close()

	if err := database.RunMigrations(db, "migrations"); err != nil { log.Fatalf("migrations: %v", err) }

	rdb := orionredis.NewClient(orionredis.Config{Addr: cfg.RedisAddr})
	defer rdb.Close()


	ruleRepo := repository.NewRuleRepository(db.DB)
	resultRepo := repository.NewResultRepository(db.DB)
	svc := service.NewService(ruleRepo, resultRepo)
	h := handler.NewHandler(svc)

	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))
	rg := r.Group("/api/v1")
	rg.Use(auth.Auth(auth.AuthConfig{JWTSecret: cfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz"}}))
	h.RegisterRoutes(rg)

	log.Printf("inspection-svc listening on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil { log.Fatalf("server: %v", err) }
}
