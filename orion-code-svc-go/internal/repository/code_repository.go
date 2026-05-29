package repository

import (
	"context"
	"orion/code-svc-go/internal/models"
	"github.com/jmoiron/sqlx"
)

type Repository struct { db *sqlx.DB }
func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, d *models.CodeRepository) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO codes (id, tenant_id, name, repo_url, branch, commit_hash, language, lines_of_code, metadata) VALUES ($1,$2,$3, $4, $5, $6, $7, $8, $9)`, d.ID, d.TenantID, d.Name)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.CodeRepository, error) {
	var items []models.CodeRepository
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM code_repositories WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.CodeRepository, error) {
	var d models.CodeRepository
	err := r.db.GetContext(ctx, &d, `SELECT * FROM code_repositories WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil { return nil, err }
	return &d, nil
}
