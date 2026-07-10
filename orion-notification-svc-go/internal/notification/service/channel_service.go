package service

import (
	"context"

	"orion/notification-svc-go/internal/notification/models"
	"orion/notification-svc-go/internal/notification/repository"
	"orion/go-common/pkg/otel"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ChannelService implements the notification channel business logic.
type ChannelService struct {
	repo   *repository.Repository
	logger *zap.Logger
}

// NewChannelService creates a new ChannelService.
func NewChannelService(repo *repository.Repository, logger *zap.Logger) *ChannelService {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &ChannelService{repo: repo, logger: logger}
}

// CreateChannel creates a new notification channel configuration.
func (s *ChannelService) CreateChannel(ctx context.Context, tenantID string, c *models.NotificationChannel) error {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "ChannelService.Create")
	defer span.End()

	c.ID = uuid.New().String()
	c.TenantID = tenantID
	return s.repo.CreateChannel(ctx, c)
}

// ListChannels returns all channel configs for a tenant.
func (s *ChannelService) ListChannels(ctx context.Context, tenantID string) ([]models.NotificationChannel, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "ChannelService.List")
	defer span.End()

	return s.repo.ListChannels(ctx, tenantID)
}

// GetChannel returns a single channel config by id.
func (s *ChannelService) GetChannel(ctx context.Context, tenantID, id string) (*models.NotificationChannel, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "ChannelService.Get")
	defer span.End()

	return s.repo.GetChannel(ctx, tenantID, id)
}

// UpdateChannel updates an existing channel configuration.
func (s *ChannelService) UpdateChannel(ctx context.Context, tenantID string, c *models.NotificationChannel) error {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "ChannelService.Update")
	defer span.End()

	c.TenantID = tenantID
	return s.repo.UpdateChannel(ctx, c)
}

// DeleteChannel removes a channel configuration.
func (s *ChannelService) DeleteChannel(ctx context.Context, tenantID, id string) error {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "ChannelService.Delete")
	defer span.End()

	return s.repo.DeleteChannel(ctx, tenantID, id)
}
