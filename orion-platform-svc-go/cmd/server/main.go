package main

import (
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"context"

	orionlog "orion/go-common/pkg/logger"
	"orion/platform-svc-go/internal/middleware"
	"go.uber.org/zap"
)

func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-platform-svc"))
	defer logger.Sync()

	middleware.RegisterPrometheusMetrics()

	infra := initInfrastructure(logger)
	initWiring(infra, logger)
	r := setupRouter(infra, logger)

	addr := fmt.Sprintf(":%d", infra.ffCfg.Port)
	logger.Info("platform-svc listening", zap.String("addr", addr))

	srv := &http.Server{Addr: addr, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server error", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down platform-svc...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}
}