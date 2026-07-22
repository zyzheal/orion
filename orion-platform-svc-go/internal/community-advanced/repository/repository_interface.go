package repository

import (
	"context"
	"orion/platform-svc-go/internal/community-advanced/models"
)


// RepositoryInterface defines the data access contract for the community-advanced module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, entity *models.CommunityAdvanced) error
	GetByID(ctx context.Context, id, tenantID string) (*models.CommunityAdvanced, error)
	List(ctx context.Context, tenantID string) ([]models.CommunityAdvanced, error)
	Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.CommunityAdvanced, error)
	Delete(ctx context.Context, id, tenantID string) (bool, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
