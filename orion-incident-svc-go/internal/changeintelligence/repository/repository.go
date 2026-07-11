package repository

import (
	"context"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/google/uuid"
	"orion/incident-svc-go/internal/changeintelligence/models"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, m *models.ChangeIntelligence) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx, `INSERT INTO change_intelligence (id, tenant_id, name, created_at, updated_at) VALUES (:id, :tenant_id, :name, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.ChangeIntelligence, error) {
	var items []models.ChangeIntelligence
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM change_intelligence WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM change_intelligence WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}
