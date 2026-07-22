package repository

import (
	"context"
	"orion/platform-svc-go/internal/degradation/models"
)


// RepositoryInterface defines the data access contract for the degradation module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, item *models.Degradation) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Degradation, error)
	List(ctx context.Context, tenantID string) ([]models.Degradation, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Degradation, error)
	Delete(ctx context.Context, tenantID, id string) (bool, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
