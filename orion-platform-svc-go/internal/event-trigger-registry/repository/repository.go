package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"orion/platform-svc-go/internal/event-trigger-registry/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository provides PostgreSQL access for workflow triggers.
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func nowUnix() *int64 {
	t := time.Now().Unix()
	return &t
}

// Create inserts a new workflow trigger.
func (r *Repository) Create(ctx context.Context, m *models.WorkflowTrigger) error {
	m.ID = uuid.New().String()
	m.CreatedAt = nowUnix()
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO workflow_triggers (
			id, tenant_id, name, type, workflow_id, event_type, event_filter, cron_expression, enabled, created_at
		) VALUES (
			:id, :tenant_id, :name, :type, :workflow_id, :event_type, :event_filter, :cron_expression, :enabled, :created_at
		)`, m)
	return err
}

// GetByID retrieves a trigger by its ID and tenant.
func (r *Repository) GetByID(ctx context.Context, id, tenantID string) (*models.WorkflowTrigger, error) {
	var m models.WorkflowTrigger
	err := r.db.GetContext(ctx, &m, "SELECT * FROM workflow_triggers WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &m, nil
}

// FindByType returns all triggers of the given type for the tenant.
func (r *Repository) FindByType(ctx context.Context, typ, tenantID string) ([]models.WorkflowTrigger, error) {
	var items []models.WorkflowTrigger
	err := r.db.SelectContext(ctx, &items, "SELECT * FROM workflow_triggers WHERE type = $1 AND tenant_id = $2", typ, tenantID)
	return items, err
}

// FindByEventType returns all triggers matching the given event type for the tenant.
func (r *Repository) FindByEventType(ctx context.Context, eventType, tenantID string) ([]models.WorkflowTrigger, error) {
	var items []models.WorkflowTrigger
	err := r.db.SelectContext(ctx, &items, "SELECT * FROM workflow_triggers WHERE event_type = $1 AND tenant_id = $2", eventType, tenantID)
	return items, err
}

// FindAll returns all triggers for the tenant.
func (r *Repository) FindAll(ctx context.Context, tenantID string) ([]models.WorkflowTrigger, int, error) {
	var items []models.WorkflowTrigger
	err := r.db.SelectContext(ctx, &items, "SELECT * FROM workflow_triggers WHERE tenant_id = $1", tenantID)
	if err != nil {
		return nil, 0, err
	}
	total := len(items)
	return items, total, nil
}

// Update replaces a trigger by ID within the tenant.
func (r *Repository) Update(ctx context.Context, m *models.WorkflowTrigger) error {
	_, err := r.db.NamedExecContext(ctx, `
		UPDATE workflow_triggers SET
			name = :name, type = :type, workflow_id = :workflow_id, event_type = :event_type,
			event_filter = :event_filter, cron_expression = :cron_expression, enabled = :enabled
		WHERE id = :id AND tenant_id = :tenant_id`, m)
	return err
}

// Delete removes a trigger by ID within the tenant.
func (r *Repository) Delete(ctx context.Context, id, tenantID string) error {
	result, err := r.db.ExecContext(ctx, "DELETE FROM workflow_triggers WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return sentinel.NotFound
	}
	return nil
}
