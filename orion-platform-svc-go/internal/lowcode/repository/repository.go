package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/lowcode/models"

	"github.com/jmoiron/sqlx"
)

var (
	ErrFlowNotFound      = errors.New("lowcode flow not found")
	ErrTemplateNotFound  = errors.New("lowcode template not found")
	ErrInstanceNotFound  = errors.New("lowcode instance not found")
	ErrVersionNotFound   = errors.New("lowcode version not found")
)

// Repository provides PostgreSQL-backed persistence for the lowcode module.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository instance.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Lowcode Flows ---

// CreateFlow inserts a new flow row.
func (r *Repository) CreateFlow(ctx context.Context, flow *models.LowcodeFlow) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO lowcode_workflow_definition (
			id, tenant_id, name, description, version, nodes, edges, enabled,
			created_by, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		flow.ID, flow.TenantID, flow.Name, flow.Description, flow.Version,
		flow.Nodes, flow.Edges, flow.Enabled,
		flow.CreatedBy, flow.CreatedAt, flow.UpdatedAt,
	)
	return err
}

// GetFlowByID retrieves a flow by id and tenant_id.
func (r *Repository) GetFlowByID(ctx context.Context, tenantID, id string) (*models.LowcodeFlow, error) {
	var f models.LowcodeFlow
	err := r.db.GetContext(ctx, &f,
		`SELECT * FROM lowcode_workflow_definition WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err == sql.ErrNoRows {
		return nil, ErrFlowNotFound
	}
	if err != nil {
		return nil, err
	}
	return &f, nil
}

// ListFlows retrieves flows for a tenant with optional filters and pagination.
func (r *Repository) ListFlows(ctx context.Context, tenantID string, filter *models.ListFlowFilters, offset, limit int) ([]models.LowcodeFlow, error) {
	query := "SELECT * FROM lowcode_workflow_definition WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.Enabled != nil {
			query += fmt.Sprintf(" AND enabled=$%d", argIdx)
			args = append(args, *filter.Enabled)
			argIdx++
		}
		if filter.Search != nil {
			query += fmt.Sprintf(" AND (name ILIKE $%d OR description ILIKE $%d)", argIdx, argIdx+1)
			searchTerm := "%" + *filter.Search + "%"
			args = append(args, searchTerm, searchTerm)
			argIdx += 2
		}
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC OFFSET $%d LIMIT $%d", argIdx, argIdx+1)
	args = append(args, offset, limit)

	var items []models.LowcodeFlow
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// CountFlows returns total flows count for a tenant.
func (r *Repository) CountFlows(ctx context.Context, tenantID string, filter *models.ListFlowFilters) (int, error) {
	query := "SELECT COUNT(*) FROM lowcode_workflow_definition WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.Enabled != nil {
			query += fmt.Sprintf(" AND enabled=$%d", argIdx)
			args = append(args, *filter.Enabled)
			argIdx++
		}
		if filter.Search != nil {
			query += fmt.Sprintf(" AND (name ILIKE $%d OR description ILIKE $%d)", argIdx, argIdx+1)
			searchTerm := "%" + *filter.Search + "%"
			args = append(args, searchTerm, searchTerm)
			argIdx += 2
		}
	}

	var count int
	err := r.db.GetContext(ctx, &count, query, args...)
	return count, err
}

// UpdateFlow updates an existing flow.
func (r *Repository) UpdateFlow(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}
	fields := make([]string, 0, len(updates))
	args := []interface{}{id, tenantID}
	argIdx := 3

	for k, v := range updates {
		fields = append(fields, fmt.Sprintf("%s=$%d", k, argIdx))
		args = append(args, v)
		argIdx++
	}

	fields = append(fields, fmt.Sprintf("updated_at=NOW()"))
	// Build the SET clause
	setClause := ""
	for i, f := range fields {
		if i > 0 {
			setClause += ", "
		}
		setClause += f
	}
	query := fmt.Sprintf("UPDATE lowcode_workflow_definition SET %s WHERE id=$1 AND tenant_id=$2", setClause)

	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrFlowNotFound
	}
	return nil
}

// DeleteFlow removes a flow by id and tenant_id.
func (r *Repository) DeleteFlow(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM lowcode_workflow_definition WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrFlowNotFound
	}
	return nil
}

// --- Lowcode Instances ---

// CreateInstance inserts a new workflow instance.
func (r *Repository) CreateInstance(ctx context.Context, inst *models.LowcodeInstance) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO lowcode_workflow_instance (
			id, tenant_id, workflow_id, workflow_definition_id, status,
			variables, input, output, current_node_id, triggered_by,
			started_at, completed_at, created_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
		inst.ID, inst.TenantID, inst.WorkflowID, inst.WorkflowDefinitionID, inst.Status,
		inst.Variables, inst.Input, inst.Output, inst.CurrentNodeID, inst.TriggeredBy,
		inst.StartedAt, inst.CompletedAt, inst.CreatedAt,
	)
	return err
}

// GetInstanceByID retrieves an instance by id.
func (r *Repository) GetInstanceByID(ctx context.Context, tenantID, id string) (*models.LowcodeInstance, error) {
	var inst models.LowcodeInstance
	err := r.db.GetContext(ctx, &inst,
		`SELECT * FROM lowcode_workflow_instance WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err == sql.ErrNoRows {
		return nil, ErrInstanceNotFound
	}
	if err != nil {
		return nil, err
	}
	return &inst, nil
}

// --- Templates ---

// CreateTemplate inserts a new template.
func (r *Repository) CreateTemplate(ctx context.Context, tmpl *models.LowcodeTemplate) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO lowcode_templates (
			id, name, description, category, thumbnail, definition, tags,
			usage_count, created_by, created_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		tmpl.ID, tmpl.Name, tmpl.Description, tmpl.Category, tmpl.Thumbnail,
		tmpl.Definition, tmpl.Tags, tmpl.UsageCount, tmpl.CreatedBy, tmpl.CreatedAt,
	)
	return err
}

