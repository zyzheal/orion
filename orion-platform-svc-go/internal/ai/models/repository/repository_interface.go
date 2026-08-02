package repository

import (
	"context"
	"orion/platform-svc-go/internal/ai/models/models"
)


// RepositoryInterface defines the data access contract for the ai-models module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateModel(ctx context.Context, m *models.AIModel) error
	GetModel(ctx context.Context, tenantID, modelID string) (*models.AIModel, error)
	UpdateModel(ctx context.Context, tenantID, modelID string, displayName *string, description *string, tagsJSON, metadataJSON string) (*models.AIModel, error)
	DeleteModel(ctx context.Context, tenantID, modelID string) error
	ListModels(ctx context.Context, tenantID string, q models.ListModelsQuery) ([]models.AIModel, int, error)
	ModelExists(ctx context.Context, tenantID, name string) (bool, error)
	CreateVersion(ctx context.Context, v *models.ModelVersion) error
	GetVersion(ctx context.Context, tenantID, modelID, versionID string) (*models.ModelVersion, error)
	ListVersions(ctx context.Context, tenantID, modelID string, q models.ListVersionsQuery) ([]models.ModelVersion, int, error)
	UpdateVersion(ctx context.Context, tenantID, versionID string, environment models.Environment, status models.ModelStatus, promotedAt *int64, promotedBy *string) error
	UpdateVersionDeprecated(ctx context.Context, tenantID, versionID string, deprecatedAt *int64) error
	GetVersionsByModel(ctx context.Context, tenantID, modelID string) ([]models.ModelVersion, error)
	GetProductionVersions(ctx context.Context, tenantID, modelID string) ([]models.ModelVersion, error)
	CountVersions(ctx context.Context, tenantID, modelID string) (int, error)
	UpdateModelCurrentVersion(ctx context.Context, tenantID, modelID, version string, status models.ModelStatus) error
	CreateCanary(ctx context.Context, c *models.CanaryConfig) error
	GetCanary(ctx context.Context, tenantID, modelID string) (*models.CanaryConfig, error)
	UpdateCanary(ctx context.Context, tenantID, modelID string, enabled bool, status models.CanaryStatus) error
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
