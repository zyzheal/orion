package repository

import (
	"context"
	"orion/platform-svc-go/internal/alert-breaker/models"
)


// RepositoryInterface defines the data access contract for the alert-breaker module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, a *models.AlertBreaker) error
	GetByID(ctx context.Context, tenantID, id string) (*models.AlertBreaker, error)
	List(ctx context.Context, tenantID string) ([]models.AlertBreaker, int, error)
	Update(ctx context.Context, tenantID, id string, fields map[string]interface{}) (*models.AlertBreaker, error)
	Delete(ctx context.Context, tenantID, id string) (bool, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
