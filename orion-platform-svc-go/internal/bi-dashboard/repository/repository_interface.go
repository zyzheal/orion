package repository

import (
	"context"
	"orion/platform-svc-go/internal/bi-dashboard/models"
)


// RepositoryInterface defines the data access contract for the bi-dashboard module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, entity *models.BiDashboard) error
	GetByID(ctx context.Context, id, tenantID string) (*models.BiDashboard, error)
	List(ctx context.Context, tenantID string) ([]models.BiDashboard, error)
	Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.BiDashboard, error)
	Delete(ctx context.Context, id, tenantID string) (bool, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
