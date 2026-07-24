package repository

import (
	"context"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/google/uuid"
	"orion/platform-svc-go/internal/infrastructure/oci-registry/models"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, m *models.OCIRegistry) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx, `INSERT INTO oci_registries (id, tenant_id, name, created_at, updated_at) VALUES (:id, :tenant_id, :name, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.OCIRegistry, error) {
	var m models.OCIRegistry
	err := r.db.GetContext(ctx, &m, `SELECT * FROM oci_registries WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return &m, err
}

func (r *Repository) List(ctx context.Context, tenantID string, limit, offset int) ([]models.OCIRegistry, error) {
	if limit <= 0 { limit = 50 }
	var items []models.OCIRegistry
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM oci_registries WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	return items, err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM oci_registries WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}
