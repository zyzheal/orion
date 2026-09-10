package service

import (
	"context"
	"fmt"

	"orion/go-common/pkg/otel"
	"orion/platform-svc-go/internal/notification/models"
	"orion/platform-svc-go/internal/notification/notification-repository"

	"github.com/google/uuid"
)

// ErrChannelNotFound is returned when a channel lookup fails.
var ErrChannelNotFound = fmt.Errorf("channel not found")

// ChannelService handles notification channel CRUD.
type ChannelService struct {
	repo *repository.Repository
}

// NewChannelService creates a new ChannelService.
func NewChannelService(repo *repository.Repository, _ interface{}) *ChannelService {
	return &ChannelService{repo: repo}
}

// CreateChannel creates a new notification channel.
func (s *ChannelService) CreateChannel(ctx context.Context, tenantID string, c *models.NotificationChannel) error {
	ctx, span := otel.Tracer("orion-notification-channel-svc").Start(ctx, "ChannelService.CreateChannel")
	defer span.End()

	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	c.TenantID = tenantID

	if err := s.repo.CreateChannel(ctx, c); err != nil {
		return fmt.Errorf("failed to create channel: %w", err)
	}
	return nil
}

// ListChannels returns all channels for a tenant.
func (s *ChannelService) ListChannels(ctx context.Context, tenantID string) ([]models.NotificationChannel, error) {
	ctx, span := otel.Tracer("orion-notification-channel-svc").Start(ctx, "ChannelService.ListChannels")
	defer span.End()

	channels, err := s.repo.ListChannels(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to list channels: %w", err)
	}
	return channels, nil
}

// GetChannel returns a single channel by id.
func (s *ChannelService) GetChannel(ctx context.Context, tenantID, id string) (*models.NotificationChannel, error) {
	ctx, span := otel.Tracer("orion-notification-channel-svc").Start(ctx, "ChannelService.GetChannel")
	defer span.End()

	ch, err := s.repo.GetChannel(ctx, tenantID, id)
	if err != nil {
		return nil, ErrChannelNotFound
	}
	return ch, nil
}

// UpdateChannel updates an existing channel.
func (s *ChannelService) UpdateChannel(ctx context.Context, tenantID string, c *models.NotificationChannel) error {
	ctx, span := otel.Tracer("orion-notification-channel-svc").Start(ctx, "ChannelService.UpdateChannel")
	defer span.End()

	c.TenantID = tenantID

	// Verify the channel exists before updating
	if _, err := s.repo.GetChannel(ctx, tenantID, c.ID); err != nil {
		return ErrChannelNotFound
	}

	if err := s.repo.UpdateChannel(ctx, c); err != nil {
		return fmt.Errorf("failed to update channel: %w", err)
	}
	return nil
}

// DeleteChannel removes a channel by id.
func (s *ChannelService) DeleteChannel(ctx context.Context, tenantID, id string) error {
	ctx, span := otel.Tracer("orion-notification-channel-svc").Start(ctx, "ChannelService.DeleteChannel")
	defer span.End()

	if err := s.repo.DeleteChannel(ctx, tenantID, id); err != nil {
		return fmt.Errorf("failed to delete channel: %w", err)
	}
	return nil
}
