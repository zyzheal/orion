package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/pipeline-template/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateTemplate(ctx context.Context, template *models.PipelineTemplate) error {
	template.ID = uuid.New().String()
	template.CreatedAt = time.Now().UTC()
	template.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO pipeline_templates
			(id, tenant_id, name, description, yaml_definition, tags, category, version, created_by, created_at, updated_at)
			VALUES
			(:id, :tenantId, :name, :description, :yamlDefinition, :tags, :category, :version, :createdBy, :createdAt, :updatedAt)`,
		template)
	return err
}

func (r *Repository) GetTemplateByID(ctx context.Context, id string, tenantID string) (*models.PipelineTemplate, error) {
	var t models.PipelineTemplate
	err := r.db.GetContext(ctx, &t,
		`SELECT * FROM pipeline_templates WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) ListTemplates(ctx context.Context, tenantID string) ([]models.PipelineTemplate, error) {
	var templates []models.PipelineTemplate
	err := r.db.SelectContext(ctx, &templates,
		`SELECT * FROM pipeline_templates WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return templates, err
}

func (r *Repository) UpdateTemplate(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.PipelineTemplate, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}
	updates["updated_at"] = time.Now().UTC()
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		// Skip keys that do not exist in pipeline_templates table
		if key == "source_id" {
			continue
		}
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE pipeline_templates SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetTemplateByID(ctx, id, tenantID)
}

func (r *Repository) DeleteTemplate(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM pipeline_templates WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// CreatePipelineFromTemplate records a pipeline instance created from a template.
func (r *Repository) CreatePipelineFromTemplate(ctx context.Context, tenantID string, templateID string, name string) (*models.InstantiatedPipeline, error) {
	inst := &models.InstantiatedPipeline{
		ID:       uuid.New().String(),
		Name:     name,
		Status:   "draft",
		SourceID: templateID,
	}
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO pipelines (id, tenant_id, name, status, source_template_id, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		inst.ID, tenantID, name, "draft", templateID, now, now)
	if err != nil {
		return nil, err
	}
	return inst, nil
}

// CountTemplates returns the count of templates for a tenant.
func (r *Repository) CountTemplates(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM pipeline_templates WHERE tenant_id=$1`, tenantID)
	return count, err
}
