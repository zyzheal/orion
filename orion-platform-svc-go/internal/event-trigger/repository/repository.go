package repository

import (
	"context"
	"database/sql"
	"fmt"

	"orion/platform-svc-go/internal/event-trigger/models"

	"github.com/jmoiron/sqlx"
)

// Repository provides data access for event triggers.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new event trigger.
func (r *Repository) Create(ctx context.Context, t *models.EventTrigger) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO event_triggers
			(id, name, event_type, action, target, enabled, description, tenant_id, user_id, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())`,
		t.ID, t.Name, t.EventType, t.Action, t.Target, t.Enabled,
		t.Description, t.TenantID, t.UserID,
)
	return err
}

// GetByID returns a single trigger by id and tenant.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.EventTrigger, error) {
	var t models.EventTrigger
	err := r.db.GetContext(ctx, &t,
		`SELECT id, name, event_type, action, target, enabled, description,
		        tenant_id, user_id, created_at, updated_at
		 FROM event_triggers
		 WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// List returns paginated triggers for a tenant with optional filters.
func (r *Repository) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.EventTrigger, error) {
	query := `SELECT id, name, event_type, action, target, enabled, description,
		        tenant_id, user_id, created_at, updated_at
		     FROM event_triggers
		     WHERE tenant_id = $1`

	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.EventType != nil {
			query += fmt.Sprintf(" AND event_type = $%d", argIdx)
			args = append(args, *filter.EventType)
			argIdx++
		}
		if filter.Enabled != nil {
			query += fmt.Sprintf(" AND enabled = $%d", argIdx)
			args = append(args, *filter.Enabled)
			argIdx++
		}
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC OFFSET $%d LIMIT $%d", argIdx, argIdx+1)
	args = append(args, offset, limit)

	var items []models.EventTrigger
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// Count returns total trigger count for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM event_triggers WHERE tenant_id = $1`,
		tenantID,
)
	return count, err
}

// Update modifies all mutable fields of an existing trigger.
func (r *Repository) Update(ctx context.Context, t *models.EventTrigger) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE event_triggers
		 SET name = $1, event_type = $2, action = $3, target = $4,
		     enabled = $5, description = $6, updated_at = now()
		 WHERE id = $7 AND tenant_id = $8`,
		t.Name, t.EventType, t.Action, t.Target, t.Enabled,
		t.Description, t.ID, t.TenantID,
)
	return err
}

// Delete removes a trigger by id and tenant.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM event_triggers WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
)
	return err
}

// IsNotFound reports whether the given error is a sql.ErrNoRows.
func IsNotFound(err error) bool {
	return err == sql.ErrNoRows
}
