package repository

import (
	"context"
	"fmt"
	"strings"

	"orion/platform-svc-go/internal/lowcode-designer/models"

	"github.com/jmoiron/sqlx"
)

// The five tables this repository owns are declared by
// migrations/396_create_lowcode_designer.sql and by no other migration, so each
// column list below is one table's full column set in declaration order.
// Explicit lists rather than SELECT *: migration 572 alters a thousand tables
// repository-wide, so a later migration touching one of these five would
// otherwise make every read here fail because a result column has no matching
// struct field. cmd/server/migration_lowcode_designer_tables_test.go derives
// the five lists from 396 so they cannot drift apart.
const formColumns = `id, tenant_id, name, title, description, version, status, category, module_name, tags, layout, fields, meta, created_by, updated_by, created_at, updated_at`

const fieldColumns = `id, tenant_id, form_id, key, label, type, required, visible, disabled, placeholder, default_val, options, rules, meta, layout_config, sortable_index, parent_key, created_at, updated_at`

const templateColumns = `id, tenant_id, name, description, category, is_builtin, form_schema, preview_url, usage_count, created_at, updated_at`

const instanceColumns = `id, tenant_id, form_id, data, status, submitted_by, submitted_at, approved_by, approved_at, created_at, updated_at`

const componentColumns = `id, tenant_id, name, display_name, category, version, props_schema, default_config, icon, is_builtin, created_at`

// jsonArg renders a marshalled JSON attribute as its text form, or as SQL NULL
// when there is nothing to store. Binding an empty string is not an option: an
// empty literal is not valid JSON, so Postgres rejected the statement before
// the row existed and every insert of a plain text field failed. A Go nil
// passes through database/sql untouched and lib/pq writes the length -1 marker
// the server reads as NULL, so nil is the correct way to leave the column
// unset. A marshalled null is normalised to NULL as well: both decode to an
// absent value on the read path, and the column's declared default is NULL.
func jsonArg(v interface{}) interface{} {
	if s, ok := v.(string); ok {
		if s == "" || s == "null" {
			return nil
		}
	}
	return v
}

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateForm(ctx context.Context, f *models.FormDefinition) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO form_definition (id, tenant_id, name, title, description, version, status, category, module_name, tags, layout, fields, meta, created_by, updated_by, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
		f.ID, f.TenantID, f.Name, f.Title, f.Description, f.Version, f.Status, f.Category, f.ModuleName,
		jsonArg(f.Tags), jsonArg(f.Layout), f.FieldsJSON, jsonArg(f.Meta),
		f.CreatedBy, f.UpdatedBy, f.CreatedAt, f.UpdatedAt)
	return err
}

func (r *Repository) GetForm(ctx context.Context, id, tenantID string) (*models.FormDefinition, error) {
	var f models.FormDefinition
	err := r.db.GetContext(ctx, &f,
		"SELECT "+formColumns+" FROM form_definition WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

func (r *Repository) ListForms(ctx context.Context, tenantID, category, status string) ([]models.FormDefinition, error) {
	args := []interface{}{tenantID}
	where := "tenant_id = $1"
	if category != "" {
		args = append(args, category)
		where += fmt.Sprintf(" AND category = $%d", len(args))
	}
	if status != "" {
		args = append(args, status)
		where += fmt.Sprintf(" AND status = $%d", len(args))
	}
	var items []models.FormDefinition
	err := r.db.SelectContext(ctx, &items,
		"SELECT "+formColumns+" FROM form_definition WHERE "+where+" ORDER BY created_at DESC", args...)
	return items, err
}

// formUpdatable lists the columns a partial update may touch, in a fixed order.
// id, tenant_id and created_at are identity and audit; the tenant is the
// boundary the row is looked up by and the timestamps are written by the
// statement itself.
var formUpdatable = []string{
	"name", "title", "description", "version", "status",
	"category", "module_name", "tags", "layout", "fields", "meta", "updated_by",
}

// buildSET renders col = $1, col = $2, ... for the entries of attrs that are
// allowed, in the whitelist order, and returns the values to bind. Walking the
// whitelist rather than the map keeps the generated SQL deterministic, because
// Go maps have no iteration order. A key outside the whitelist is an error
// instead of being interpolated into the SQL as a column name: the previous
// code formatted the caller map keys straight into the SET clause, which on
// PUT /lowcode-designer/forms/:id was a SQL injection sink.
func buildSET(whitelist []string, attrs map[string]interface{}) (string, []interface{}, error) {
	ok := make(map[string]bool, len(whitelist))
	for _, col := range whitelist {
		ok[col] = true
	}
	for k := range attrs {
		if !ok[k] {
			return "", nil, fmt.Errorf("column %q is not updatable", k)
		}
	}
	clauses := make([]string, 0, len(attrs))
	args := make([]interface{}, 0, len(attrs))
	for _, col := range whitelist {
		v, exists := attrs[col]
		if !exists {
			continue
		}
		args = append(args, jsonArg(v))
		clauses = append(clauses, fmt.Sprintf("%s = $%d", col, len(args)))
	}
	return strings.Join(clauses, ", "), args, nil
}

func (r *Repository) UpdateForm(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.FormDefinition, error) {
	if len(attrs) == 0 {
		return r.GetForm(ctx, id, tenantID)
	}
	setClause, args, err := buildSET(formUpdatable, attrs)
	if err != nil {
		return nil, err
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE form_definition SET %s, updated_at = NOW() WHERE id = $%d AND tenant_id = $%d",
		setClause, len(args)-1, len(args))
	if _, err := r.db.ExecContext(ctx, query, args...); err != nil {
		return nil, err
	}
	return r.GetForm(ctx, id, tenantID)
}

func (r *Repository) DeleteForm(ctx context.Context, id, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		"DELETE FROM form_definition WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return false, err
	}
	// The row count is the answer to "was it deleted?", so a failure reading it
	// is a failure: discarding it made a real driver error report as
	// "not deleted" instead of surfacing.
	rows, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("counting deleted forms: %w", err)
	}
	return rows > 0, nil
}

