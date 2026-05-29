package repository

import (
	"context"
	"orion/event-bus-svc-go/internal/models"
	"github.com/jmoiron/sqlx"
)

type Repository struct { db *sqlx.DB }
func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, d *models.EventTopic) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO events (id, tenant_id, name, event_type, source, payload, status, retry_count) VALUES ($1,$2,$3, $4, $5, $6, $7, $8)`, d.ID, d.TenantID, d.Name)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.EventTopic, error) {
	var items []models.EventTopic
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM event_topics WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.EventTopic, error) {
	var d models.EventTopic
	err := r.db.GetContext(ctx, &d, `SELECT * FROM event_topics WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil { return nil, err }
	return &d, nil
}
