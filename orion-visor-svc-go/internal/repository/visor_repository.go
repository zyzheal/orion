package repository

import (
	"context"
	"orion/visor-svc-go/internal/models"
	"github.com/jmoiron/sqlx"
)

type Repository struct { db *sqlx.DB }
func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, d *models.Dashboard) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO dashboards (id, tenant_id, name, dashboard_type, config, layout, shared) VALUES ($1,$2,$3, $4, $5, $6, $7)`, d.ID, d.TenantID, d.Name)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Dashboard, error) {
	var items []models.Dashboard
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM dashboards WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Dashboard, error) {
	var d models.Dashboard
	err := r.db.GetContext(ctx, &d, `SELECT * FROM dashboards WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil { return nil, err }
	return &d, nil
}
