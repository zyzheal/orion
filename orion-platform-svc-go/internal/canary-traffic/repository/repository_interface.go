package repository

import (
	"context"
	"orion/platform-svc-go/internal/canary-traffic/models"
)


// RepositoryInterface defines the data access contract for the canary-traffic module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	EnsureTable(ctx context.Context) error
	Create(ctx context.Context, tenantID string, cb *models.CanaryTraffic) error
	GetByID(ctx context.Context, id, tenantID string) (*models.CanaryTraffic, error)
	List(ctx context.Context, tenantID string) ([]models.CanaryTraffic, error)
	Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.CanaryTraffic, error)
	Delete(ctx context.Context, id, tenantID string) (bool, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