func (r *Repository) CreateField(ctx context.Context, f *models.FormField) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO form_field (id, tenant_id, form_id, key, label, type, required, visible, disabled, placeholder, default_val, options, rules, meta, layout_config, sortable_index, parent_key, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
		f.ID, f.TenantID, f.FormID, f.Key, f.Label, f.Type, f.Required, f.Visible, f.Disabled, f.Placeholder,
		jsonArg(f.DefaultVal), jsonArg(f.Options), jsonArg(f.Rules), jsonArg(f.Meta), jsonArg(f.LayoutConfig),
		f.SortableIndex, f.ParentKey, f.CreatedAt, f.UpdatedAt)
	return err
}

// fieldUpdatable excludes form_id and key as well as the identity columns: the
// pair is the form_field unique index, and the same key is referenced by name
// from form_definition.fields, so editing either would desynchronise the two
// without the form noticing.
var fieldUpdatable = []string{
	"label", "type", "required", "visible", "disabled", "placeholder",
	"default_val", "options", "rules", "meta", "layout_config",
	"sortable_index", "parent_key",
}

func (r *Repository) UpdateField(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.FormField, error) {
	if len(attrs) == 0 {
		return r.GetField(ctx, id, tenantID)
	}
	setClause, args, err := buildSET(fieldUpdatable, attrs)
	if err != nil {
		return nil, err
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE form_field SET %s, updated_at = NOW() WHERE id = $%d AND tenant_id = $%d",
		setClause, len(args)-1, len(args))
	if _, err := r.db.ExecContext(ctx, query, args...); err != nil {
		return nil, err
	}
	return r.GetField(ctx, id, tenantID)
}

// GetField is the re-read half of UpdateField and the read behind the empty
// attribute map. It has no route of its own; the field routes are keyed by form
// and listed through GetFieldsByForm.
func (r *Repository) GetField(ctx context.Context, id, tenantID string) (*models.FormField, error) {
	var f models.FormField
	err := r.db.GetContext(ctx, &f,
		"SELECT "+fieldColumns+" FROM form_field WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

func (r *Repository) DeleteField(ctx context.Context, id, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		"DELETE FROM form_field WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return false, err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("counting deleted fields: %w", err)
	}
	return rows > 0, nil
}

func (r *Repository) GetFieldsByForm(ctx context.Context, formID, tenantID string) ([]models.FormField, error) {
	var items []models.FormField
	err := r.db.SelectContext(ctx, &items,
		"SELECT "+fieldColumns+" FROM form_field WHERE form_id = $1 AND tenant_id = $2 ORDER BY sortable_index",
		formID, tenantID)
	return items, err
}

func (r *Repository) CreateTemplate(ctx context.Context, t *models.FormTemplate) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO form_template (id, tenant_id, name, description, category, is_builtin, form_schema, preview_url, usage_count, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		t.ID, t.TenantID, t.Name, t.Description, t.Category, t.IsBuiltin, t.FormSchema,
		t.PreviewURL, t.UsageCount, t.CreatedAt, t.UpdatedAt)
	return err
}

