package repository

import (
	"context"
	"orion/platform-svc-go/internal/artifact/models"
)


// RepositoryInterface defines the data access contract for the artifact module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, m *models.Artifact) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Artifact, error)
	ExistsByNamespaceNameVersion(ctx context.Context, tenantID, namespace, name, version string) (bool, error)
	List(ctx context.Context, tenantID string, q models.ListArtifactsQuery) ([]models.Artifact, error)
	Count(ctx context.Context, tenantID string, q models.ListArtifactsQuery) (int, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	SoftDelete(ctx context.Context, tenantID, id string) error
	AddTags(ctx context.Context, artifactID string, tags []string) error
	RemoveTags(ctx context.Context, artifactID string, tags []string) error
	GetTags(ctx context.Context, artifactID string) ([]string, error)
	RecordDownload(ctx context.Context, artifactID string, req models.DownloadArtifactRequest) error
	GetDownloadHistory(ctx context.Context, artifactID string) ([]models.ArtifactDownload, error)
	Search(ctx context.Context, tenantID string, query string, limit, offset int) ([]models.Artifact, error)
	CreatePromotion(ctx context.Context, p *models.ArtifactPromotion) error
	GetCurrentStage(ctx context.Context, tenantID, id string) (string, error)
	GetPromotionHistory(ctx context.Context, tenantID, id string) ([]models.ArtifactPromotion, error)
	GetStats(ctx context.Context, tenantID string) (*models.ArtifactStats, error)
	GetTypeStats(ctx context.Context, tenantID string) ([]models.ArtifactTypeStat, error)
	GetNamespaces(ctx context.Context, tenantID string) ([]models.NamespaceStat, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
