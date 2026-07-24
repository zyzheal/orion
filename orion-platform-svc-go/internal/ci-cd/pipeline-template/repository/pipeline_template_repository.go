package repository

import (
	"context"
	"fmt"
	"strings"

	"orion/platform-svc-go/internal/ci-cd/pipeline-template/models"

	"github.com/jmoiron/sqlx"
)

// ---------------------------------------------------------------------------
// ListFilter – optional filters accepted by ListWithTotal.
// ---------------------------------------------------------------------------

type ListFilter struct {
	TenantID string
	Category string
	Tag      string
	IsPublic *bool
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---------------------------------------------------------------------------
// Create inserts a new pipeline_template row.
// SQL #1
// ---------------------------------------------------------------------------

func (r *Repository) Create(ctx context.Context, d *models.PipelineTemplate) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO pipeline_templates
			(id, tenant_id, name, description, category, yaml_content,
			 parameters, version, is_public, tags, usage_count, created_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		d.ID, d.TenantID, d.Name, d.Description, d.Category,
		d.YAMLContent, d.Parameters, d.Version, d.IsPublic,
		d.Tags, d.UsageCount, d.CreatedBy,
	)
	return err
}

// ---------------------------------------------------------------------------
// Update applies partial updates.  Only non-nil / non-empty fields are set.
// SQL #2
// ---------------------------------------------------------------------------

func (r *Repository) Update(ctx context.Context, tenantID, id string, req *models.UpdatePipelineTemplateRequest) error {
	clauses := []string{}
	args := []interface{}{}
	idx := 1

	if req.Name != nil {
		clauses = append(clauses, fmt.Sprintf("name=$%d", idx))
		args = append(args, *req.Name)
		idx++
	}
	if req.Description != nil {
		clauses = append(clauses, fmt.Sprintf("description=$%d", idx))
		args = append(args, *req.Description)
		idx++
	}
	if req.Category != nil {
		clauses = append(clauses, fmt.Sprintf("category=$%d", idx))
		args = append(args, *req.Category)
		idx++
	}
	if req.YAMLContent != nil {
		clauses = append(clauses, fmt.Sprintf("yaml_content=$%d", idx))
		args = append(args, *req.YAMLContent)
		idx++
		// Bump version when YAML changes.
		clauses = append(clauses, "version=version+1")
	}
	if req.Parameters != nil {
		clauses = append(clauses, fmt.Sprintf("parameters=$%d", idx))
		args = append(args, req.Parameters)
		idx++
	}
	if req.IsPublic != nil {
		clauses = append(clauses, fmt.Sprintf("is_public=$%d", idx))
		args = append(args, *req.IsPublic)
		idx++
	}
	if req.Tags != nil {
		clauses = append(clauses, fmt.Sprintf("tags=$%d", idx))
		args = append(args, req.Tags)
		idx++
	}

	if len(clauses) == 0 {
		return nil // nothing to update
	}

	clauses = append(clauses, "updated_at=NOW()")
	args = append(args, id, tenantID)

	query := fmt.Sprintf(
		"UPDATE pipeline_templates SET %s WHERE id=$%d AND tenant_id=$%d",
		strings.Join(clauses, ", "), idx, idx+1,
	)
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

// ---------------------------------------------------------------------------
// GetByID fetches a single template scoped to a tenant.
// SQL #3
// ---------------------------------------------------------------------------

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error) {
	var d models.PipelineTemplate
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM pipeline_templates WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// ---------------------------------------------------------------------------
// ListWithTotal returns a page of templates together with the total count.
// Two queries are executed: COUNT then SELECT.
// SQL #4 (count) + SQL #5 (select)
// ---------------------------------------------------------------------------

func (r *Repository) ListWithTotal(ctx context.Context, filter ListFilter, offset, limit int) ([]models.PipelineTemplate, int, error) {
	conditions := []string{}
	args := []interface{}{}
	idx := 1

	if filter.TenantID != "" {
		conditions = append(conditions, fmt.Sprintf("(tenant_id=$%d OR is_public=true)", idx))
		args = append(args, filter.TenantID)
		idx++
	}
	if filter.Category != "" {
		conditions = append(conditions, fmt.Sprintf("category=$%d", idx))
		args = append(args, filter.Category)
		idx++
	}
	if filter.Tag != "" {
		conditions = append(conditions, fmt.Sprintf("$%d = ANY(tags)", idx))
		args = append(args, filter.Tag)
		idx++
	}
	if filter.IsPublic != nil {
		conditions = append(conditions, fmt.Sprintf("is_public=$%d", idx))
		args = append(args, *filter.IsPublic)
		idx++
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	// Count query.
	var total int
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM pipeline_templates %s", where)
	if err := r.db.GetContext(ctx, &total, countSQL, args...); err != nil {
		return nil, 0, err
	}

	// Data query.
	dataArgs := append(args, limit, offset) //nolint:gocritic
	dataSQL := fmt.Sprintf(
		"SELECT * FROM pipeline_templates %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		where, idx, idx+1,
	)
	var items []models.PipelineTemplate
	if err := r.db.SelectContext(ctx, &items, dataSQL, dataArgs...); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// ---------------------------------------------------------------------------
// Delete removes a template by id scoped to a tenant.
// SQL #6
// ---------------------------------------------------------------------------

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM pipeline_templates WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ---------------------------------------------------------------------------
// Count returns the total number of templates for a tenant (including public).
// SQL #7
// ---------------------------------------------------------------------------

func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM pipeline_templates WHERE tenant_id=$1 OR is_public=true`, tenantID)
	return count, err
}

// ---------------------------------------------------------------------------
// FindByNameAndTenant – used during builtin-template seeding to avoid dupes.
// SQL #8
// ---------------------------------------------------------------------------

func (r *Repository) FindByNameAndTenant(ctx context.Context, tenantID, name string) (string, error) {
	var id string
	err := r.db.GetContext(ctx, &id,
		`SELECT id FROM pipeline_templates WHERE tenant_id=$1 AND name=$2`, tenantID, name)
	return id, err
}

// ---------------------------------------------------------------------------
// InsertPipeline – instantiates a template into the pipelines table.
// SQL #9
// ---------------------------------------------------------------------------

func (r *Repository) InsertPipeline(ctx context.Context, tenantID, projectID, name, createdBy, yamlDefinition string) (string, error) {
	var pipelineID string
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO pipelines (tenant_id, project_id, name, trigger_type, config, created_by)
		VALUES ($1, $2, $3, 'manual', $4, $5)
		RETURNING id`,
		tenantID, nullStr(projectID), name,
		fmt.Sprintf(`{"yamlDefinition":"%s","version":1}`, escapeJSON(yamlDefinition)),
		nullStr(createdBy),
	).Scan(&pipelineID)
	return pipelineID, err
}

// ---------------------------------------------------------------------------
// GetPipelineConfig – fetches a pipeline's config JSON for save-as-template.
// SQL #10
// ---------------------------------------------------------------------------

func (r *Repository) GetPipelineConfig(ctx context.Context, tenantID, pipelineID string) (models.JSONB, error) {
	var cfg models.JSONB
	err := r.db.GetContext(ctx, &cfg,
		`SELECT config FROM pipelines WHERE id=$1 AND tenant_id=$2`, pipelineID, tenantID)
	return cfg, err
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func nullStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

// escapeJSON minimally escapes a string for embedding inside a JSON literal.
func escapeJSON(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `"`, `\"`)
	s = strings.ReplaceAll(s, "\n", `\n`)
	s = strings.ReplaceAll(s, "\r", `\r`)
	s = strings.ReplaceAll(s, "\t", `\t`)
	return s
}
