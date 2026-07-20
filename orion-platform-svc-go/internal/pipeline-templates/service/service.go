package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"orion/platform-svc-go/internal/pipeline-templates/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CategoryCounts(ctx context.Context, tenantID string) (map[string]int, error)
	Create(ctx context.Context, m *models.PipelineTemplate) error
	CreateVersion(ctx context.Context, v *models.TemplateVersion) error
	DecrementStarCount(ctx context.Context, tenantID, id string) error
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error)
	IncrementStarCount(ctx context.Context, tenantID, id string) error
	IncrementUsageCount(ctx context.Context, tenantID, id string) error
	List(ctx context.Context, tenantID string, q *models.ListQuery) ([]models.PipelineTemplate, int, error)
	ListVersions(ctx context.Context, tenantID, templateID string, q *models.ListQuery) ([]models.TemplateVersion, int, error)
	SetStatus(ctx context.Context, tenantID, id string, status models.TemplateStatus, publishedAt *int64) (*models.PipelineTemplate, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.PipelineTemplate, error)
	DeleteVersionsByTemplateID(ctx context.Context, templateID string) error
}

var ErrTemplateNotPublished = errors.New("template must be published before instantiation")
var ErrValidation = errors.New("validation error")

// Repository defines the persistence contract for pipeline templates.
type Repository interface {
	Create(ctx context.Context, m *models.PipelineTemplate) error
	GetByID(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error)
	List(ctx context.Context, tenantID string, q *models.ListQuery) ([]models.PipelineTemplate, int, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.PipelineTemplate, error)
	Delete(ctx context.Context, tenantID, id string) error
	SetStatus(ctx context.Context, tenantID, id string, status models.TemplateStatus, publishedAt *int64) (*models.PipelineTemplate, error)
	CreateVersion(ctx context.Context, v *models.TemplateVersion) error
	ListVersions(ctx context.Context, tenantID, templateID string, q *models.ListQuery) ([]models.TemplateVersion, int, error)
	DeleteVersionsByTemplateID(ctx context.Context, templateID string) error
	IncrementUsageCount(ctx context.Context, tenantID, id string) error
	IncrementStarCount(ctx context.Context, tenantID, id string) error
	DecrementStarCount(ctx context.Context, tenantID, id string) error
	CategoryCounts(ctx context.Context, tenantID string) (map[string]int, error)
}

