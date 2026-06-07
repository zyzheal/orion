package service

import (
	"context"
	"errors"

	"orion/notify-svc-go/internal/models"
	"orion/notify-svc-go/internal/repository"

	"github.com/google/uuid"
)

var ErrNotifyTemplateNotFound = errors.New("template not found")

// Service provides notify template business logic.
type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// Create creates a new notify template with 'pending' status.
func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateNotifyTemplateRequest) (*models.NotifyTemplate, error) {
	d := &models.NotifyTemplate{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		Name:      req.Name,
		Channel:   req.Channel,
		Recipient: req.Recipient,
		Subject:   req.Subject,
		Body:      req.Body,
		Status:    "pending",
	}
	return d, s.repo.Create(ctx, d)
}

// List returns paginated notify templates for a tenant.
func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.NotifyTemplate, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

// GetByID returns a single notify template by ID and tenant.
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.NotifyTemplate, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// Delete removes a notify template by ID and tenant.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// Count returns the total number of notify templates for a tenant.
func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}
