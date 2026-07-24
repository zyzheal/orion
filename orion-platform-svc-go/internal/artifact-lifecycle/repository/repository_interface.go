package repository

import (
	"context"
	"orion/platform-svc-go/internal/artifact-lifecycle/models"
)


// RepositoryInterface defines the data access contract for the artifact-lifecycle module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, lc *models.ArtifactLifecycle) error
	GetByID(ctx context.Context, tenantID, id string) (*models.ArtifactLifecycle, error)
	GetByArtifactID(ctx context.Context, tenantID, artifactID string) (*models.ArtifactLifecycle, error)
	List(ctx context.Context, tenantID string, limit, offset int) ([]models.ArtifactLifecycle, error)
	Count(ctx context.Context, tenantID string) (int, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	Delete(ctx context.Context, tenantID, id string) error
	GetStageHistory(ctx context.Context, tenantID, id string) ([]models.ArtifactLifecycle, error)
	Archive(ctx context.Context, tenantID, id string) error
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
