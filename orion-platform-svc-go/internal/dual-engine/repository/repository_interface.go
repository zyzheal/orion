package repository

import (
	"context"
	"orion/platform-svc-go/internal/dual-engine/models"
)


// RepositoryInterface defines the data access contract for the dual-engine module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, item *models.DualEngine) error
	GetByID(ctx context.Context, tenantID, id string) (*models.DualEngine, error)
	List(ctx context.Context, tenantID string) ([]models.DualEngine, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.DualEngine, error)
	Delete(ctx context.Context, tenantID, id string) (bool, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
