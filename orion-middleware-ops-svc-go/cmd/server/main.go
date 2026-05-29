package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"orion/middleware-ops-svc-go/internal/config"
	"orion/middleware-ops-svc-go/internal/handler"
	"orion/middleware-ops-svc-go/internal/repository"
	"orion/middleware-ops-svc-go/internal/service"

	"github.com/gin-gonic/gin"
	"orion-go-common/database"
)

func main() {
	cfg := config.Load()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	dbCfg := database.DefaultConfig(cfg.DSN)
	db, err := database.Connect(ctx, dbCfg)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := database.RunMigrations(db, "migrations"); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	}

	instanceRepo := repository.NewInstanceRepository(db)
	backupRepo := repository.NewBackupRepository(db)

	svc := service.NewService(instanceRepo, backupRepo)
	h := handler.NewHandler(svc)

	r := gin.Default()
	api := r.Group("/api/v1")
	h.RegisterRoutes(api)

	r.GET("/healthz", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: r}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	srv.Shutdown(shutdownCtx)
}
