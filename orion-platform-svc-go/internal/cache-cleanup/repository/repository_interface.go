package repository

import (
	"context"
	"orion/platform-svc-go/internal/cache-cleanup/models"
)


// RepositoryInterface defines the data access contract for the cache-cleanup module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, entity *models.CacheCleanup) error
	GetByID(ctx context.Context, id, tenantID string) (*models.CacheCleanup, error)
	List(ctx context.Context, tenantID string) ([]models.CacheCleanup, error)
	Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.CacheCleanup, error)
	Delete(ctx context.Context, id, tenantID string) (bool, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
