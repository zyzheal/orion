package service

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"orion/platform-svc-go/internal/cache-monitor/models"
	"orion/platform-svc-go/internal/cache-monitor/repository"
)

// CollectionTimeout is the max duration for a single Redis INFO query.
const CollectionTimeout = 5 * time.Second

type CacheMonitorService struct {
	mu      sync.RWMutex
	caches  map[string]*models.CacheMetrics
	config  map[string]*models.CacheConfig
	clients map[string]*redis.Client
	repo    *repository.Repository
	logger  *zap.Logger
}

func NewCacheMonitorService(logger *zap.Logger, repo *repository.Repository) *CacheMonitorService {
	s := &CacheMonitorService{
		caches:  make(map[string]*models.CacheMetrics),
		config:  make(map[string]*models.CacheConfig),
		clients: make(map[string]*redis.Client),
		repo:    repo,
		logger:  logger,
	}
	s.config["redis"] = &models.CacheConfig{
		Name: "redis", Type: "redis", Host: "localhost", Port: 6379,
		CollectionInterval: 30, IsEnabled: true,
	}
	s.caches["redis"] = &models.CacheMetrics{
		Name: "redis", Type: "redis", Status: "unknown",
	}
	s.registerClient("redis")
	// Seed default config into DB
	if repo != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_ = repo.SaveConfig(ctx, s.config["redis"])
		}()
	}
	return s
}

// registerClient creates a go-redis client for the named cache config.
func (s *CacheMonitorService) registerClient(name string) {
	cfg, ok := s.config[name]
	if !ok || cfg.Type != "redis" {
		return
	}
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	if cfg.Port == 0 {
		addr = cfg.Host
	}
	s.clients[name] = redis.NewClient(&redis.Options{
		Addr:         addr,
		Password:     cfg.Password,
		DialTimeout:  3 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})
}

// RegisterCache registers a new cache for monitoring.
func (s *CacheMonitorService) RegisterCache(cfg *models.CacheConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.config[cfg.Name]; ok {
		s.logger.Warn("cache already registered", zap.String("name", cfg.Name))
		return
	}

	s.config[cfg.Name] = cfg
	s.caches[cfg.Name] = &models.CacheMetrics{
		Name: cfg.Name, Type: cfg.Type, Status: "unknown",
	}
	s.registerClient(cfg.Name)

	if s.repo != nil {
		ctx := context.Background()
		_ = s.repo.SaveConfig(ctx, cfg)
	}

	s.logger.Info("cache registered for monitoring",
		zap.String("name", cfg.Name),
		zap.String("type", cfg.Type),
	)
}

// CollectMetrics collects metrics for all registered caches.
// For Redis caches, it queries the real INFO command and parses the output.
// If Redis is unreachable, the cache status is set to "unhealthy" without error.
func (s *CacheMonitorService) CollectMetrics(ctx context.Context) map[string]*models.CacheMetrics {
	now := time.Now()

	s.mu.RLock()
	names := make([]string, 0, len(s.config))
	for name := range s.config {
		names = append(names, name)
	}
	s.mu.RUnlock()

	for _, name := range names {
		s.mu.Lock()
		metrics, ok := s.caches[name]
		cfg, cfgOK := s.config[name]
		s.mu.Unlock()

		if !ok || !cfgOK {
			continue
		}
		if !cfg.IsEnabled {
			continue
		}

		metrics.LastCollectedAt = now

		if cfg.Type == "redis" {
			s.collectRedisMetrics(ctx, name, metrics)
		} else {
			// Non-Redis cache types have no real collection; mark as unknown
			metrics.Status = "unknown"
		}

		if s.repo != nil {
			_ = s.repo.SaveMetrics(ctx, metrics)
		}
	}

	s.logger.Debug("cache metrics collected",
		zap.Int("cacheCount", len(names)),
	)

	s.mu.RLock()
	result := make(map[string]*models.CacheMetrics, len(s.caches))
	for k, v := range s.caches {
		result[k] = v
	}
	s.mu.RUnlock()
	return result
}

