package main

import (
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	cm_handler "orion/platform-svc-go/internal/cache-monitor/handler"
	cm_repo "orion/platform-svc-go/internal/cache-monitor/repository"
	cm_service "orion/platform-svc-go/internal/cache-monitor/service"
)

var cacheMonitorH *cm_handler.CacheMonitorHandler

func wireCacheMonitor(db *database.DB, logger *zap.Logger) {
	repo := cm_repo.NewRepository(db.DB)
	svc := cm_service.NewCacheMonitorService(logger, repo)
	cacheMonitorH = cm_handler.NewCacheMonitorHandler(svc)
}
