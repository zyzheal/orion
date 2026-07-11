package build_cache

import (
	"context"

	"orion-build-env-svc-go/internal/models"
	"orion-build-env-svc-go/internal/build_cache/repository"
)

type Service struct {
	configRepo *repository.BuildCacheConfigRepository
	entryRepo  *repository.BuildCacheEntryRepository
}

func NewService(configRepo *repository.BuildCacheConfigRepository, entryRepo *repository.BuildCacheEntryRepository) *Service {
	return &Service{configRepo: configRepo, entryRepo: entryRepo}
}

// ListConfigs lists all cache configs
func (s *Service) ListConfigs(ctx context.Context, tenantID string, limit, offset int) ([]models.BuildCacheConfig, error) {
	return s.configRepo.ListConfigs(ctx, tenantID, limit, offset)
}

// GetConfig gets a cache config by ID
func (s *Service) GetConfig(ctx context.Context, tenantID, id string) (*models.BuildCacheConfig, error) {
	return s.configRepo.GetConfig(ctx, tenantID, id)
}

// CreateConfig creates a new cache config
func (s *Service) CreateConfig(ctx context.Context, tenantID string, req models.CreateBuildCacheRequest) (*models.BuildCacheConfig, error) {
	cfg := &models.BuildCacheConfig{
		Name:       req.Name,
		Level:      req.Level,
		Status:     "active",
		ConfigData: req.ConfigData,
	}
	if err := s.configRepo.CreateConfig(ctx, tenantID, cfg); err != nil {
		return nil, err
	}
	return s.configRepo.GetConfig(ctx, tenantID, cfg.ID)
}

// UpdateConfig updates a cache config
func (s *Service) UpdateConfig(ctx context.Context, tenantID, id string, req models.UpdateBuildCacheRequest) (*models.BuildCacheConfig, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Level != nil {
		updates["level"] = *req.Level
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.ConfigData != nil {
		updates["config_data"] = req.ConfigData
	}
	if len(updates) == 0 {
		return nil, nil
	}
	if err := s.configRepo.UpdateConfig(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.configRepo.GetConfig(ctx, tenantID, id)
}

// DeleteConfig deletes a cache config
func (s *Service) DeleteConfig(ctx context.Context, tenantID, id string) error {
	return s.configRepo.DeleteConfig(ctx, tenantID, id)
}