// collectRedisMetrics connects to the named Redis instance and populates
// metrics from the INFO command output.
func (s *CacheMonitorService) collectRedisMetrics(ctx context.Context, name string, metrics *models.CacheMetrics) {
	s.mu.RLock()
	client, ok := s.clients[name]
	s.mu.RUnlock()

	if !ok || client == nil {
		metrics.Status = "unhealthy"
		return
	}

	queryCtx, cancel := context.WithTimeout(ctx, CollectionTimeout)
	defer cancel()

	info, err := client.Info(queryCtx).Result()
	if err != nil {
		s.logger.Warn("redis INFO failed",
			zap.String("cache", name),
			zap.Error(err),
		)
		metrics.Status = "unhealthy"
		return
	}

	infoMap := parseRedisInfo(info)

	// Connections
	metrics.ConnectionsActive = parseInt64(infoMap, "connected_clients")
	metrics.ConnectionsTotal = parseInt64(infoMap, "total_connections_received")

	// Memory
	metrics.MemoryUsed = uint64(parseInt64(infoMap, "used_memory"))
	metrics.MemoryTotal = uint64(parseInt64(infoMap, "maxmemory"))
	if metrics.MemoryTotal == 0 {
		// maxmemory not set; use used_memory_rss as a reasonable upper bound
		metrics.MemoryTotal = uint64(parseInt64(infoMap, "used_memory_rss"))
	}

	// Hit/Miss/Eviction
	metrics.HitCount = parseInt64(infoMap, "keyspace_hits")
	metrics.MissCount = parseInt64(infoMap, "keyspace_misses")
	metrics.EvictionCount = parseInt64(infoMap, "evicted_keys")
	metrics.ExpirationCount = parseInt64(infoMap, "expired_keys")

	// KeyCount: sum across all db* entries from keyspace sections
	metrics.KeyCount = parseInt64(infoMap, "keyspace_entries")
	if metrics.KeyCount == 0 {
		// Fallback: use DBSIZE command for exact key count
		if dbSize, dbErr := client.DBSize(queryCtx).Result(); dbErr == nil {
			metrics.KeyCount = dbSize
		}
	}

	// Latency: compute average from commandstats usec_per_call entries
	// commandstats lines are like: cmdstat_get:calls=1000,usec=50000,usec_per_call=50.00
	// Our parser extracts integer values; for float usec_per_call we need a separate parse
	if avgLatency, latErr := computeAvgLatency(queryCtx, client); latErr == nil {
		metrics.AvgLatencyMs = avgLatency
	}

	metrics.Status = "healthy"
}

// parseRedisInfo parses the output of Redis INFO into a flat key-value map.
// Lines starting with '#' are section headers (ignored). Multi-line values
// (like db0:keys=50000,expires=0) are handled by splitting on commas.
func parseRedisInfo(info string) map[string]int64 {
	result := make(map[string]int64)
	lines := strings.Split(info, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		key, val := parts[0], parts[1]

		// Handle comma-separated key=value pairs (e.g. db0:keys=50000,expires=0).
		// Values are accumulated across entries (e.g. db0 and db1 both have "keys").
		if strings.Contains(val, "=") {
			for _, kv := range strings.Split(val, ",") {
				kvParts := strings.SplitN(kv, "=", 2)
				if len(kvParts) == 2 {
					if n, err := strconv.ParseInt(kvParts[1], 10, 64); err == nil {
						result[kvParts[0]] += n
					}
				}
			}
			continue
		}

		if n, err := strconv.ParseInt(val, 10, 64); err == nil {
			result[key] = n
		}
	}
	return result
}

// parseInt64 returns the value for key, or 0 if absent.
func parseInt64(m map[string]int64, key string) int64 {
	return m[key]
}

// computeAvgLatency computes the average command latency in milliseconds
// by parsing the commandstats section of Redis INFO output.
// Returns 0 if no commandstats are available.
func computeAvgLatency(ctx context.Context, client *redis.Client) (float64, error) {
	info, err := client.Info(ctx).Result()
	if err != nil {
		return 0, err
	}

	var totalUsec, totalCalls int64
	for _, line := range strings.Split(info, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "cmdstat_") || !strings.Contains(line, ":") {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		for _, kv := range strings.Split(parts[1], ",") {
			kvParts := strings.SplitN(kv, "=", 2)
			if len(kvParts) != 2 {
				continue
			}
			switch kvParts[0] {
			case "calls":
				if n, err := strconv.ParseInt(kvParts[1], 10, 64); err == nil {
					totalCalls += n
				}
			case "usec":
				if n, err := strconv.ParseInt(kvParts[1], 10, 64); err == nil {
					totalUsec += n
				}
			}
		}
	}

	if totalCalls == 0 {
		return 0, nil
	}
	return float64(totalUsec) / float64(totalCalls) / 1000.0, nil
}

func (s *CacheMonitorService) GetMetrics(name string) (*models.CacheMetrics, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	metrics, ok := s.caches[name]
	return metrics, ok
}

func (s *CacheMonitorService) GetHealth() []models.CacheHealthCheckResult {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var results []models.CacheHealthCheckResult

	for name := range s.config {
		metrics := s.caches[name]
		healthy := metrics.Status == "healthy"
		msg := "healthy"
		if !healthy {
			msg = "unhealthy"
		}
		results = append(results, models.CacheHealthCheckResult{
			Name: name, Healthy: healthy, Message: msg, LatencyMs: 1,
		})
	}

	return results
}

func (s *CacheMonitorService) EnableCache(name string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if cfg, ok := s.config[name]; ok {
		cfg.IsEnabled = true
		if s.repo != nil {
			_ = s.repo.SaveConfig(context.Background(), cfg)
		}
		s.logger.Info("cache enabled", zap.String("name", name))
	}
}

func (s *CacheMonitorService) DisableCache(name string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if cfg, ok := s.config[name]; ok {
		cfg.IsEnabled = false
		if s.repo != nil {
			_ = s.repo.SaveConfig(context.Background(), cfg)
		}
		s.logger.Info("cache disabled", zap.String("name", name))
	}
}

func (s *CacheMonitorService) UnregisterCache(name string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if client, ok := s.clients[name]; ok && client != nil {
		_ = client.Close()
	}
	delete(s.config, name)
	delete(s.caches, name)
	delete(s.clients, name)
	if s.repo != nil {
		_ = s.repo.DeleteConfig(context.Background(), name)
	}
	s.logger.Info("cache unregistered", zap.String("name", name))
}