func (r *Repository) ListTemplates(ctx context.Context, tenantID, category string) ([]models.FormTemplate, error) {
	args := []interface{}{tenantID}
	where := "tenant_id = $1"
	if category != "" {
		args = append(args, category)
		where += fmt.Sprintf(" AND category = $%d", len(args))
	}
	var items []models.FormTemplate
	err := r.db.SelectContext(ctx, &items,
		"SELECT "+templateColumns+" FROM form_template WHERE "+where+" ORDER BY usage_count DESC", args...)
	return items, err
}

// GetTemplate takes the tenant because the template route is per tenant:
// ListTemplates on the same table filters by tenant, so a tenant-less lookup
// let any caller read any template by id.
func (r *Repository) GetTemplate(ctx context.Context, id, tenantID string) (*models.FormTemplate, error) {
	var t models.FormTemplate
	err := r.db.GetContext(ctx, &t,
		"SELECT "+templateColumns+" FROM form_template WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) CreateInstance(ctx context.Context, inst *models.FormInstance) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO form_instance (id, tenant_id, form_id, data, status, submitted_by, submitted_at, approved_by, approved_at, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		inst.ID, inst.TenantID, inst.FormID, inst.Data, inst.Status, inst.SubmittedBy,
		inst.SubmittedAt, inst.ApprovedBy, inst.ApprovedAt, inst.CreatedAt, inst.UpdatedAt)
	return err
}

func (r *Repository) GetInstance(ctx context.Context, id, tenantID string) (*models.FormInstance, error) {
	var inst models.FormInstance
	err := r.db.GetContext(ctx, &inst,
		"SELECT "+instanceColumns+" FROM form_instance WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return &inst, nil
}

func (r *Repository) ListInstances(ctx context.Context, tenantID, formID, status string) ([]models.FormInstance, error) {
	args := []interface{}{tenantID}
	where := "tenant_id = $1"
	if formID != "" {
		args = append(args, formID)
		where += fmt.Sprintf(" AND form_id = $%d", len(args))
	}
	if status != "" {
		args = append(args, status)
		where += fmt.Sprintf(" AND status = $%d", len(args))
	}
	var items []models.FormInstance
	err := r.db.SelectContext(ctx, &items,
		"SELECT "+instanceColumns+" FROM form_instance WHERE "+where+" ORDER BY created_at DESC", args...)
	return items, err
}

// instanceUpdatable excludes form_id because re-pointing an instance at a
// different form would leave its data speaking the old schema.
var instanceUpdatable = []string{
	"data", "status", "submitted_by", "submitted_at", "approved_by", "approved_at",
}

func (r *Repository) UpdateInstance(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.FormInstance, error) {
	if len(attrs) == 0 {
		return r.GetInstance(ctx, id, tenantID)
	}
	setClause, args, err := buildSET(instanceUpdatable, attrs)
	if err != nil {
		return nil, err
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE form_instance SET %s, updated_at = NOW() WHERE id = $%d AND tenant_id = $%d",
		setClause, len(args)-1, len(args))
	if _, err := r.db.ExecContext(ctx, query, args...); err != nil {
		return nil, err
	}
	return r.GetInstance(ctx, id, tenantID)
}

func (r *Repository) CreateComponent(ctx context.Context, c *models.ComponentRegistry) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO component_registry (id, tenant_id, name, display_name, category, version, props_schema, default_config, icon, is_builtin, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		c.ID, c.TenantID, c.Name, c.DisplayName, c.Category, c.Version, c.PropsSchema,
		jsonArg(c.DefaultConfig), c.Icon, c.IsBuiltin, c.CreatedAt)
	return err
}

func (r *Repository) ListComponents(ctx context.Context, tenantID, category string) ([]models.ComponentRegistry, error) {
	args := []interface{}{tenantID}
	where := "tenant_id = $1"
	if category != "" {
		args = append(args, category)
		where += fmt.Sprintf(" AND category = $%d", len(args))
	}
	var items []models.ComponentRegistry
	err := r.db.SelectContext(ctx, &items,
		"SELECT "+componentColumns+" FROM component_registry WHERE "+where+" ORDER BY created_at DESC", args...)
	return items, err
}

// GetComponent takes the tenant for the same reason as GetTemplate: ListComponents
// on the same table filters by tenant, so a tenant-less lookup let any caller
// read any component by id.
func (r *Repository) GetComponent(ctx context.Context, id, tenantID string) (*models.ComponentRegistry, error) {
	var c models.ComponentRegistry
	err := r.db.GetContext(ctx, &c,
		"SELECT "+componentColumns+" FROM component_registry WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return &c, nil
}
