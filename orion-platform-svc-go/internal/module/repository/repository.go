package repository

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/module/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, m *models.Module) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = m.CreatedAt
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO module (id, name, display_name, description, version, enabled, status,
		                dependencies, startup_order, core, created_at, updated_at)
		VALUES (:id, :name, :display_name, :description, :version, :enabled, :status,
		        :dependencies, :startup_order, :core, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Module, error) {
	var m models.Module
	err := r.db.GetContext(ctx, &m, `SELECT * FROM module WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.Module, error) {
	var items []models.Module
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM module WHERE tenant_id = $1 ORDER BY startup_order`, tenantID)
	return items, err
}

func (r *Repository) UpdateStatus(ctx context.Context, tenantID, id string, enabled bool, status string) (*models.Module, error) {
	_, err := r.db.NamedExecContext(ctx, `
		UPDATE module SET enabled = :enabled, status = :status, updated_at = :updated_at
		WHERE id = :id AND tenant_id = :tenant_id`,
		map[string]interface{}{
			"enabled":    enabled,
			"status":     status,
			"updated_at": time.Now().UTC(),
			"id":         id,
			"tenant_id":  tenantID,
		})
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM module WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}
