package repository

import (
	"context"
	"orion/ai-svc-go/internal/intelligence/models"
	"github.com/jmoiron/sqlx"
)

type Repository struct { db *sqlx.DB }
func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, d *models.IntelligenceTask) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO insights (id, tenant_id, name, insight_type, source, confidence, data, status) VALUES ($1,$2,$3, $4, $5, $6, $7, $8)`, d.ID, d.TenantID, d.Name)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.IntelligenceTask, error) {
	var items []models.IntelligenceTask
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM intelligence_tasks WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.IntelligenceTask, error) {
	var d models.IntelligenceTask
	err := r.db.GetContext(ctx, &d, `SELECT * FROM intelligence_tasks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil { return nil, err }
	return &d, nil
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM insights WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM insights WHERE tenant_id=$1`, tenantID)
	return count, err
}
