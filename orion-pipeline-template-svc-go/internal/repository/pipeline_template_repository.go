package repository

import (
	"context"
	"orion/pipeline-template-svc-go/internal/models"
	"github.com/jmoiron/sqlx"
)

type Repository struct { db *sqlx.DB }
func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, d *models.PipelineTemplate) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO pipeline_templates (id, tenant_id, name, description, yaml_content, version, tags) VALUES ($1,$2,$3, $4, $5, $6, $7)`, d.ID, d.TenantID, d.Name)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.PipelineTemplate, error) {
	var items []models.PipelineTemplate
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM pipeline_templates WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.PipelineTemplate, error) {
	var d models.PipelineTemplate
	err := r.db.GetContext(ctx, &d, `SELECT * FROM pipeline_templates WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil { return nil, err }
	return &d, nil
}
