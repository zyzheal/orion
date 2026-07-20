package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/hook-chain/models"

	"github.com/jmoiron/sqlx"
)

var errNotFound = errors.New("hook not found")

// Repository provides PostgreSQL-backed persistence for hooks.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository instance.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new hook row.
func (r *Repository) Create(ctx context.Context, hook *models.Hook) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO hook_chains (
			id, name, description, trigger, action, config, enabled,
			tenant_id, user_id, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		hook.ID, hook.Name, hook.Description, hook.Trigger, hook.Action,
		hook.Config, hook.Enabled, hook.TenantID, hook.UserID,
		hook.CreatedAt, hook.UpdatedAt,
	)
	return err
}

// GetByID retrieves a single hook by id and tenant_id.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Hook, error) {
	var h models.Hook
	err := r.db.GetContext(ctx, &h,
		`SELECT * FROM hook_chains WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err == sql.ErrNoRows {
		return nil, errNotFound
	}
	if err != nil {
		return nil, err
	}
	return &h, nil
}

// List retrieves hooks for a tenant with optional filters and pagination.
func (r *Repository) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.Hook, error) {
	var items []models.Hook

	query := "SELECT * FROM hook_chains WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.Trigger != nil {
			query += fmt.Sprintf(" AND trigger=$%d", argIdx)
			args = append(args, *filter.Trigger)
			argIdx++
		}
		if filter.Enabled != nil {
			query += fmt.Sprintf(" AND enabled=$%d", argIdx)
			args = append(args, *filter.Enabled)
			argIdx++
		}
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC OFFSET $%d LIMIT $%d", argIdx, argIdx+1)
	args = append(args, offset, limit)

	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// Count returns the total number of hooks for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM hook_chains WHERE tenant_id=$1`, tenantID)
	if err == sql.ErrNoRows {
		return 0, nil
	}
	return count, err
}

// Update modifies an existing hook.
func (r *Repository) Update(ctx context.Context, hook *models.Hook) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE hook_chains SET
			name=$1, description=$2, trigger=$3, action=$4, config=$5, enabled=$6, updated_at=NOW()
		WHERE id=$7 AND tenant_id=$8`,
		hook.Name, hook.Description, hook.Trigger, hook.Action,
		hook.Config, hook.Enabled, hook.ID, hook.TenantID,
	)
	return err
}

// Delete removes a hook by id and tenant_id.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM hook_chains WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}
