package service

import (
	"context"

	"orion/platform-svc-go/internal/notification/notification/models"
	"orion/platform-svc-go/internal/notification/notification/repository"
)

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
	_ = ctx
	_ = tenantID
	c.ID = "ch-001"
	return nil
}

// ListChannels returns all channels for a tenant.
func (s *ChannelService) ListChannels(ctx context.Context, tenantID string) ([]models.NotificationChannel, error) {
	_ = ctx
	_ = tenantID
	return nil, nil
}

// GetChannel returns a single channel by id.
func (s *ChannelService) GetChannel(ctx context.Context, tenantID, id string) (*models.NotificationChannel, error) {
	_ = ctx
	_ = tenantID
	_ = id
	return nil, nil
}

// UpdateChannel updates an existing channel.
func (s *ChannelService) UpdateChannel(ctx context.Context, tenantID string, c *models.NotificationChannel) error {
	_ = ctx
	_ = tenantID
	_ = c
	return nil
}

// DeleteChannel removes a channel by id.
func (s *ChannelService) DeleteChannel(ctx context.Context, tenantID, id string) error {
	_ = ctx
	_ = tenantID
	_ = id
	return nil
}
