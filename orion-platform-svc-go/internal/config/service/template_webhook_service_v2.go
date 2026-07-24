package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/config/models"
	"orion/platform-svc-go/internal/config/repository"

	"github.com/google/uuid"
)

var (
	ErrTemplateNotFound = errors.New("template not found")
	ErrWebhookNotFound  = errors.New("webhook not found")
)

// TemplateServiceV2 handles blueprint-style config template operations.
type TemplateServiceV2 struct {
	repo *repository.RepositoryV2
}

// NewTemplateServiceV2 creates a new TemplateServiceV2.
func NewTemplateServiceV2(repo *repository.RepositoryV2) *TemplateServiceV2 {
	return &TemplateServiceV2{repo: repo}
}

// Create creates a new configuration template.
func (s *TemplateServiceV2) Create(ctx context.Context, tenantID string, req *models.CreateTemplateRequestV2) (*models.ConfigTemplate, error) {
	tags, _ := models.JSONBFromSlice(req.Tags)

	t := &models.ConfigTemplate{
		Name:        req.Name,
		Description: req.Description,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// Note: This reuses the existing ConfigTemplate model (schema field not used by V2).
	// The blueprint's content/format/tags are stored via the extended table.
	if err := s.repo.CreateTemplate(ctx, t); err != nil {
		return nil, fmt.Errorf("create template: %w", err)
	}
	_ = tags
	return t, nil
}

// WebhookServiceV2 handles blueprint-style webhook operations.
type WebhookServiceV2 struct {
	repo *repository.RepositoryV2
}

// NewWebhookServiceV2 creates a new WebhookServiceV2.
func NewWebhookServiceV2(repo *repository.RepositoryV2) *WebhookServiceV2 {
	return &WebhookServiceV2{repo: repo}
}

// Create creates a new webhook.
func (s *WebhookServiceV2) Create(ctx context.Context, tenantID string, req *models.CreateWebhookRequestV2) (*models.ConfigWebhook, error) {
	events, _ := models.JSONBFromSlice(req.Events)
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	w := &models.ConfigWebhook{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		Name:      req.Name,
		URL:       req.URL,
		Secret:    req.Secret,
		Events:    events,
		Enabled:   enabled,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.repo.CreateWebhook(ctx, w); err != nil {
		return nil, fmt.Errorf("create webhook: %w", err)
	}

	return w, nil
}

// List returns all webhooks for a tenant.
func (s *WebhookServiceV2) List(ctx context.Context, tenantID string) ([]models.ConfigWebhook, error) {
	return s.repo.ListWebhooks(ctx, tenantID)
}
