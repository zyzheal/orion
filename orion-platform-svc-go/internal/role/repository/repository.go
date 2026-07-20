package repository

import (
	"context"
	"database/sql"
	"errors"

	"orion/platform-svc-go/internal/role/models"

	"github.com/jmoiron/sqlx"
)

// Repository provides PostgreSQL-backed persistence for roles.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository instance.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new role row.
// SQL Call #1
func (r *Repository) Create(ctx context.Context, role *models.Role) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO roles (
			id, tenant_id, name, description, permissions, status, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		role.ID, role.TenantID, role.Name, role.Description, role.Permissions, role.Status, role.CreatedAt, role.UpdatedAt,
	)
	return err
}

// GetByID retrieves a single role by id and tenant_id.
// SQL Call #2
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Role, error) {
	var role models.Role
	err := r.db.GetContext(ctx, &role,
		`SELECT * FROM roles WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, MapSQLNoRows(err)
	}
	return &role, nil
}

// List retrieves roles for a tenant with optional status filter and pagination.
// SQL Call #3
func (r *Repository) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.Role, error) {
	var items []models.Role

	var query string
	var args []interface{}

	hasStatus := filter != nil && filter.Status != nil
	if hasStatus {
		query = "SELECT * FROM roles WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4"
		args = []interface{}{tenantID, string(*filter.Status), limit, offset}
	} else {
		query = "SELECT * FROM roles WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
		args = []interface{}{tenantID, limit, offset}
	}

	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// Update modifies an existing role row (name, description, status).
// SQL Call #4
func (r *Repository) Update(ctx context.Context, role *models.Role) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE roles SET
			name=$1, description=$2, status=$3, updated_at=NOW()
		WHERE id=$4 AND tenant_id=$5`,
		role.Name, role.Description, role.Status, role.ID, role.TenantID,
	)
	return err
}

// UpdatePermissions replaces the permissions for a role.
// SQL Call #5
func (r *Repository) UpdatePermissions(ctx context.Context, tenantID, id string, permissions models.Permissions) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE roles SET
			permissions=$1, updated_at=NOW()
		WHERE id=$2 AND tenant_id=$3`,
		permissions, id, tenantID,
	)
	return err
}

// Delete removes a role by id and tenant_id.
// SQL Call #6
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM roles WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// Count returns the total number of roles for a tenant.
// SQL Call #7
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM roles WHERE tenant_id=$1`, tenantID)
	return count, err
}

// RoleNotFoundError indicates that a role does not exist.
func RoleNotFoundError() error {
	return errors.New("role not found")
}

// MapSQLNoRows converts sql.ErrNoRows to RoleNotFoundError.
func MapSQLNoRows(err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return RoleNotFoundError()
	}
	return err
}
