package service

import (
	"context"
	"database/sql"
	"errors"

	"orion/platform-svc-go/internal/cache-mgmt/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateConfig(ctx context.Context, cfg *models.CacheConfig) error
	GetConfigByID(ctx context.Context, tenantID, id string) (*models.CacheConfig, error)
	GetConfigStatsForUpdate(ctx context.Context, tenantID, id string) (*models.CacheConfig, error)
	ListConfigs(ctx context.Context, tenantID string, limit, offset int) ([]models.CacheConfig, error)
	UpdateConfig(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	DeleteConfig(ctx context.Context, tenantID, id string) error
	IsEnabled(ctx context.Context, id string) (bool, error)
	UpsertStats(ctx context.Context, stats *models.CacheStats) error
	GetStatsByConfig(ctx context.Context, configID string) ([]models.CacheStats, error)
	GetStatsByKey(ctx context.Context, configID, key string) (*models.CacheStats, error)
	DeleteStatsByConfig(ctx context.Context, configID string) error
}

// Service encapsulates business logic for cache management.
type Service struct {
	repo   RepositoryInterface
	manager *MethodCacheManager
}

// NewService creates a new service.
func NewService(repo RepositoryInterface, manager *MethodCacheManager) *Service {
	return &Service{repo: repo, manager: manager}
}

// --- CacheConfig CRUD ---

func (s *Service) CreateConfig(ctx context.Context, tenantID string, req models.CreateCacheConfigRequest) (*models.CacheConfig, error) {
	cfg := &models.CacheConfig{
		TenantID:   tenantID,
		Name:       req.Name,
		TTL:        req.TTL,
		MaxSize:    req.MaxSize,
		Eviction:   req.Eviction,
		Serializer: req.Serializer,
		Backend:    req.Backend,
	}
	if cfg.TTL <= 0 {
		cfg.TTL = 300
	}
	if cfg.MaxSize <= 0 {
		cfg.MaxSize = 100
	}
	if cfg.Eviction == "" {
		cfg.Eviction = "LRU"
	}
	if cfg.Serializer == "" {
		cfg.Serializer = "json"
	}
	if cfg.Backend == "" {
		cfg.Backend = "memory"
	}
	if req.Enabled != nil {
		cfg.Enabled = *req.Enabled
	}
	if err := s.repo.CreateConfig(ctx, cfg); err != nil {
		return nil, err
	}
	// Rebuild the in-memory cache from the persisted config.
	if cfg.Enabled {
		_, _ = s.manager.RebuildCache(ctx, tenantID, cfg.ID)
	}
	return cfg, nil
}

func (s *Service) GetConfig(ctx context.Context, tenantID, id string) (*models.CacheConfig, error) {
	return s.repo.GetConfigByID(ctx, tenantID, id)
}

func (s *Service) ListConfigs(ctx context.Context, tenantID string, limit, offset int) ([]models.CacheConfig, error) {
	return s.repo.ListConfigs(ctx, tenantID, limit, offset)
}

func (s *Service) UpdateConfig(ctx context.Context, tenantID, id string, req models.UpdateCacheConfigRequest) (*models.CacheConfig, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.TTL != nil {
		updates["ttl"] = *req.TTL
	}
	if req.MaxSize != nil {
		updates["max_size"] = *req.MaxSize
	}
	if req.Eviction != nil {
		updates["eviction"] = *req.Eviction
	}
	if req.Serializer != nil {
		updates["serializer"] = *req.Serializer
	}
	if req.Backend != nil {
		updates["backend"] = *req.Backend
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if err := s.repo.UpdateConfig(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	// Rebuild if enabled changed or the config is still enabled.
	cfg, _ := s.repo.GetConfigByID(ctx, tenantID, id)
	if cfg != nil && cfg.Enabled {
		_, _ = s.manager.RebuildCache(ctx, tenantID, id)
	}
	return s.repo.GetConfigByID(ctx, tenantID, id)
}

func (s *Service) DeleteConfig(ctx context.Context, tenantID, id string) error {
	// Invalidate the in-memory cache first.
	_ = s.manager.Invalidate(id)
	_ = s.repo.DeleteStatsByConfig(ctx, id)
	return s.repo.DeleteConfig(ctx, tenantID, id)
}

// --- Cache operations ---

// Flush clears all entries for a config.
func (s *Service) Flush(ctx context.Context, tenantID, configID string) error {
	if err := s.validateConfig(ctx, tenantID, configID); err != nil {
		return err
	}
	return s.manager.Invalidate(configID)
}

// EvictKey removes a single key from a config's cache.
func (s *Service) EvictKey(ctx context.Context, tenantID, configID, key string) error {
	if err := s.validateConfig(ctx, tenantID, configID); err != nil {
		return err
	}
	return s.manager.Delete(configID, key)
}

// GetCachedValue retrieves a value from the cache.
func (s *Service) GetCachedValue(ctx context.Context, tenantID, configID, key string) (*models.CacheValueResponse, error) {
	if err := s.validateConfig(ctx, tenantID, configID); err != nil {
		return nil, err
	}
	if cfg, err := s.repo.GetConfigByID(ctx, tenantID, configID); err == nil && !cfg.Enabled {
		return nil, errors.New("cache config is disabled")
	}
	v, found := s.manager.Get(configID, key)
	return &models.CacheValueResponse{Key: key, Value: v, Hit: found}, nil
}

// SetCachedValue stores a value in the cache.
func (s *Service) SetCachedValue(ctx context.Context, tenantID, configID, key string, value interface{}) error {
	if err := s.validateConfig(ctx, tenantID, configID); err != nil {
		return err
	}
	return s.manager.Set(configID, key, value)
}

// DeleteCachedValue removes a value from the cache.
func (s *Service) DeleteCachedValue(ctx context.Context, tenantID, configID, key string) error {
	if err := s.validateConfig(ctx, tenantID, configID); err != nil {
		return err
	}
	return s.manager.Delete(configID, key)
}

// GetStats returns statistics for a config.
func (s *Service) GetStats(ctx context.Context, tenantID, configID string) (*models.StatsList, error) {
	if err := s.validateConfig(ctx, tenantID, configID); err != nil {
		return nil, err
	}
	rows, err := s.repo.GetStatsByConfig(ctx, configID)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	return &models.StatsList{Stats: rows}, nil
}

// ClearAllCaches clears every cache.
func (s *Service) ClearAllCaches(ctx context.Context) error {
	return s.manager.ClearAll()
}

// --- Helpers ---

func (s *Service) validateConfig(ctx context.Context, tenantID, configID string) error {
	cfg, err := s.repo.GetConfigByID(ctx, tenantID, configID)
	if err != nil {
		return err
	}
	_ = cfg
	return nil
}

// CacheKey builds a cache key for a method call.
func (s *Service) CacheKey(configID string, method string, args ...interface{}) string {
	return s.manager.CacheKey(configID, method, args...)
}

// Stats returns aggregate in-memory stats.
func (s *Service) Stats(configID string) *models.CacheStats {
	return s.manager.Stats(configID)
}

// BuildID generates a unique identifier.
func BuildID() string {
	return uuid.New().String()
}
