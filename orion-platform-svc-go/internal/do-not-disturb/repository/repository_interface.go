package repository

import (
	"context"
	"orion/platform-svc-go/internal/do-not-disturb/models"
)


// RepositoryInterface defines the data access contract for the do-not-disturb module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, dnd *models.DoNotDisturb) error
	GetByUser(ctx context.Context, tenantID, userID string) (*models.DoNotDisturb, error)
	Update(ctx context.Context, tenantID, userID string, updates map[string]interface{}) (*models.DoNotDisturb, error)
	IsDNDActive(ctx context.Context, tenantID, userID string) (bool, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
