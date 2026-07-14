package service

import (
	"context"
	"orion/platform-svc-go/internal/channel/models"
	"orion/platform-svc-go/internal/channel/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateChannelRequest) (*models.NotificationChannel, error) {
	channel := &models.NotificationChannel{
		TenantID: tenantID,
		Type:     req.Type,
		Name:     req.Name,
		Enabled:  req.Enabled,
		Config:   req.Config,
		Secret:   req.Secret,
		Retry:    req.Retry,
	}
	if err := s.repo.Create(ctx, channel); err != nil {
		return nil, err
	}
	return channel, nil
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.NotificationChannel, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, filter *models.ChannelFilter) ([]models.NotificationChannel, int, error) {
	if filter == nil {
		filter = &models.ChannelFilter{Limit: 20}
	}
	return s.repo.List(ctx, tenantID, filter)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateChannelRequest) (*models.NotificationChannel, error) {
	updates := make(map[string]interface{})
	if req.Type != nil {
		updates["type"] = *req.Type
	}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if req.Config != nil {
		updates["config"] = req.Config
	}
	if req.Secret != nil {
		updates["secret"] = *req.Secret
	}
	if req.Retry != nil {
		updates["retry"] = *req.Retry
	}
	return s.repo.Update(ctx, tenantID, id, updates)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) GetEnabledByType(ctx context.Context, tenantID, channelType string) ([]models.NotificationChannel, error) {
	return s.repo.ListEnabledByType(ctx, tenantID, channelType)
}