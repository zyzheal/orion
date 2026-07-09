package service

import (
	"context"

	"orion/notification-svc-go/internal/models"
	"orion/notification-svc-go/internal/repository"
	"orion/go-common/pkg/otel"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// TemplateService implements the notification template business logic.
type TemplateService struct {
	repo   *repository.Repository
	logger *zap.Logger
}

// NewTemplateService creates a new TemplateService.
func NewTemplateService(repo *repository.Repository, logger *zap.Logger) *TemplateService {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &TemplateService{repo: repo, logger: logger}
}

// CreateTemplate creates a new notification template.
func (s *TemplateService) CreateTemplate(ctx context.Context, tenantID string, t *models.NotificationTemplate) error {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "TemplateService.Create")
	defer span.End()

	t.ID = uuid.New().String()
	t.TenantID = tenantID
	return s.repo.CreateTemplate(ctx, t)
}

// ListTemplates returns all templates for a tenant.
func (s *TemplateService) ListTemplates(ctx context.Context, tenantID string) ([]models.NotificationTemplate, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "TemplateService.List")
	defer span.End()

	return s.repo.ListTemplates(ctx, tenantID)
}

// GetTemplate returns a single template by id.
func (s *TemplateService) GetTemplate(ctx context.Context, tenantID, id string) (*models.NotificationTemplate, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "TemplateService.Get")
	defer span.End()

	return s.repo.GetTemplate(ctx, tenantID, id)
}

// DeleteTemplate removes a template.
func (s *TemplateService) DeleteTemplate(ctx context.Context, tenantID, id string) error {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "TemplateService.Delete")
	defer span.End()

	return s.repo.DeleteTemplate(ctx, tenantID, id)
}

// UpdateTemplate updates an existing template.
func (s *TemplateService) UpdateTemplate(ctx context.Context, tenantID, id string, t *models.NotificationTemplate) error {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "TemplateService.Update")
	defer span.End()

	return s.repo.UpdateTemplate(ctx, tenantID, id, t)
}
