package repository

import (
	"context"
	"fmt"
	"strings"

	"orion/platform-svc-go/internal/lowcode-designer/models"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateForm(ctx context.Context, f *models.FormDefinition) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO form_definition (id, tenant_id, name, title, description, version, status, category, module_name, tags, layout, fields, meta, created_by, updated_by, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		f.ID, f.TenantID, f.Name, f.Title, f.Description, f.Version, f.Status, f.Category, f.ModuleName, f.Tags, f.Layout, f.FieldsJSON, f.Meta, f.CreatedBy, f.UpdatedBy, f.CreatedAt, f.UpdatedAt)
	return err
}

func (r *Repository) GetForm(ctx context.Context, id, tenantID string) (*models.FormDefinition, error) {
	var f models.FormDefinition
	err := r.db.GetContext(ctx, &f, `SELECT * FROM form_definition WHERE id=? AND tenant_id=?`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

func (r *Repository) ListForms(ctx context.Context, tenantID, category, status string) ([]models.FormDefinition, error) {
	where := "tenant_id=?"
	args := []interface{}{tenantID}
	if category != "" {
		where += " AND category=?"
		args = append(args, category)
	}
	if status != "" {
		where += " AND status=?"
		args = append(args, status)
	}
	query := fmt.Sprintf("SELECT * FROM form_definition WHERE %s ORDER BY created_at DESC", where)
	var items []models.FormDefinition
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) UpdateForm(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.FormDefinition, error) {
	fields := []string{}
	args := []interface{}{}
	for k, v := range attrs {
		fields = append(fields, fmt.Sprintf("%s=?", k))
		args = append(args, v)
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE form_definition SET %s, updated_at=NOW() WHERE id=? AND tenant_id=?", strings.Join(fields, ", "))
	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetForm(ctx, id, tenantID)
}

func (r *Repository) DeleteForm(ctx context.Context, id, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM form_definition WHERE id=? AND tenant_id=?`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

func (r *Repository) CreateField(ctx context.Context, f *models.FormField) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO form_field (id, tenant_id, form_id, key, label, type, required, visible, disabled, placeholder, default_val, options, rules, meta, layout_config, sortable_index, parent_key, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		f.ID, f.TenantID, f.FormID, f.Key, f.Label, f.Type, f.Required, f.Visible, f.Disabled,
		f.Placeholder, f.DefaultVal, f.Options, f.Rules, f.Meta, f.LayoutConfig, f.SortableIndex, f.ParentKey, f.CreatedAt, f.UpdatedAt)
	return err
}

func (r *Repository) UpdateField(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.FormField, error) {
	fields := []string{}
	args := []interface{}{}
	for k, v := range attrs {
		fields = append(fields, fmt.Sprintf("%s=?", k))
		args = append(args, v)
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE form_field SET %s, updated_at=NOW() WHERE id=? AND tenant_id=?", strings.Join(fields, ", "))
	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	var f models.FormField
	err = r.db.GetContext(ctx, &f, `SELECT * FROM form_field WHERE id=? AND tenant_id=?`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

func (r *Repository) DeleteField(ctx context.Context, id, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM form_field WHERE id=? AND tenant_id=?`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

func (r *Repository) GetFieldsByForm(ctx context.Context, formID, tenantID string) ([]models.FormField, error) {
	var items []models.FormField
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM form_field WHERE form_id=? AND tenant_id=? ORDER BY sortable_index`, formID, tenantID)
	return items, err
}

func (r *Repository) CreateTemplate(ctx context.Context, t *models.FormTemplate) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO form_template (id, tenant_id, name, description, category, is_builtin, form_schema, preview_url, usage_count, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		t.ID, t.TenantID, t.Name, t.Description, t.Category, t.IsBuiltin, t.FormSchema, t.PreviewURL, t.UsageCount, t.CreatedAt, t.UpdatedAt)
	return err
}

func (r *Repository) ListTemplates(ctx context.Context, tenantID, category string) ([]models.FormTemplate, error) {
	where := "tenant_id=?"
	args := []interface{}{tenantID}
	if category != "" {
		where += " AND category=?"
		args = append(args, category)
	}
	query := fmt.Sprintf("SELECT * FROM form_template WHERE %s ORDER BY usage_count DESC", where)
	var items []models.FormTemplate
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) GetTemplate(ctx context.Context, id string) (*models.FormTemplate, error) {
	var t models.FormTemplate
	err := r.db.GetContext(ctx, &t, `SELECT * FROM form_template WHERE id=?`, id)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) UpdateTemplateUsage(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE form_template SET usage_count=usage_count+1 WHERE id=?`, id)
	return err
}

func (r *Repository) CreateInstance(ctx context.Context, inst *models.FormInstance) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO form_instance (id, tenant_id, form_id, data, status, submitted_by, submitted_at, approved_by, approved_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		inst.ID, inst.TenantID, inst.FormID, inst.Data, inst.Status, inst.SubmittedBy, inst.SubmittedAt, inst.ApprovedBy, inst.ApprovedAt, inst.CreatedAt, inst.UpdatedAt)
	return err
}

func (r *Repository) GetInstance(ctx context.Context, id, tenantID string) (*models.FormInstance, error) {
	var inst models.FormInstance
	err := r.db.GetContext(ctx, &inst, `SELECT * FROM form_instance WHERE id=? AND tenant_id=?`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &inst, nil
}

func (r *Repository) ListInstances(ctx context.Context, tenantID, formID, status string) ([]models.FormInstance, error) {
	where := "tenant_id=?"
	args := []interface{}{tenantID}
	if formID != "" {
		where += " AND form_id=?"
		args = append(args, formID)
	}
	if status != "" {
		where += " AND status=?"
		args = append(args, status)
	}
	query := fmt.Sprintf("SELECT * FROM form_instance WHERE %s ORDER BY created_at DESC", where)
	var items []models.FormInstance
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) UpdateInstance(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.FormInstance, error) {
	fields := []string{}
	args := []interface{}{}
	for k, v := range attrs {
		fields = append(fields, fmt.Sprintf("%s=?", k))
		args = append(args, v)
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE form_instance SET %s, updated_at=NOW() WHERE id=? AND tenant_id=?", strings.Join(fields, ", "))
	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetInstance(ctx, id, tenantID)
}

func (r *Repository) CreateComponent(ctx context.Context, c *models.ComponentRegistry) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO component_registry (id, tenant_id, name, display_name, category, version, props_schema, default_config, icon, is_builtin, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		c.ID, c.TenantID, c.Name, c.DisplayName, c.Category, c.Version, c.PropsSchema, c.DefaultConfig, c.Icon, c.IsBuiltin, c.CreatedAt)
	return err
}

func (r *Repository) ListComponents(ctx context.Context, tenantID, category string) ([]models.ComponentRegistry, error) {
	where := "tenant_id=?"
	args := []interface{}{tenantID}
	if category != "" {
		where += " AND category=?"
		args = append(args, category)
	}
	query := fmt.Sprintf("SELECT * FROM component_registry WHERE %s ORDER BY created_at DESC", where)
	var items []models.ComponentRegistry
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) GetComponent(ctx context.Context, id string) (*models.ComponentRegistry, error) {
	var c models.ComponentRegistry
	err := r.db.GetContext(ctx, &c, `SELECT * FROM component_registry WHERE id=?`, id)
	if err != nil {
		return nil, err
	}
	return &c, nil
}
