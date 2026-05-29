package repository

import (
	"context"
	"orion/artifact-svc-go/internal/models"
	"github.com/jmoiron/sqlx"
)

type Repository struct { db *sqlx.DB }
func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, d *models.Artifact) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO artifacts (id, tenant_id, name, description, type, version, repo_url, size_bytes, metadata) VALUES ($1,$2,$3, $4, $5, $6, $7, $8, $9)`, d.ID, d.TenantID, d.Name)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Artifact, error) {
	var items []models.Artifact
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM artifacts WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Artifact, error) {
	var d models.Artifact
	err := r.db.GetContext(ctx, &d, `SELECT * FROM artifacts WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil { return nil, err }
	return &d, nil
}