// GetTemplateByID retrieves a template by id.
func (r *Repository) GetTemplateByID(ctx context.Context, id string) (*models.LowcodeTemplate, error) {
	var t models.LowcodeTemplate
	err := r.db.GetContext(ctx, &t,
		`SELECT * FROM lowcode_templates WHERE id=$1`, id)
	if err == sql.ErrNoRows {
		return nil, ErrTemplateNotFound
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// ListTemplates retrieves all templates.
func (r *Repository) ListTemplates(ctx context.Context) ([]models.LowcodeTemplate, error) {
	var items []models.LowcodeTemplate
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM lowcode_templates ORDER BY created_at DESC`)
	return items, err
}

// IncrementTemplateUsage increments the usage count of a template.
func (r *Repository) IncrementTemplateUsage(ctx context.Context, id string) error {
	result, err := r.db.ExecContext(ctx,
		`UPDATE lowcode_templates SET usage_count = usage_count + 1 WHERE id=$1`, id)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrTemplateNotFound
	}
	return nil
}

// --- Version Snapshots ---

// CreateVersionSnapshot inserts a new version snapshot.
func (r *Repository) CreateVersionSnapshot(ctx context.Context, snap *models.VersionSnapshot) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO lowcode_workflow_version (
			id, workflow_id, version, definition, created_by, created_at
		) VALUES ($1,$2,$3,$4,$5,$6)`,
		snap.ID, snap.WorkflowID, snap.Version, snap.Definition,
		snap.CreatedBy, snap.CreatedAt,
	)
	return err
}

// ListVersionSnapshots retrieves version snapshots for a workflow.
func (r *Repository) ListVersionSnapshots(ctx context.Context, workflowID string) ([]models.VersionSnapshot, error) {
	var items []models.VersionSnapshot
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM lowcode_workflow_version WHERE workflow_id=$1 ORDER BY created_at DESC`, workflowID)
	return items, err
}