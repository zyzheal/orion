package service

import (
	"context"
	"fmt"

	"orion/pipeline-svc-go/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// TemplateService manages pipeline templates
type TemplateService struct {
	db *sqlx.DB
}

func NewTemplateService(db *sqlx.DB) *TemplateService {
	return &TemplateService{db: db}
}

// Create creates a new pipeline template
func (s *TemplateService) Create(ctx context.Context, tenantID string, req models.CreateTemplateRequest) (*models.PipelineTemplate, error) {
	tmpl := &models.PipelineTemplate{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Category:    req.Category,
		YAMLConfig:  req.YAMLConfig,
		Variables:   req.Variables,
		IsPublic:    req.IsPublic,
		Version:     "1.0.0",
		UsageCount:  0,
	}

	query := `INSERT INTO pipeline_templates (id, tenant_id, name, description, category, yaml_config, variables, is_public, version, usage_count)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`
	_, err := s.db.ExecContext(ctx, query,
		tmpl.ID, tmpl.TenantID, tmpl.Name, tmpl.Description, tmpl.Category,
		tmpl.YAMLConfig, tmpl.Variables, tmpl.IsPublic, tmpl.Version, tmpl.UsageCount,
	)
	if err != nil {
		return nil, fmt.Errorf("create template: %w", err)
	}
	return tmpl, nil
}

// GetByID returns a template by ID
func (s *TemplateService) GetByID(ctx context.Context, id string) (*models.PipelineTemplate, error) {
	var tmpl models.PipelineTemplate
	err := s.db.GetContext(ctx, &tmpl, "SELECT * FROM pipeline_templates WHERE id = $1", id)
	if err != nil {
		return nil, fmt.Errorf("template not found: %w", err)
	}
	return &tmpl, nil
}

// List returns templates for a tenant (including public templates)
func (s *TemplateService) List(ctx context.Context, tenantID string, category string, offset, limit int) ([]models.PipelineTemplate, int, error) {
	var templates []models.PipelineTemplate
	var total int

	countQuery := "SELECT COUNT(*) FROM pipeline_templates WHERE (tenant_id = $1 OR is_public = true)"
	listQuery := "SELECT * FROM pipeline_templates WHERE (tenant_id = $1 OR is_public = true)"
	args := []interface{}{tenantID}

	if category != "" {
		countQuery += " AND category = $2"
		listQuery += " AND category = $2"
		args = append(args, category)
	}

	if err := s.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, err
	}

	listQuery += " ORDER BY usage_count DESC, created_at DESC LIMIT $" + fmt.Sprintf("%d", len(args)+1) + " OFFSET $" + fmt.Sprintf("%d", len(args)+2)
	args = append(args, limit, offset)

	if err := s.db.SelectContext(ctx, &templates, listQuery, args...); err != nil {
		return nil, 0, err
	}
	return templates, total, nil
}

// Delete deletes a template
func (s *TemplateService) Delete(ctx context.Context, tenantID, id string) error {
	result, err := s.db.ExecContext(ctx, "DELETE FROM pipeline_templates WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("template not found")
	}
	return nil
}

// IncrementUsage increments the usage count when a template is used
func (s *TemplateService) IncrementUsage(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, "UPDATE pipeline_templates SET usage_count = usage_count + 1 WHERE id = $1", id)
	return err
}
