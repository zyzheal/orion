package repository

import (
	"context"
	"orion/platform-svc-go/internal/channel/models"
)


// RepositoryInterface defines the data access contract for the channel module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, channel *models.NotificationChannel) error
	GetByID(ctx context.Context, tenantID, id string) (*models.NotificationChannel, error)
	List(ctx context.Context, tenantID string, filter *models.ChannelFilter) ([]models.NotificationChannel, int, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.NotificationChannel, error)
	Delete(ctx context.Context, tenantID, id string) (bool, error)
	ListEnabledByType(ctx context.Context, tenantID, channelType string) ([]models.NotificationChannel, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
