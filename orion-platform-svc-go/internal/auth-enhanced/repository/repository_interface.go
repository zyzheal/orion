package repository

import (
	"context"
	"orion/platform-svc-go/internal/auth-enhanced/models"
)


// RepositoryInterface defines the data access contract for the auth-enhanced module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateKey(ctx context.Context, key *models.AuthKey) error
	GetKeyByID(ctx context.Context, tenantID, id string) (*models.AuthKey, error)
	ListKeys(ctx context.Context, tenantID string, status *string) ([]models.AuthKey, error)
	UpdateKeyStatus(ctx context.Context, tenantID, id, status string) error
	DeleteKey(ctx context.Context, tenantID, id string) (bool, error)
	CreateBlacklist(ctx context.Context, bl *models.AuthTokenBlacklist) error
	IsBlacklisted(ctx context.Context, tenantID, tokenID string) (bool, error)
	ListBlacklist(ctx context.Context, tenantID string) ([]models.AuthTokenBlacklist, error)
	DeleteBlacklist(ctx context.Context, tenantID, id string) (bool, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
