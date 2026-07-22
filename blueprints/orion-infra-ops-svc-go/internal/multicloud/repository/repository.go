package repository

import (
	"context"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/google/uuid"
	"orion/infra-ops-svc-go/internal/multicloud/models"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, m *models.MultiCloud) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx, `INSERT INTO multicloud_providers (id, tenant_id, name, created_at, updated_at) VALUES (:id, :tenant_id, :name, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.MultiCloud, error) {
	var m models.MultiCloud
	err := r.db.GetContext(ctx, &m, `SELECT * FROM multicloud_providers WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return &m, err
}

func (r *Repository) List(ctx context.Context, tenantID string, limit, offset int) ([]models.MultiCloud, error) {
	if limit <= 0 { limit = 50 }
	var items []models.MultiCloud
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM multicloud_providers WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	return items, err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM multicloud_providers WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}
