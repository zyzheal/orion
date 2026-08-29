package cache_monitor_test

import (
	"context"
	"testing"

	"go.uber.org/zap"
	"orion/platform-svc-go/internal/cache-monitor/models"
	cacheService "orion/platform-svc-go/internal/cache-monitor/service"
)

func TestCacheMonitor_NewService_NilRepo(t *testing.T) {
	logger := zap.NewNop()
	svc := cacheService.NewCacheMonitorService(logger, nil)

	if svc == nil {
		t.Fatal("expected non-nil service")
	}

	// Default redis config must be seeded
	metrics, ok := svc.GetMetrics("redis")
	if !ok {
		t.Fatal("expected redis metrics to exist after construction")
	}
	if metrics.Name != "redis" {
		t.Errorf("expected metrics.Name = redis, got %s", metrics.Name)
	}
	if metrics.Type != "redis" {
		t.Errorf("expected metrics.Type = redis, got %s", metrics.Type)
	}
	if metrics.Status != "healthy" {
		t.Errorf("expected metrics.Status = healthy, got %s", metrics.Status)
	}
}

func TestCacheMonitor_CollectMetricsPopulatesRedis(t *testing.T) {
	logger := zap.NewNop()
	svc := cacheService.NewCacheMonitorService(logger, nil)

	ctx := context.Background()
	result := svc.CollectMetrics(ctx)

	redisMetrics, ok := result["redis"]
	if !ok {
		t.Fatal("expected redis entry in collected metrics")
	}

	if redisMetrics.ConnectionsActive == 0 {
		t.Error("expected ConnectionsActive > 0 after CollectMetrics")
	}
	if redisMetrics.KeyCount == 0 {
		t.Error("expected KeyCount > 0 after CollectMetrics")
	}
	if redisMetrics.LastCollectedAt.IsZero() {
		t.Error("expected LastCollectedAt to be set after CollectMetrics")
	}
	if redisMetrics.Status != "healthy" {
		t.Errorf("expected Status = healthy, got %s", redisMetrics.Status)
	}
}

func TestCacheMonitor_RegisterGetHealthUnregister(t *testing.T) {
	logger := zap.NewNop()
	svc := cacheService.NewCacheMonitorService(logger, nil)

	// Register a new cache (memcached)
	memcachedCfg := &models.CacheConfig{
		Name:               "memcached",
		Type:               "memcached",
		Host:               "localhost",
		Port:               11211,
		CollectionInterval: 60,
		IsEnabled:          true,
	}
	svc.RegisterCache(memcachedCfg)

	// Verify registered cache exists
	metrics, ok := svc.GetMetrics("memcached")
	if !ok {
		t.Fatal("expected memcached metrics after RegisterCache")
	}
	if metrics.Type != "memcached" {
		t.Errorf("expected metrics.Type = memcached, got %s", metrics.Type)
	}

	// Health check should report both caches
	results := svc.GetHealth()
	if len(results) != 2 {
		t.Errorf("expected 2 health results (redis + memcached), got %d", len(results))
	}

	// Unregister memcached
	svc.UnregisterCache("memcached")
	_, ok = svc.GetMetrics("memcached")
	if ok {
		t.Error("expected memcached to be absent after UnregisterCache")
	}

	// Redis should still be present
	_, ok = svc.GetMetrics("redis")
	if !ok {
		t.Error("expected redis to still exist after unregistering memcached")
	}

	// Enable/Disable toggle
	svc.DisableCache("redis")
	// Re-collect to confirm nothing panics
	_ = svc.CollectMetrics(context.Background())
	svc.EnableCache("redis")
	_ = svc.CollectMetrics(context.Background())
}
