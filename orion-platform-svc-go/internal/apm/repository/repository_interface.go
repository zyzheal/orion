package repository

import (
	"context"
	"orion/platform-svc-go/internal/apm/models"
)


// RepositoryInterface defines the data access contract for the apm module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, entity *models.ApmEntry) error
	GetByID(ctx context.Context, id, tenantID string) (*models.ApmEntry, error)
	List(ctx context.Context, tenantID string) ([]models.ApmEntry, error)
	Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ApmEntry, error)
	Delete(ctx context.Context, id, tenantID string) (bool, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
