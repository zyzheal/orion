package repository

import (
	"context"
	"orion/platform-svc-go/internal/canary-analysis/models"
)


// RepositoryInterface defines the data access contract for the canary-analysis module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, entity *models.Analysis) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Analysis, error)
	List(ctx context.Context, tenantID string) ([]models.Analysis, error)
	Update(ctx context.Context, tenantID, id string, attrs map[string]interface{}) (*models.Analysis, error)
	Delete(ctx context.Context, tenantID, id string) (bool, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
