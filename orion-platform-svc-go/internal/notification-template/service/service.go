package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"orion/platform-svc-go/internal/notification-template/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Count(ctx context.Context, tenantID string) (int, error)
	Create(ctx context.Context, tpl *models.NotificationTemplate) error
	Delete(ctx context.Context, tenantID, id string) (bool, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.NotificationTemplate, error)
	List(ctx context.Context, tenantID string, filter models.ListFilter, limit, offset int) ([]models.NotificationTemplate, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.NotificationTemplate, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// Create creates a new notification template.
func (s *Service) Create(ctx context.Context, tenantID, userID string, req *models.CreateTemplateRequest) (*models.NotificationTemplate, error) {
	tpl := &models.NotificationTemplate{
		TenantID:      tenantID,
		UserID:        userID,
		Name:          req.Name,
		Description:   req.Description,
		Channel:       req.Channel,
		TitleTemplate: req.TitleTemplate,
		BodyTemplate:  req.BodyTemplate,
		Variables:     req.Variables,
		Enabled:       req.Enabled,
	}
	if err := s.repo.Create(ctx, tpl); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, tpl.ID)
}

// List retrieves paginated notification templates.
func (s *Service) List(ctx context.Context, tenantID string, filter models.ListFilter, page, pageSize int) ([]models.NotificationTemplate, int, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize
	templates, err := s.repo.List(ctx, tenantID, filter, pageSize, offset)
	if err != nil {
		return nil, 0, 0, err
	}
	if templates == nil {
		templates = []models.NotificationTemplate{}
	}
	total, err := s.repo.Count(ctx, tenantID)
	if err != nil {
		return nil, 0, 0, err
	}
	return templates, total, len(templates), nil
}

// Get retrieves a notification template by ID.
func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.NotificationTemplate, error) {
	tpl, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrTemplateNotFound
		}
		return nil, err
	}
	return tpl, nil
}

// Update updates an existing notification template.
func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateTemplateRequest) (*models.NotificationTemplate, error) {
	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Channel != nil {
		updates["channel"] = *req.Channel
	}
	if req.TitleTemplate != nil {
		updates["title_template"] = *req.TitleTemplate
	}
	if req.BodyTemplate != nil {
		updates["body_template"] = *req.BodyTemplate
	}
	if req.Variables != nil {
		updates["variables"] = *req.Variables
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if len(updates) == 0 {
		return nil, errors.New("no fields to update")
	}
	tpl, err := s.repo.Update(ctx, tenantID, id, updates)
	if err != nil {
		return nil, err
	}
	return tpl, nil
}

// Delete removes a notification template.
func (s *Service) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.Delete(ctx, tenantID, id)
}

// Count returns the total number of notification templates for a tenant.
func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// Render renders a template with the given variable values.
// Replaces {{varName} patterns in title_template and body_template.
func (s *Service) Render(ctx context.Context, tenantID string, req *models.RenderRequest) (*models.RenderResult, error) {
	tpl, err := s.repo.GetByID(ctx, tenantID, req.TemplateID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrTemplateNotFound
		}
		return nil, err
	}
	title := renderTemplate(tpl.TitleTemplate, req.Variables)
	body := renderTemplate(tpl.BodyTemplate, req.Variables)
	return &models.RenderResult{Title: title, Body: body}, nil
}

// Preview renders a template with placeholder variable values.
func (s *Service) Preview(ctx context.Context, tenantID, id string) (*models.RenderResult, error) {
	tpl, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrTemplateNotFound
		}
		return nil, err
	}
	// Use placeholder values: "{{varName}" -> "placeholder_varName"
	placeholders := extractVariables(tpl.TitleTemplate + " " + tpl.BodyTemplate)
	vars := make(map[string]string, len(placeholders))
	for _, v := range placeholders {
		vars[v] = "placeholder_" + v
	}
	title := renderTemplate(tpl.TitleTemplate, vars)
	body := renderTemplate(tpl.BodyTemplate, vars)
	return &models.RenderResult{Title: title, Body: body}, nil
}

// Duplicate copies an existing template with a "- Copy" suffix.
func (s *Service) Duplicate(ctx context.Context, tenantID, userID, id string) (*models.NotificationTemplate, error) {
	original, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrTemplateNotFound
		}
		return nil, err
	}
	tpl := &models.NotificationTemplate{
		TenantID:      tenantID,
		UserID:        userID,
		Name:          original.Name + " - Copy",
		Description:   original.Description,
		Channel:       original.Channel,
		TitleTemplate: original.TitleTemplate,
		BodyTemplate:  original.BodyTemplate,
		Variables:     original.Variables,
		Enabled:       original.Enabled,
	}
	if err := s.repo.Create(ctx, tpl); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, tpl.ID)
}

// --- Template rendering helpers ---

// renderTemplate replaces {{varName} patterns with the corresponding values.
func renderTemplate(tmpl string, vars map[string]string) string {
	result := tmpl
	for key, val := range vars {
		result = strings.ReplaceAll(result, "{{"+key+"}", val)
	}
	return result
}

// extractVariables extracts all {{varName} variable names from a template string.
func extractVariables(tmpl string) []string {
	var vars []string
	seen := make(map[string]bool)
	remaining := tmpl
	for {
		start := strings.Index(remaining, "{{")
		if start == -1 {
			break
		}
		end := strings.Index(remaining[start:], "}")
		if end == -1 {
			break
		}
		varName := strings.TrimSpace(remaining[start+2 : start+end])
		if !seen[varName] && varName != "" {
			vars = append(vars, varName)
			seen[varName] = true
		}
		remaining = remaining[start+end+2:]
	}
	return vars
}

// --- Errors ---

var ErrTemplateNotFound = errors.New("notification template not found")

func IsNotFound(err error) bool {
	return errors.Is(err, ErrTemplateNotFound)
}

// --- Helpers ---

func nowTimestamp() time.Time {
	return time.Now().UTC()
}

func newUUID() string {
	return uuid.New().String()
}
