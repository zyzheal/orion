package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"orion/platform-svc-go/internal/pipeline-template/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreatePipelineFromTemplate(ctx context.Context, tenantID string, templateID string, name string) (*models.InstantiatedPipeline, error)
	CreateTemplate(ctx context.Context, template *models.PipelineTemplate) error
	DeleteTemplate(ctx context.Context, id string, tenantID string) (bool, error)
	GetTemplateByID(ctx context.Context, id string, tenantID string) (*models.PipelineTemplate, error)
	ListTemplates(ctx context.Context, tenantID string) ([]models.PipelineTemplate, error)
	UpdateTemplate(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.PipelineTemplate, error)
}

type Repository interface {
	ListTemplates(ctx context.Context, tenantID string) ([]models.PipelineTemplate, error)
	GetTemplateByID(ctx context.Context, id string, tenantID string) (*models.PipelineTemplate, error)
	CreateTemplate(ctx context.Context, template *models.PipelineTemplate) error
	UpdateTemplate(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.PipelineTemplate, error)
	DeleteTemplate(ctx context.Context, id string, tenantID string) (bool, error)
	CreatePipelineFromTemplate(ctx context.Context, tenantID string, templateID string, name string) (*models.InstantiatedPipeline, error)
}

type Service struct {
	repo Repository
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// ListTemplates returns all templates for a tenant.
func (s *Service) ListTemplates(ctx context.Context, tenantID string) ([]models.PipelineTemplate, int, error) {
	templates, err := s.repo.ListTemplates(ctx, tenantID)
	if err != nil {
		return nil, 0, err
	}
	if templates == nil {
		templates = []models.PipelineTemplate{}
	}
	return templates, len(templates), nil
}

// GetTemplate returns a single template by ID.
func (s *Service) GetTemplate(ctx context.Context, id string, tenantID string) (*models.PipelineTemplate, error) {
	t, err := s.repo.GetTemplateByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrTemplateNotFound
		}
		return nil, err
	}
	return t, nil
}

// CreateTemplate creates a new template from a create request.
func (s *Service) CreateTemplate(ctx context.Context, req *models.CreateTemplateRequest, tenantID string) (*models.PipelineTemplate, error) {
	template := &models.PipelineTemplate{
		TenantID:       tenantID,
		Name:           req.Name,
		Description:    req.Description,
		YAMLDefinition: req.YAMLDefinition,
		Tags:           "[]",
		Category:       req.Category,
		Version:        req.Version,
		CreatedBy:      req.CreatedBy,
	}
	if req.Tags != nil {
		template.Tags = *req.Tags
	}
	if err := s.repo.CreateTemplate(ctx, template); err != nil {
		return nil, err
	}
	return s.repo.GetTemplateByID(ctx, template.ID, tenantID)
}

// UpdateTemplate updates a template by ID.
func (s *Service) UpdateTemplate(ctx context.Context, id string, req *models.UpdateTemplateRequest, tenantID string) (*models.PipelineTemplate, error) {
	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.YAMLDefinition != nil {
		updates["yaml_definition"] = *req.YAMLDefinition
	}
	if req.Tags != nil {
		updates["tags"] = *req.Tags
	}
	if req.Category != nil {
		updates["category"] = *req.Category
	}
	if req.Version != nil {
		updates["version"] = *req.Version
	}
	if len(updates) == 0 {
		return nil, errors.New("no fields to update")
	}
	t, err := s.repo.UpdateTemplate(ctx, id, tenantID, updates)
	if err != nil {
		return nil, err
	}
	return t, nil
}

// DeleteTemplate deletes a template by ID.
func (s *Service) DeleteTemplate(ctx context.Context, id string, tenantID string) (bool, error) {
	return s.repo.DeleteTemplate(ctx, id, tenantID)
}

// InstantiateTemplate creates a pipeline from a template.
func (s *Service) InstantiateTemplate(ctx context.Context, templateID string, req *models.InstantiateRequest, tenantID string) (*models.InstantiatedPipeline, error) {
	// Validate that the template exists
	_, err := s.repo.GetTemplateByID(ctx, templateID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrTemplateNotFound
		}
		return nil, err
	}
	// Serialize parameters if present
	_ = req.Environment // consumed by caller if needed
	if req.Parameters == nil {
		req.Parameters = map[string]string{}
	}
	_, err = json.Marshal(req.Parameters)
	if err != nil {
		return nil, err
	}
	inst, err := s.repo.CreatePipelineFromTemplate(ctx, tenantID, templateID, req.Name)
	if err != nil {
		return nil, err
	}
	return inst, nil
}

// --- Errors ---

var (
	ErrTemplateNotFound = errors.New("pipeline template not found")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrTemplateNotFound)
}

// --- Helpers ---

// nowTimestamp is retained for compatibility with the reference module pattern.
func nowTimestamp() time.Time {
	return time.Now().UTC()
}

func newUUID() string {
	return uuid.New().String()
}
