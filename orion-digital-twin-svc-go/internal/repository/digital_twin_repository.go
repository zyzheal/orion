package repository

import (
	"context"
	"orion/digital-twin-svc-go/internal/models"
	"github.com/jmoiron/sqlx"
)

type Repository struct { db *sqlx.DB }
func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, d *models.DigitalTwin) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO digital_twins (id, tenant_id, name, entity_type, state, sync_interval, config) VALUES ($1,$2,$3, $4, $5, $6, $7)`, d.ID, d.TenantID, d.Name)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.DigitalTwin, error) {
	var items []models.DigitalTwin
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM digital_twins WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error) {
	var d models.DigitalTwin
	err := r.db.GetContext(ctx, &d, `SELECT * FROM digital_twins WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil { return nil, err }
	return &d, nil
}
