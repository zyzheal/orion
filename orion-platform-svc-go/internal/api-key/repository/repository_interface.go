package repository

import (
	"context"
	"orion/platform-svc-go/internal/api-key/models"
)


// RepositoryInterface defines the data access contract for the api-key module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, key *models.APIKey) error
	GetByID(ctx context.Context, tenantID, id string) (*models.APIKey, error)
	GetByHash(ctx context.Context, tenantID, keyHash string) (*models.APIKey, error)
	List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.APIKey, error)
	Count(ctx context.Context, tenantID string) (int, error)
	CountByUser(ctx context.Context, tenantID, userID string) (int, error)
	UpdateLastUsed(ctx context.Context, id string, tenantID string, usedAt interface{}) error
	Delete(ctx context.Context, tenantID, id string) error
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
