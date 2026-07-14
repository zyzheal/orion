package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/permission/models"

	"github.com/jmoiron/sqlx"
)

var errNotFound = errors.New("permission not found")

// Repository provides PostgreSQL-backed persistence for permissions.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository instance.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new permission row.
func (r *Repository) Create(ctx context.Context, p *models.Permission) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO permissions (
			id, name, code, resource, action, desc,
			tenant_id, user_id, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		p.ID, p.Name, p.Code, p.Resource, p.Action,
		p.Desc, p.TenantID, p.UserID, p.CreatedAt, p.UpdatedAt,
)
	return err
}

// GetByID retrieves a single permission by id and tenant_id.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Permission, error) {
	var p models.Permission
	err := r.db.GetContext(ctx, &p,
		`SELECT * FROM permissions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err == sql.ErrNoRows {
		return nil, errNotFound
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// List retrieves permissions for a tenant with optional filters and pagination.
func (r *Repository) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.Permission, error) {
	var items []models.Permission

	query := "SELECT * FROM permissions WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.Resource != nil {
			query += fmt.Sprintf(" AND resource=$%d", argIdx)
			args = append(args, *filter.Resource)
			argIdx++
		}
		if filter.Action != nil {
			query += fmt.Sprintf(" AND action=$%d", argIdx)
			args = append(args, *filter.Action)
			argIdx++
		}
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC OFFSET $%d LIMIT $%d", argIdx, argIdx+1)
	args = append(args, offset, limit)

	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// Count returns the total number of permissions for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM permissions WHERE tenant_id=$1`, tenantID)
	if err == sql.ErrNoRows {
		return 0, nil
	}
	return count, err
}

// Update modifies an existing permission.
func (r *Repository) Update(ctx context.Context, p *models.Permission) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE permissions SET
			name=$1, code=$2, resource=$3, action=$4, desc=$5, updated_at=NOW()
		WHERE id=$6 AND tenant_id=$7`,
		p.Name, p.Code, p.Resource, p.Action, p.Desc,
		p.ID, p.TenantID,
)
	return err
}

// Delete removes a permission by id and tenant_id.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM permissions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}
