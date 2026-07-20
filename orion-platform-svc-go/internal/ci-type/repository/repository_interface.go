package repository

import (
	"context"
	"orion/platform-svc-go/internal/ci-type/models"
)


// RepositoryInterface defines the data access contract for the ci-type module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateType(ctx context.Context, t *models.CIType) error
	GetByID(ctx context.Context, id string, tenantID string) (*models.CIType, error)
	List(ctx context.Context, tenantID string, filter *ListFilter) ([]models.CIType, error)
	UpdateType(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.CIType, error)
	DeleteType(ctx context.Context, id string, tenantID string) (bool, error)
	ListAttributes(ctx context.Context, ciTypeID string, tenantID string) ([]models.CIAttribute, error)
	UpsertAttributes(ctx context.Context, ciTypeID string, tenantID string, attrs []models.CIAttribute) ([]models.CIAttribute, error)
	CreateVersion(ctx context.Context, v *models.CITypeVersion) error
	ListVersions(ctx context.Context, ciTypeID string, tenantID string) ([]models.CITypeVersion, error)
	GetVersion(ctx context.Context, versionID string, ciTypeID string, tenantID string) (*models.CITypeVersion, error)
	GetNextVersion(ctx context.Context, ciTypeID string) (string, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
