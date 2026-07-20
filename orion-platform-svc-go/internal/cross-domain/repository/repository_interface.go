package repository

import (
	"context"
	"orion/platform-svc-go/internal/cross-domain/models"
)


// RepositoryInterface defines the data access contract for the cross-domain module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, item *models.CrossDomain) error
	GetByID(ctx context.Context, tenantID, id string) (*models.CrossDomain, error)
	List(ctx context.Context, tenantID string) ([]models.CrossDomain, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.CrossDomain, error)
	Delete(ctx context.Context, tenantID, id string) (bool, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
