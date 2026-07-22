package repository

import (
	"context"
	"orion/platform-svc-go/internal/auth/models"
)


// RepositoryInterface defines the data access contract for the auth module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, rt *models.RefreshToken) error
	FindByHash(ctx context.Context, tokenHash string) (*RefreshTokenRow, error)
	DeleteByHash(ctx context.Context, tokenHash string) error
	DeleteByUserID(ctx context.Context, userID string) error
	CleanupExpired(ctx context.Context) (int64, error)
	FindTenantsByUserID(ctx context.Context, userID string) ([]string, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
