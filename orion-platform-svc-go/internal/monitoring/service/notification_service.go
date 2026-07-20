package service

import (
	"context"

	"orion/platform-svc-go/internal/monitoring/models"
)

// --- Notification Channels ------------------------------------------

func (s *Service) CreateChannel(ctx context.Context, tenantID string, req models.CreateChannelRequest) (*models.NotificationChannel, error) {
	ch := &models.NotificationChannel{
		TenantID: tenantID,
		Name:     req.Name,
		Type:     req.Type,
		Config:   req.Config,
		Enabled:  true,
	}
	if err := s.repo.CreateChannel(ctx, ch); err != nil {
		return nil, err
	}
	return ch, nil
}

func (s *Service) GetChannels(ctx context.Context, tenantID string, limit, offset int) ([]models.NotificationChannel, error) {
	return s.repo.ListChannels(ctx, tenantID, limit, offset)
}

func (s *Service) ToggleChannel(ctx context.Context, tenantID, id string, enabled bool) (*models.NotificationChannel, error) {
	if err := s.repo.ToggleChannel(ctx, tenantID, id, enabled); err != nil {
		return nil, err
	}
	return s.repo.GetChannel(ctx, tenantID, id)
}

// --- Escalation Policies --------------------------------------------

func (s *Service) CreateEscalationPolicy(ctx context.Context, tenantID string, req models.CreateEscalationPolicyRequest) (*models.EscalationPolicy, error) {
	ep := &models.EscalationPolicy{
		TenantID: tenantID,
		Name:     req.Name,
		Levels:   req.Levels,
	}
	if err := s.repo.CreateEscalationPolicy(ctx, ep); err != nil {
		return nil, err
	}
	return ep, nil
}

func (s *Service) GetEscalationPolicies(ctx context.Context, tenantID string, limit, offset int) ([]models.EscalationPolicy, error) {
	return s.repo.ListEscalationPolicies(ctx, tenantID, limit, offset)
}

// --- Notification History -------------------------------------------

func (s *Service) GetNotificationHistory(ctx context.Context, tenantID string, limit, offset int) ([]models.NotificationRecord, error) {
	return s.repo.ListNotificationRecords(ctx, tenantID, limit, offset)
}
