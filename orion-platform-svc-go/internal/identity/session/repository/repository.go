package repository

import (
	"context"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/google/uuid"
	"orion/platform-svc-go/internal/identity/session/models"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, m *models.Session) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx, `INSERT INTO sessions (id, tenant_id, name, created_at, updated_at) VALUES (:id, :tenant_id, :name, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.Session, error) {
	var items []models.Session
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM sessions WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM sessions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}
