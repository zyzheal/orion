package repository

import (
	"context"
	"orion/plugin-svc-go/internal/models"
	"github.com/jmoiron/sqlx"
)

type Repository struct { db *sqlx.DB }
func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, d *models.Plugin) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO plugins (id, tenant_id, name, description, version, author, enabled, config, entrypoint) VALUES ($1,$2,$3, $4, $5, $6, $7, $8, $9)`, d.ID, d.TenantID, d.Name)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Plugin, error) {
	var items []models.Plugin
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM plugins WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Plugin, error) {
	var d models.Plugin
	err := r.db.GetContext(ctx, &d, `SELECT * FROM plugins WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil { return nil, err }
	return &d, nil
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM plugins WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM plugins WHERE tenant_id=$1`, tenantID)
	return count, err
}
