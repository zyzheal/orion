package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"orion/platform-svc-go/internal/permission/models"

	"github.com/jmoiron/sqlx"
)

var errNotFound = errors.New("permission not found")

// allowedColumns defines the whitelist of column names that can be used in dynamic SQL SET clauses.
var allowedColumns = map[string]bool{"name": true, "code": true, "resource": true, "action": true, "desc": true}

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

// Update modifies an existing permission, using a dynamic SET clause gated by the allowedColumns whitelist.
func (r *Repository) Update(ctx context.Context, p *models.Permission) error {
	setClauses := []string{}
	args := []interface{}{}
	idx := 1

	if p.Name != "" && allowedColumns["name"] {
		setClauses = append(setClauses, fmt.Sprintf("name=$%d", idx))
		args = append(args, p.Name)
		idx++
	}
	if p.Code != "" && allowedColumns["code"] {
		setClauses = append(setClauses, fmt.Sprintf("code=$%d", idx))
		args = append(args, p.Code)
		idx++
	}
	if p.Resource != "" && allowedColumns["resource"] {
		setClauses = append(setClauses, fmt.Sprintf("resource=$%d", idx))
		args = append(args, p.Resource)
		idx++
	}
	if p.Action != "" && allowedColumns["action"] {
		setClauses = append(setClauses, fmt.Sprintf("action=$%d", idx))
		args = append(args, p.Action)
		idx++
	}
	if p.Desc != "" && allowedColumns["desc"] {
		setClauses = append(setClauses, fmt.Sprintf("desc=$%d", idx))
		args = append(args, p.Desc)
		idx++
	}

	// Always include updated_at
	setClauses = append(setClauses, "updated_at=NOW()")
	args = append(args, p.ID, p.TenantID)

	query := fmt.Sprintf("UPDATE permissions SET %s WHERE id=$%d AND tenant_id=$%d",
		strings.Join(setClauses, ", "), idx, idx+1)

	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

// Delete removes a permission by id and tenant_id.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM permissions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}
