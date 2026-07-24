package repository

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/environment/models"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, env *models.Environment) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO environments (id, tenant_id, name, description, project_id, status, locked, created_by, updated_by, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		env.ID, env.TenantID, env.Name, env.Description, env.ProjectID, env.Status, env.Locked, env.CreatedBy, env.UpdatedBy, env.CreatedAt, env.UpdatedAt)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Environment, error) {
	var env models.Environment
	err := r.db.GetContext(ctx, &env,
		`SELECT * FROM environments WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &env, nil
}

func (r *Repository) List(ctx context.Context, tenantID, projectID string) ([]models.Environment, error) {
	var items []models.Environment
	if projectID != "" {
		err := r.db.SelectContext(ctx, &items,
			`SELECT * FROM environments WHERE tenant_id=$1 AND project_id=$2 ORDER BY created_at DESC`, tenantID, projectID)
		return items, err
	}
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM environments WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) Update(ctx context.Context, env *models.Environment) error {
	query := `UPDATE environments SET name=$1, description=$2, status=$3, updated_by=$4, updated_at=NOW() WHERE id=$5 AND tenant_id=$6`
	_, err := r.db.ExecContext(ctx, query, env.Name, env.Description, env.Status, env.UpdatedBy, env.ID, env.TenantID)
	return err
}

func (r *Repository) UpdateStatus(ctx context.Context, tenantID, id, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE environments SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, status, id, tenantID)
	return err
}

func (r *Repository) SetLock(ctx context.Context, tenantID, id string, locked bool) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE environments SET locked=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, locked, id, tenantID)
	return err
}

func (r *Repository) GetLockStatus(ctx context.Context, tenantID, id string) (bool, error) {
	var locked bool
	err := r.db.GetContext(ctx, &locked,
		`SELECT locked FROM environments WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return locked, err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM environments WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) CheckDeploymentAllowed(ctx context.Context, tenantID, id string) (bool, error) {
	var env models.Environment
	err := r.db.GetContext(ctx, &env,
		`SELECT id, status, locked FROM environments WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, fmt.Errorf("environment not found")
	}
	if env.Locked {
		return false, nil
	}
	return true, nil
}