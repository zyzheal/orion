package service

import (
	"context"
	errors "errors"
	"orion/notification-svc-go/internal/models"
	"orion/notification-svc-go/internal/repository"
	"github.com/google/uuid"
)

var ErrNotificationNotFound = errors.New("notification not found")

type Service struct { repo *repository.Repository }

func NewService(repo *repository.Repository) *Service { return &Service{repo: repo} }

func (s *Service) SendNotification(ctx context.Context, tenantID string, req *models.CreateNotificationRequest) (*models.Notification, error) {
	n := &models.Notification{
		ID: uuid.New().String(), TenantID: tenantID, Channel: req.Channel,
		Recipient: req.Recipient, Subject: req.Subject, Body: req.Body,
		Status: models.StatusPending, Metadata: models.JSONB(req.Metadata),
	}
	if err := s.repo.CreateNotification(ctx, n); err != nil { return nil, err }
	n.Status = models.StatusSent
	return n, nil
}

func (s *Service) ListNotifications(ctx context.Context, tenantID string, offset, limit int) ([]models.Notification, error) {
	return s.repo.ListNotifications(ctx, tenantID, offset, limit)
}

func (s *Service) GetNotification(ctx context.Context, tenantID, id string) (*models.Notification, error) {
	return s.repo.GetNotification(ctx, tenantID, id)
}

func (s *Service) CreateTemplate(ctx context.Context, tenantID string, t *models.NotificationTemplate) error {
	t.ID = uuid.New().String(); t.TenantID = tenantID
	return s.repo.CreateTemplate(ctx, t)
}

func (s *Service) ListTemplates(ctx context.Context, tenantID string) ([]models.NotificationTemplate, error) {
	return s.repo.ListTemplates(ctx, tenantID)
}

func (s *Service) CreateChannel(ctx context.Context, tenantID string, c *models.NotificationChannel) error {
	c.ID = uuid.New().String(); c.TenantID = tenantID
	return s.repo.CreateChannel(ctx, c)
}

func (s *Service) ListChannels(ctx context.Context, tenantID string) ([]models.NotificationChannel, error) {
	return s.repo.ListChannels(ctx, tenantID)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteNotification(ctx, tenantID, id)
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountNotifications(ctx, tenantID)
}
