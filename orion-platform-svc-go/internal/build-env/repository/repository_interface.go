package repository

import (
	"context"
	"orion/platform-svc-go/internal/build-env/models"
)


// RepositoryInterface defines the data access contract for the build-env module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateBuild(ctx context.Context, m *models.Build) error
	GetBuild(ctx context.Context, tenantID, id string) (*models.Build, error)
	ListBuilds(ctx context.Context, tenantID string, limit, offset int) ([]models.Build, error)
	UpdateBuild(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	DeleteBuild(ctx context.Context, tenantID, id string) error
	CreateBuildImage(ctx context.Context, m *models.BuildImage) error
	GetBuildImage(ctx context.Context, tenantID, id string) (*models.BuildImage, error)
	ListBuildImages(ctx context.Context, tenantID string, limit, offset int) ([]models.BuildImage, error)
	UpdateBuildImage(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	DeleteBuildImage(ctx context.Context, tenantID, id string) error
	CreateCacheConfig(ctx context.Context, tenantID string, name string, level string, status string, cacheDir string, ttlHours int) (*models.BuildCacheConfig, error)
	GetCacheConfig(ctx context.Context, tenantID string, id int) (*models.BuildCacheConfig, error)
	ListCacheConfigs(ctx context.Context, tenantID, level, status string, limit, offset int) ([]models.BuildCacheConfig, error)
	UpdateCacheConfig(ctx context.Context, tenantID string, id int, updates map[string]interface{}) (*models.BuildCacheConfig, error)
	DeleteCacheConfig(ctx context.Context, tenantID string, id int) error
	CreateBuildLog(ctx context.Context, tenantID, buildID, logData string) error
	GetBuildLog(ctx context.Context, tenantID string, id int) (*models.BuildLog, error)
	ListBuildLogs(ctx context.Context, tenantID string, limit, offset int) ([]models.BuildLog, error)
	GetCacheDashboard(ctx context.Context, tenantID string) (*models.CacheDashboard, error)
	GetCacheMetrics(ctx context.Context, tenantID string, cacheID string) (*models.CacheMetrics, error)
	AssessCacheHealth(ctx context.Context, tenantID string, cacheID string) (*models.CacheHealth, error)
	RecordCacheEvent(ctx context.Context, tenantID, cacheID, eventType string, latencySavedMs *float64) error
	AnalyzePerformanceImpact(ctx context.Context, tenantID, pipelineID string) (*models.CachePerformanceImpact, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
