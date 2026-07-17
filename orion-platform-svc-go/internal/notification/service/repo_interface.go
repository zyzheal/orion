package service

import (
	"context"
	"orion/platform-svc-go/internal/notification/models"
)

// NotificationRepo defines the repository interface for testing.
type NotificationRepo interface {
	Create(ctx context.Context, n *models.Notification) error
	GetByID(ctx context.Context, id string, tenantID string) (*models.Notification, error)
	List(ctx context.Context, tenantID string, filter *models.ListFilter, limit int, offset int) ([]models.Notification, error)
	Count(ctx context.Context, tenantID string) (int, error)
	ListByUser(ctx context.Context, tenantID string, userID string) ([]models.Notification, error)
	Update(ctx context.Context, n *models.Notification) error
	Delete(ctx context.Context, id string, tenantID string) (bool, error)
	MarkRead(ctx context.Context, id string, tenantID string) error
	MarkAllRead(ctx context.Context, tenantID string, userID string) error
	GetStats(ctx context.Context, tenantID string) (*models.NotificationStats, error)
	UpdateFields(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.Notification, error)
}
