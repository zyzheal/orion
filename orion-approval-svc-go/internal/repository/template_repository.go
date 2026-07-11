package repository

import (
	"context"
	"fmt"

	"orion/approval-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

// TemplateRepository handles persistence for approval templates.
type TemplateRepository struct {
	db *sqlx.DB
}

func NewTemplateRepository(db *sqlx.DB) *TemplateRepository {
	return &TemplateRepository{db: db}
}

// Create inserts a new template.
func (r *TemplateRepository) Create(ctx context.Context, t *models.ApprovalTemplate) error {
	// If marking as default, unset other defaults for same resource type
	if t.IsDefault {
		_, _ = r.db.ExecContext(ctx,
			`UPDATE approval_templates SET is_default = false WHERE tenant_id = $1 AND resource_type = $2 AND is_default = true`,
			t.TenantID, t.ResourceType)
	}
	query := `
		INSERT INTO approval_templates (tenant_id, name, description, resource_type, levels, mode, is_default)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`
	err := r.db.QueryRowContext(ctx, query,
		t.TenantID, t.Name, t.Description, t.ResourceType, t.Levels, t.Mode, t.IsDefault,
	).Scan(&t.ID, &t.CreatedAt)
	if err != nil {
		return fmt.Errorf("create template: %w", err)
	}
	return nil
}

// GetByID returns a template by tenant and ID.
func (r *TemplateRepository) GetByID(ctx context.Context, tenantID, id string) (*models.ApprovalTemplate, error) {
	var t models.ApprovalTemplate
	err := r.db.GetContext(ctx, &t,
		`SELECT * FROM approval_templates WHERE tenant_id = $1 AND id = $2`, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("get template: %w", err)
	}
	return &t, nil
}

// ListByTenant returns all templates for a tenant.
func (r *TemplateRepository) ListByTenant(ctx context.Context, tenantID string) ([]models.ApprovalTemplate, error) {
	var templates []models.ApprovalTemplate
	err := r.db.SelectContext(ctx, &templates,
		`SELECT * FROM approval_templates WHERE tenant_id = $1 ORDER BY is_default DESC, created_at DESC`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list templates: %w", err)
	}
	return templates, nil
}

// GetDefaultByResourceType returns the default template for a resource type.
func (r *TemplateRepository) GetDefaultByResourceType(ctx context.Context, tenantID, resourceType string) (*models.ApprovalTemplate, error) {
	var t models.ApprovalTemplate
	err := r.db.GetContext(ctx, &t, `
		SELECT * FROM approval_templates
		WHERE tenant_id = $1 AND resource_type = $2 AND is_default = true
		ORDER BY created_at DESC LIMIT 1
	`, tenantID, resourceType)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// Delete removes a template.
func (r *TemplateRepository) Delete(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM approval_templates WHERE tenant_id = $1 AND id = $2`, tenantID, id)
	if err != nil {
		return fmt.Errorf("delete template: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("template not found")
	}
	return nil
}
