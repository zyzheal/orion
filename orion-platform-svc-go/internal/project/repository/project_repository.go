package repository

import (
	"context"

	"orion/platform-svc-go/internal/project/models"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, p *models.Project) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO projects (id, tenant_id, name, description, created_by, updated_by, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		p.ID, p.TenantID, p.Name, p.Description, p.CreatedBy, p.UpdatedBy, p.CreatedAt, p.UpdatedAt)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Project, error) {
	var p models.Project
	err := r.db.GetContext(ctx, &p, `SELECT * FROM projects WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.Project, error) {
	var items []models.Project
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM projects WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) Update(ctx context.Context, p *models.Project) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE projects SET name=$1, description=$2, updated_by=$3, updated_at=NOW()
		WHERE id=$4 AND tenant_id=$5`,
		p.Name, p.Description, p.UpdatedBy, p.ID, p.TenantID)
	return err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM projects WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}