type Service struct {
	repo Repository
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// categoryDisplayName maps category key to human-readable name.
var categoryDisplayName = map[string]string{
	string(models.CategoryCICD):           "CI/CD",
	string(models.CategoryBuild):          "构建",
	string(models.CategoryDeploy):         "部署",
	string(models.CategoryTest):           "测试",
	string(models.CategorySecurity):       "安全",
	string(models.CategoryMonitoring):     "监控",
	string(models.CategoryInfrastructure): "基础设施",
	string(models.CategoryDataPipeline):   "数据管道",
	string(models.CategoryMLOps):          "ML Ops",
	string(models.CategoryCustom):         "自定义",
}

// Create creates a new template for the given tenant.
func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateTemplateRequest, authorID string) (*models.PipelineTemplate, error) {
	tags := "[]"
	if len(req.Tags) > 0 {
		b, err := json.Marshal(req.Tags)
		if err != nil {
			return nil, err
		}
		tags = string(b)
	}
	params := "[]"
	if len(req.Parameters) > 0 {
		b, err := json.Marshal(req.Parameters)
		if err != nil {
			return nil, err
		}
		params = string(b)
	}
	config := "{}"
	if len(req.Config) > 0 {
		b, err := json.Marshal(req.Config)
		if err != nil {
			return nil, err
		}
		config = string(b)
	}

	m := &models.PipelineTemplate{
		TenantID:    tenantID,
		Name:        req.Name,
		DisplayName: req.DisplayName,
		Description: req.Description,
		Category:    req.Category,
		Tags:        tags,
		Status:      models.StatusDraft,
		Visibility:  req.Visibility,
		Version:     "1.0.0",
		Author:      authorID,
		Config:      config,
		Parameters:  params,
		Readme:      req.Readme,
		Icon:        req.Icon,
	}
	if m.Visibility == "" {
		m.Visibility = models.VisibilityPrivate
	}
	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

// Get retrieves a template by ID for the given tenant.
func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// List returns a paginated, filtered list of templates for the tenant.
func (s *Service) List(ctx context.Context, tenantID string, q *models.ListQuery) ([]models.PipelineTemplate, int, error) {
	return s.repo.List(ctx, tenantID, q)
}

// Update updates a template's mutable fields for the given tenant.
func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateTemplateRequest) (*models.PipelineTemplate, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.DisplayName != nil {
		updates["display_name"] = *req.DisplayName
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Category != nil {
		updates["category"] = *req.Category
	}
	if len(req.Tags) > 0 {
		b, err := json.Marshal(req.Tags)
		if err != nil {
			return nil, err
		}
		updates["tags"] = string(b)
	}
	if req.Visibility != nil {
		updates["visibility"] = *req.Visibility
	}
	if len(req.Config) > 0 {
		b, err := json.Marshal(req.Config)
		if err != nil {
			return nil, err
		}
		updates["config"] = string(b)
	}
	if len(req.Parameters) > 0 {
		b, err := json.Marshal(req.Parameters)
		if err != nil {
			return nil, err
		}
		updates["parameters"] = string(b)
	}
	if req.Readme != nil {
		updates["readme"] = *req.Readme
	}
	if req.Icon != nil {
		updates["icon"] = *req.Icon
	}
	return s.repo.Update(ctx, tenantID, id, updates)
}

// Delete soft-removes a template for the given tenant.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// Publish sets the template status to published and creates a version record.
func (s *Service) Publish(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error) {
	tmpl, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	updated, err := s.repo.SetStatus(ctx, tenantID, id, models.StatusPublished, tmpl.UpdatedAt)
	if err != nil {
		return nil, err
	}
	// Create version record
	ver := &models.TemplateVersion{
		TemplateID: id,
		Version:    tmpl.Version,
		Config:     tmpl.Config,
		Parameters: tmpl.Parameters,
		ChangeLog:  "Initial publication",
		CreatedBy:  tmpl.Author,
	}
	if err := s.repo.CreateVersion(ctx, ver); err != nil {
		return nil, err
	}
	return updated, nil
}

// Deprecate sets the template status to deprecated.
func (s *Service) Deprecate(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error) {
	return s.repo.SetStatus(ctx, tenantID, id, models.StatusDeprecated, nil)
}

// GetVersions returns paginated versions for a template.
func (s *Service) GetVersions(ctx context.Context, tenantID, templateID string, q *models.ListQuery) ([]models.TemplateVersion, int, error) {
	return s.repo.ListVersions(ctx, tenantID, templateID, q)
}

// Instantiate creates a pipeline from a published template.
func (s *Service) Instantiate(ctx context.Context, tenantID, id string, req models.InstantiateTemplateRequest) (*models.InstantiateTemplateResponse, error) {
	tmpl, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if tmpl.Status != models.StatusPublished {
		return nil, ErrTemplateNotPublished
	}

	// Validate required parameters
	params := tmpl.ParametersSlice()
	for _, p := range params {
		if p.Required {
			// Check parameter name in req.Parameters; if absent, return error
			if _, ok := req.Parameters[p.Name]; !ok {
				return nil, fmt.Errorf("%w: missing required parameter %q", ErrValidation, p.Name)
			}
		}
	}

	// Increment usage count
	if err := s.repo.IncrementUsageCount(ctx, tenantID, id); err != nil {
		return nil, err
	}

	// Merge config: replace ${paramName} placeholders with provided parameter values
	mergedConfig := s.replacePlaceholders(tmpl.ConfigMap(), req.Parameters)
	if cfg, ok := mergedConfig.(map[string]interface{}); ok {
		mergedConfig = cfg
	}
	return &models.InstantiateTemplateResponse{
		PipelineID: "pipeline_" + uuid.New().String(),
		Config:     mergedConfig.(map[string]interface{}),
	}, nil
}

// GetCategories returns the list of categories with counts for the tenant.
func (s *Service) GetCategories(ctx context.Context, tenantID string) ([]models.TemplateCategorySummary, error) {
	counts, err := s.repo.CategoryCounts(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	var categories []models.TemplateCategorySummary
	for _, cat := range []string{
		string(models.CategoryCICD),
		string(models.CategoryBuild),
		string(models.CategoryDeploy),
		string(models.CategoryTest),
		string(models.CategorySecurity),
		string(models.CategoryMonitoring),
		string(models.CategoryInfrastructure),
		string(models.CategoryDataPipeline),
		string(models.CategoryMLOps),
		string(models.CategoryCustom),
	} {
		display := categoryDisplayName[cat]
		if display == "" {
			display = cat
		}
		categories = append(categories, models.TemplateCategorySummary{
			Name:        cat,
			DisplayName: display,
			Count:       counts[cat],
		})
	}
	return categories, nil
}

// Star increments the star count for a template.
func (s *Service) Star(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error) {
	if err := s.repo.IncrementStarCount(ctx, tenantID, id); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

// Unstar decrements the star count for a template.
func (s *Service) Unstar(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error) {
	if err := s.repo.DecrementStarCount(ctx, tenantID, id); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

// replacePlaceholders recursively replaces ${paramName} strings in a map with values.
func (s *Service) replacePlaceholders(obj interface{}, params map[string]interface{}) interface{} {
	switch v := obj.(type) {
	case string:
		if strings.HasPrefix(v, "${") && strings.HasSuffix(v, "}") {
			paramName := v[2 : len(v)-1]
			if val, ok := params[paramName]; ok {
				return val
			}
		}
		return v
	case []interface{}:
		for i, elem := range v {
			v[i] = s.replacePlaceholders(elem, params)
		}
		return v
	case map[string]interface{}:
		for key, elem := range v {
			v[key] = s.replacePlaceholders(elem, params)
		}
		return v
	default:
		return v
	}
}
