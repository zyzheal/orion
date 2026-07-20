package repository

import (
	"context"
	"orion/platform-svc-go/internal/abac-policy/models"
)


// RepositoryInterface defines the data access contract for the abac-policy module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, policy *models.ABACPolicy) error
	GetByID(ctx context.Context, tenantID, id string) (*models.ABACPolicy, error)
	List(ctx context.Context, tenantID string, filter *models.ABACPolicyFilter) ([]models.ABACPolicy, int, error)
	Update(ctx context.Context, tenantID, id string, name, status *string, conditions map[string]string) (*models.ABACPolicy, error)
	Delete(ctx context.Context, tenantID, id string) (bool, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
