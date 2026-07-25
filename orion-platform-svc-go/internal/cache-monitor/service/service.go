package service

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/cache-monitor/models"
	"go.uber.org/zap"
)

type CacheMonitorService struct {
	caches  map[string]*models.CacheMetrics
	config  map[string]*models.CacheConfig
	logger  *zap.Logger
}

func NewCacheMonitorService(logger *zap.Logger) *CacheMonitorService {
	s := &CacheMonitorService{
		caches: make(map[string]*models.CacheMetrics),
		config: make(map[string]*models.CacheConfig),
		logger: logger,
	}
	// Initialize with default cache configs
	s.config["redis"] = &models.CacheConfig{
		Name:              "redis",
		Type:              "redis",
		Host:              "localhost",
		Port:              6379,
		CollectionInterval: 30,
		IsEnabled:         true,
	}
	s.caches["redis"] = &models.CacheMetrics{
		Name:    "redis",
		Type:    "redis",
		Status:  "healthy",
		HitCount: 0,
		MissCount: 0,
	}
	return s
}

// RegisterCache registers a new cache for monitoring.
func (s *CacheMonitorService) RegisterCache(cfg *models.CacheConfig) {
	if _, ok := s.config[cfg.Name]; ok {
		s.logger.Warn("cache already registered", zap.String("name", cfg.Name))
		return
	}

	s.config[cfg.Name] = cfg
	s.caches[cfg.Name] = &models.CacheMetrics{
		Name:   cfg.Name,
		Type:   cfg.Type,
		Status: "unknown",
	}

	s.logger.Info("cache registered for monitoring",
		zap.String("name", cfg.Name),
		zap.String("type", cfg.Type),
	)
}

// CollectMetrics collects metrics for all registered caches.
func (s *CacheMonitorService) CollectMetrics(ctx context.Context) map[string]*models.CacheMetrics {
	now := time.Now()

	for name := range s.config {
		s.caches[name].LastCollectedAt = now
		s.caches[name].Status = "healthy"

		// In a real implementation, connect to the cache and collect actual metrics
		// For now, return simulated metrics
		if name == "redis" {
			s.caches["redis"].ConnectionsActive = 5
			s.caches["redis"].ConnectionsTotal = 10
			s.caches["redis"].MemoryUsed = 1024 * 1024 * 64 // 64MB
			s.caches["redis"].MemoryTotal = 1024 * 1024 * 512 // 512MB
			s.caches["redis"].HitCount += 100
			s.caches["redis"].MissCount += 10
			s.caches["redis"].KeyCount = 50000
			s.caches["redis"].AvgLatencyMs = 0.5
			s.caches["redis"].P95LatencyMs = 1.2
		}
	}

	s.logger.Debug("cache metrics collected",
		zap.Int("cacheCount", len(s.config)),
	)
	return s.caches
}

// GetMetrics returns metrics for a specific cache.
func (s *CacheMonitorService) GetMetrics(name string) (*models.CacheMetrics, bool) {
	metrics, ok := s.caches[name]
	return metrics, ok
}

// GetHealth returns health status for all caches.
func (s *CacheMonitorService) GetHealth() []models.CacheHealthCheckResult {
	var results []models.CacheHealthCheckResult

	for name := range s.config {
		metrics := s.caches[name]
		healthy := metrics.Status == "healthy"
		message := "healthy"
		if !healthy {
			message = "unhealthy"
		}

		result := models.CacheHealthCheckResult{
			Name:      name,
			Healthy:   healthy,
			Message:   message,
			LatencyMs: 1,
		}
		results = append(results, result)
	}

	return results
}

// EnableCache enables a cache for monitoring.
func (s *CacheMonitorService) EnableCache(name string) {
	if cfg, ok := s.config[name]; ok {
		cfg.IsEnabled = true
		s.logger.Info("cache enabled", zap.String("name", name))
	}
}

// DisableCache disables a cache for monitoring.
func (s *CacheMonitorService) DisableCache(name string) {
	if cfg, ok := s.config[name]; ok {
		cfg.IsEnabled = false
		s.logger.Info("cache disabled", zap.String("name", name))
	}
}

// UnregisterCache removes a cache from monitoring.
func (s *CacheMonitorService) UnregisterCache(name string) {
	delete(s.config, name)
	delete(s.caches, name)
	s.logger.Info("cache unregistered", zap.String("name", name))
}
