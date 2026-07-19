package service

import (
	"context"
	"orion/platform-svc-go/internal/webhook/models"
)

// WebhookRepo defines the repository interface for testing.
type WebhookRepo interface {
	Create(ctx context.Context, w *models.Webhook) error
	GetByID(ctx context.Context, id, tenantID string) (*models.Webhook, error)
	List(ctx context.Context, tenantID string, filter *models.ListFilter, limit, offset int) ([]models.Webhook, error)
	Count(ctx context.Context, tenantID string) (int, error)
	Update(ctx context.Context, w *models.Webhook) error
	Delete(ctx context.Context, id, tenantID string) error
	CreateDelivery(ctx context.Context, d *models.WebhookDelivery) error
	ListByWebhook(ctx context.Context, webhookID string, limit, offset int) ([]models.WebhookDelivery, error)
}
