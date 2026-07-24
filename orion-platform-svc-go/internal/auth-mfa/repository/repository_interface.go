package repository

import (
	"context"
	"orion/platform-svc-go/internal/auth-mfa/models"
)


// RepositoryInterface defines the data access contract for the auth-mfa module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, device *models.MFADevice) error
	GetByID(ctx context.Context, tenantID, id string) (*models.MFADevice, error)
	ListByUser(ctx context.Context, tenantID, userID string) ([]models.MFADevice, error)
	GetActiveDevice(ctx context.Context, tenantID, userID string) (*models.MFADevice, error)
	UpdateStatus(ctx context.Context, tenantID, id, status string) error
	Delete(ctx context.Context, tenantID, id string) (bool, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
