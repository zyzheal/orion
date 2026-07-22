package repository

import (
	"context"
	"orion/platform-svc-go/internal/artifact-version/models"
)


// RepositoryInterface defines the data access contract for the artifact-version module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	List(ctx context.Context, tenantID string) ([]models.Record, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Record, error)
	Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error)
	Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error)
	Delete(ctx context.Context, tenantID, id string) error
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
