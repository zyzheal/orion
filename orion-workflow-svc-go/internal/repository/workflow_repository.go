package repository

import (
	"context"
	"orion/workflow-svc-go/internal/models"
	"github.com/jmoiron/sqlx"
)

type Repository struct { db *sqlx.DB }
func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, w *models.Workflow) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO workflows (id, tenant_id, name, description, steps, status) VALUES ($1,$2,$3,$4,$5,$6)`, w.ID, w.TenantID, w.Name, w.Description, w.Steps, w.Status)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Workflow, error) {
	var items []models.Workflow
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM workflows WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Workflow, error) {
	var w models.Workflow
	err := r.db.GetContext(ctx, &w, `SELECT * FROM workflows WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil { return nil, err }
	return &w, nil
}

func (r *Repository) CreateRun(ctx context.Context, run *models.WorkflowRun) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO workflow_runs (id, workflow_id, tenant_id, status, input, started_at) VALUES ($1,$2,$3,$4,$5,$6)`, run.ID, run.WorkflowID, run.TenantID, run.Status, run.Input, run.StartedAt)
	return err
}

func (r *Repository) GetRun(ctx context.Context, id string) (*models.WorkflowRun, error) {
	var run models.WorkflowRun
	err := r.db.GetContext(ctx, &run, `SELECT * FROM workflow_runs WHERE id=$1`, id)
	if err != nil { return nil, err }
	return &run, nil
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM workflows WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM workflows WHERE tenant_id=$1`, tenantID)
	return count, err
}
