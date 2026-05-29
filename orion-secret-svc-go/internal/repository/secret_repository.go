package repository

import (
	"context"
	"orion/secret-svc-go/internal/models"
	"github.com/jmoiron/sqlx"
)

type Repository struct { db *sqlx.DB }
func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, s *models.Secret) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO secrets (id, tenant_id, name, value_encrypted, version, environment) VALUES ($1,$2,$3,$4,$5,$6)`, s.ID, s.TenantID, s.Name, s.Value, s.Version, s.Env)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Secret, error) {
	var items []models.Secret
	err := r.db.SelectContext(ctx, &items, `SELECT id, tenant_id, name, version, environment, created_at, updated_at FROM secrets WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Secret, error) {
	var s models.Secret
	err := r.db.GetContext(ctx, &s, `SELECT * FROM secrets WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil { return nil, err }
	return &s, nil
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM secrets WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM secrets WHERE tenant_id=$1`, tenantID)
	return count, err
}
