package repository

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/workflow-trigger/models"

	"github.com/jmoiron/sqlx"
)

// Repository provides PostgreSQL-backed persistence for workflow triggers.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository instance.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new workflow trigger row.
func (r *Repository) Create(ctx context.Context, t *models.WorkflowTrigger) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO workflow_triggers (
			id, tenant_id, workflow_id, name, type, config,
			webhook_secret, trigger_strategy, enabled, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		t.ID, t.TenantID, t.WorkflowID, t.Name, t.Type, t.Config,
		t.WebhookSecret, t.TriggerStrategy, t.Enabled, t.CreatedAt, t.UpdatedAt,
	)
	return err
}

// GetByID retrieves a single workflow trigger by id and tenant_id.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.WorkflowTrigger, error) {
	var t models.WorkflowTrigger
	err := r.db.GetContext(ctx, &t,
		`SELECT * FROM workflow_triggers WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// List retrieves workflow triggers for a tenant with optional filters and pagination.
func (r *Repository) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.WorkflowTrigger, error) {
	var items []models.WorkflowTrigger

	query := "SELECT * FROM workflow_triggers WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.WorkflowID != nil {
			query += fmt.Sprintf(" AND workflow_id=$%d", argIdx)
			args = append(args, *filter.WorkflowID)
			argIdx++
		}
		if filter.Type != nil {
			query += fmt.Sprintf(" AND type=$%d", argIdx)
			args = append(args, string(*filter.Type))
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

// Count returns the total number of workflow triggers for a tenant with optional filters.
func (r *Repository) Count(ctx context.Context, tenantID string, filter *models.ListFilter) (int, error) {
	query := "SELECT COUNT(*) FROM workflow_triggers WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.WorkflowID != nil {
			query += fmt.Sprintf(" AND workflow_id=$%d", argIdx)
			args = append(args, *filter.WorkflowID)
			argIdx++
		}
		if filter.Type != nil {
			query += fmt.Sprintf(" AND type=$%d", argIdx)
			args = append(args, string(*filter.Type))
			argIdx++
		}
		if filter.Enabled != nil {
			query += fmt.Sprintf(" AND enabled=$%d", argIdx)
			args = append(args, *filter.Enabled)
			argIdx++
		}
	}

	var count int
	err := r.db.GetContext(ctx, &count, query, args...)
	return count, err
}

// Update modifies an existing workflow trigger row.
func (r *Repository) Update(ctx context.Context, t *models.WorkflowTrigger) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE workflow_triggers SET
			workflow_id=$1, name=$2, type=$3, config=$4,
			webhook_secret=$5, trigger_strategy=$6, enabled=$7, updated_at=NOW()
		WHERE id=$8 AND tenant_id=$9`,
		t.WorkflowID, t.Name, t.Type, t.Config,
		t.WebhookSecret, t.TriggerStrategy, t.Enabled, t.ID, t.TenantID,
	)
	return err
}

// Delete removes a workflow trigger by id and tenant_id.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM workflow_triggers WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// SetEnabled updates the enabled status of a workflow trigger.
func (r *Repository) SetEnabled(ctx context.Context, tenantID, id string, enabled bool) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE workflow_triggers SET enabled=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		enabled, id, tenantID)
	return err
}