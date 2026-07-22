package repository

import (
	"context"
	"orion/platform-svc-go/internal/community/models"
)


// RepositoryInterface defines the data access contract for the community module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, entity *models.Community) error
	GetByID(ctx context.Context, id, tenantID string) (*models.Community, error)
	List(ctx context.Context, tenantID string) ([]models.Community, error)
	Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.Community, error)
	Delete(ctx context.Context, id, tenantID string) (bool, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
