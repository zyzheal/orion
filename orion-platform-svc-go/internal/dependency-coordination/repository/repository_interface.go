package repository

import (
	"context"
	"orion/platform-svc-go/internal/dependency-coordination/models"
)


// RepositoryInterface defines the data access contract for the dependency-coordination module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, item *models.DependencyCoordination) error
	GetByID(ctx context.Context, tenantID, id string) (*models.DependencyCoordination, error)
	List(ctx context.Context, tenantID string) ([]models.DependencyCoordination, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.DependencyCoordination, error)
	Delete(ctx context.Context, tenantID, id string) (bool, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
