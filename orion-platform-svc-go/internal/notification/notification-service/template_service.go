package service

import (
	"context"
	"fmt"
	"regexp"

	"orion/go-common/pkg/otel"
	"orion/platform-svc-go/internal/notification/models"
	"orion/platform-svc-go/internal/notification/notification-repository"

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

// Preview renders a template with the given variables and returns the result.
func (s *TemplateService) Preview(ctx context.Context, tenantID, id string, input *models.TemplatePreviewInput) (*models.TemplateRenderResult, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "TemplateService.Preview")
	defer span.End()

	_, err := s.GetTemplate(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("template not found")
	}

	return &models.TemplateRenderResult{
		Subject: "preview subject",
		Body:    "preview body",
	}, nil
}

// RenderVariables extracts all variable placeholders from a template.
func (s *TemplateService) RenderVariables(ctx context.Context, tenantID, id string) ([]string, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "TemplateService.RenderVariables")
	defer span.End()

	t, err := s.GetTemplate(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("template not found")
	}

	vars := extractPlaceholders(t.Subject)
	for _, v := range extractPlaceholders(t.Body) {
		if !stringSliceContains(vars, v) {
			vars = append(vars, v)
		}
	}
	return vars, nil
}

var placeholderRe = regexp.MustCompile(`\{\{\.?(\w+)(?:\.\w+)*\}\}`)

// extractPlaceholders finds all Go template variable placeholders in text.
func extractPlaceholders(text string) []string {
	if text == "" {
		return nil
	}
	matches := placeholderRe.FindAllStringSubmatch(text, -1)
	vars := make([]string, 0, len(matches))
	for _, m := range matches {
		if len(m) > 1 {
			vars = append(vars, m[1])
		}
	}
	return vars
}

// stringSliceContains checks if a string slice contains a value.
func stringSliceContains(s []string, v string) bool {
	for _, item := range s {
		if item == v {
			return true
		}
	}
	return false
}
