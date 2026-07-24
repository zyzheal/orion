package repository

import (
	"context"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/google/uuid"
	"orion/platform-svc-go/internal/identity/apikey/models"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, m *models.ApiKey) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx, `INSERT INTO api_keys (id, tenant_id, name, created_at, updated_at) VALUES (:id, :tenant_id, :name, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.ApiKey, error) {
	var items []models.ApiKey
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM api_keys WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM api_keys WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}
