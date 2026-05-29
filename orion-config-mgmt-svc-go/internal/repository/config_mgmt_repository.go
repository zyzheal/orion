package repository

import (
	"context"
	"orion/config-mgmt-svc-go/internal/models"
	"github.com/jmoiron/sqlx"
)

type Repository struct { db *sqlx.DB }
func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, c *models.ConfigItem) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO config_items (id, tenant_id, key, value, environment, version) VALUES ($1,$2,$3,$4,$5,$6)`, c.ID, c.TenantID, c.Key, c.Value, c.Environment, c.Version)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.ConfigItem, error) {
	var items []models.ConfigItem
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM config_items WHERE tenant_id=$1 ORDER BY key OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.ConfigItem, error) {
	var c models.ConfigItem
	err := r.db.GetContext(ctx, &c, `SELECT * FROM config_items WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil { return nil, err }
	return &c, nil
}

func (r *Repository) Update(ctx context.Context, c *models.ConfigItem) error {
	_, err := r.db.ExecContext(ctx, `UPDATE config_items SET value=$1, version=version+1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, c.Value, c.ID, c.TenantID)
	return err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM config_items WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM config_items WHERE tenant_id=$1`, tenantID)
	return count, err
}
