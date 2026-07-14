package repository

import (
	"context"
	"database/sql"
	"fmt"

	"orion/platform-svc-go/internal/workflow-webhook/models"

	"github.com/jmoiron/sqlx"
)

// Repository provides data access for workflow webhook triggers.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// FindByWebhookPath returns a trigger by its unique webhook path.
func (r *Repository) FindByWebhookPath(ctx context.Context, webhookPath string) (*models.WebhookTrigger, error) {
	var t models.WebhookTrigger
	err := r.db.GetContext(ctx, &t,
		`SELECT id, tenant_id, workflow_id, name, webhook_path, webhook_secret,
		        trigger_strategy, enabled, created_at, updated_at
		 FROM workflow_webhook_triggers
		 WHERE webhook_path = $1`,
		webhookPath,
	)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// Create inserts a new webhook trigger.
func (r *Repository) Create(ctx context.Context, t *models.WebhookTrigger) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO workflow_webhook_triggers
			(id, tenant_id, workflow_id, name, webhook_path, webhook_secret,
			 trigger_strategy, enabled, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),now())`,
		t.ID, t.TenantID, t.WorkflowID, t.Name, t.WebhookPath, t.WebhookSecret,
		t.TriggerStrategy, t.Enabled,
	)
	return err
}

// GetByID returns a single trigger by id and tenant.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.WebhookTrigger, error) {
	var t models.WebhookTrigger
	err := r.db.GetContext(ctx, &t,
		`SELECT id, tenant_id, workflow_id, name, webhook_path, webhook_secret,
		        trigger_strategy, enabled, created_at, updated_at
		 FROM workflow_webhook_triggers
		 WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// List returns paginated triggers for a tenant with optional filters.
func (r *Repository) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.WebhookTrigger, error) {
	query := `SELECT id, tenant_id, workflow_id, name, webhook_path, webhook_secret,
	                 trigger_strategy, enabled, created_at, updated_at
	          FROM workflow_webhook_triggers
	          WHERE tenant_id = $1`

	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.WebhookPath != nil {
			query += fmt.Sprintf(" AND webhook_path = $%d", argIdx)
			args = append(args, *filter.WebhookPath)
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

	var items []models.WebhookTrigger
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// Count returns total trigger count for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM workflow_webhook_triggers WHERE tenant_id = $1`,
		tenantID,
	)
	return count, err
}

// Update modifies all mutable fields of an existing trigger.
func (r *Repository) Update(ctx context.Context, t *models.WebhookTrigger) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE workflow_webhook_triggers
		 SET name = $1, workflow_id = $2, webhook_path = $3, webhook_secret = $4,
		     trigger_strategy = $5, enabled = $6, updated_at = now()
		 WHERE id = $7 AND tenant_id = $8`,
		t.Name, t.WorkflowID, t.WebhookPath, t.WebhookSecret,
		t.TriggerStrategy, t.Enabled, t.ID, t.TenantID,
	)
	return err
}

// Delete removes a trigger by id and tenant.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM workflow_webhook_triggers WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	return err
}

// CreateLog inserts a new webhook trigger log entry.
func (r *Repository) CreateLog(ctx context.Context, log *models.WebhookTriggerLog) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO workflow_webhook_trigger_logs
			(id, trigger_id, event_type, event_payload, status, error_message, duration_ms, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,now())`,
		log.ID, log.TriggerID, log.EventType, log.EventPayload,
		log.Status, log.ErrorMessage, log.DurationMs,
	)
	return err
}

// UpdateLogStatus updates the status, error_message, and duration of a trigger log.
func (r *Repository) UpdateLogStatus(ctx context.Context, id, status, errorMessage string, durationMs int) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE workflow_webhook_trigger_logs
		 SET status = $1, error_message = $2, duration_ms = $3
		 WHERE id = $4`,
		status, errorMessage, durationMs, id,
	)
	return err
}

// ListLogs returns paginated trigger logs for a given trigger ID.
func (r *Repository) ListLogs(ctx context.Context, triggerID string, offset, limit int) ([]models.WebhookTriggerLog, error) {
	var items []models.WebhookTriggerLog
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, trigger_id, event_type, event_payload, status,
		        error_message, duration_ms, created_at
		 FROM workflow_webhook_trigger_logs
		 WHERE trigger_id = $1
		 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		triggerID, offset, limit,
	)
	return items, err
}

// IsNotFound reports whether the given error is a sql.ErrNoRows.
func IsNotFound(err error) bool {
	return err == sql.ErrNoRows
}