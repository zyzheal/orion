package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/config/internal/config/models"
	"orion/platform-svc-go/internal/config/internal/config/repository"

	"github.com/google/uuid"
)

var (
	ErrTemplateNotFound = errors.New("template not found")
	ErrWebhookNotFound  = errors.New("webhook not found")
)

// TemplateService handles config template operations.
type TemplateService struct {
	repo *repository.Repository
}

func NewTemplateService(repo *repository.Repository) *TemplateService {
	return &TemplateService{repo: repo}
}

// Create creates a new configuration template.
func (s *TemplateService) Create(ctx context.Context, tenantID string, req *models.CreateTemplateRequest) (*models.ConfigTemplate, error) {
	tags, _ := models.JSONBFromSlice(req.Tags)

	t := &models.ConfigTemplate{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Content:     req.Content,
		Format:      req.Format,
		Tags:        tags,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.repo.CreateTemplate(ctx, t); err != nil {
		return nil, fmt.Errorf("create template: %w", err)
	}

	// Record initial version
	v := &models.TemplateVersion{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		TemplateID:    t.ID,
		VersionNumber: 1,
		Content:       req.Content,
		CreatedAt:     time.Now(),
	}
	if err := s.repo.CreateTemplateVersion(ctx, v); err != nil {
		// Log but don't fail
		_ = err
	}

	return t, nil
}

// List returns a paginated list of templates.
func (s *TemplateService) List(ctx context.Context, tenantID string, offset, limit int) ([]models.ConfigTemplate, error) {
	return s.repo.ListTemplates(ctx, tenantID, offset, limit)
}

// GetByID returns a template by ID.
func (s *TemplateService) GetByID(ctx context.Context, tenantID, id string) (*models.ConfigTemplate, error) {
	t, err := s.repo.GetTemplate(ctx, tenantID, id)
	if err != nil {
		return nil, ErrTemplateNotFound
	}
	return t, nil
}

// Update modifies an existing template.
func (s *TemplateService) Update(ctx context.Context, tenantID, id string, req *models.UpdateTemplateRequest) (*models.ConfigTemplate, error) {
	t, err := s.repo.GetTemplate(ctx, tenantID, id)
	if err != nil {
		return nil, ErrTemplateNotFound
	}

	if req.Name != nil {
		t.Name = *req.Name
	}
	if req.Description != nil {
		t.Description = *req.Description
	}
	if req.Content != nil {
		t.Content = *req.Content
	}
	if req.Format != nil {
		t.Format = *req.Format
	}
	if req.Tags != nil {
		tags, _ := models.JSONBFromSlice(*req.Tags)
		t.Tags = tags
	}

	if err := s.repo.UpdateTemplate(ctx, t); err != nil {
		return nil, fmt.Errorf("update template: %w", err)
	}

	return t, nil
}

// Delete removes a template.
func (s *TemplateService) Delete(ctx context.Context, tenantID, id string) error {
	if err := s.repo.DeleteTemplate(ctx, tenantID, id); err != nil {
		return fmt.Errorf("delete template: %w", err)
	}
	return nil
}

// CreateVersion creates a new version of a template.
func (s *TemplateService) CreateVersion(ctx context.Context, tenantID, templateID string, req *models.CreateTemplateVersionRequest) (*models.TemplateVersion, error) {
	// Verify template exists
	_, err := s.repo.GetTemplate(ctx, tenantID, templateID)
	if err != nil {
		return nil, ErrTemplateNotFound
	}

	// Get latest version number
	latest, err := s.repo.GetLatestTemplateVersion(ctx, tenantID, templateID)
	nextVersion := 1
	if err == nil && latest != nil {
		nextVersion = latest.VersionNumber + 1
	}

	v := &models.TemplateVersion{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		TemplateID:    templateID,
		VersionNumber: nextVersion,
		Content:       req.Content,
		CreatedAt:     time.Now(),
	}

	if err := s.repo.CreateTemplateVersion(ctx, v); err != nil {
		return nil, fmt.Errorf("create template version: %w", err)
	}

	return v, nil
}

// ListVersions returns all versions of a template.
func (s *TemplateService) ListVersions(ctx context.Context, tenantID, templateID string) ([]models.TemplateVersion, error) {
	return s.repo.ListTemplateVersions(ctx, tenantID, templateID)
}

// WebhookService handles webhook operations.
type WebhookService struct {
	repo *repository.Repository
}

func NewWebhookService(repo *repository.Repository) *WebhookService {
	return &WebhookService{repo: repo}
}

// Create creates a new webhook.
func (s *WebhookService) Create(ctx context.Context, tenantID string, req *models.CreateWebhookRequest) (*models.Webhook, error) {
	events, _ := models.JSONBFromSlice(req.Events)
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	w := &models.Webhook{
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
func (s *WebhookService) List(ctx context.Context, tenantID string) ([]models.Webhook, error) {
	return s.repo.ListWebhooks(ctx, tenantID)
}

// GetByID returns a webhook by ID.
func (s *WebhookService) GetByID(ctx context.Context, tenantID, id string) (*models.Webhook, error) {
	w, err := s.repo.GetWebhook(ctx, tenantID, id)
	if err != nil {
		return nil, ErrWebhookNotFound
	}
	return w, nil
}

// Update modifies an existing webhook.
func (s *WebhookService) Update(ctx context.Context, tenantID, id string, req *models.UpdateWebhookRequest) (*models.Webhook, error) {
	w, err := s.repo.GetWebhook(ctx, tenantID, id)
	if err != nil {
		return nil, ErrWebhookNotFound
	}

	if req.Name != nil {
		w.Name = *req.Name
	}
	if req.URL != nil {
		w.URL = *req.URL
	}
	if req.Secret != nil {
		w.Secret = *req.Secret
	}
	if req.Events != nil {
		events, _ := models.JSONBFromSlice(*req.Events)
		w.Events = events
	}
	if req.Enabled != nil {
		w.Enabled = *req.Enabled
	}

	if err := s.repo.UpdateWebhook(ctx, w); err != nil {
		return nil, fmt.Errorf("update webhook: %w", err)
	}

	return w, nil
}

// Delete removes a webhook.
func (s *WebhookService) Delete(ctx context.Context, tenantID, id string) error {
	if err := s.repo.DeleteWebhook(ctx, tenantID, id); err != nil {
		return fmt.Errorf("delete webhook: %w", err)
	}
	return nil
}