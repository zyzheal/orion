package repository

import (
	"context"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/google/uuid"
	"orion/platform-svc-go/internal/infrastructure/maintenance-window/models"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, m *models.MaintenanceWindow) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx, `INSERT INTO maintenance_windows (id, tenant_id, name, created_at, updated_at) VALUES (:id, :tenant_id, :name, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.MaintenanceWindow, error) {
	var m models.MaintenanceWindow
	err := r.db.GetContext(ctx, &m, `SELECT * FROM maintenance_windows WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return &m, err
}

func (r *Repository) List(ctx context.Context, tenantID string, limit, offset int) ([]models.MaintenanceWindow, error) {
	if limit <= 0 { limit = 50 }
	var items []models.MaintenanceWindow
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM maintenance_windows WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	return items, err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM maintenance_windows WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}
