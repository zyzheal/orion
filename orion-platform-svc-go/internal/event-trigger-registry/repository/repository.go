package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"orion/platform-svc-go/internal/event-trigger-registry/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("trigger not found")

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
			id, name, type, workflow_id, event_type, event_filter, cron_expression, enabled, created_at
		) VALUES (
			:id, :name, :type, :workflow_id, :event_type, :event_filter, :cron_expression, :enabled, :created_at
		)`, m)
	return err
}

// GetByID retrieves a trigger by its ID.
func (r *Repository) GetByID(ctx context.Context, id string) (*models.WorkflowTrigger, error) {
	var m models.WorkflowTrigger
	err := r.db.GetContext(ctx, &m, "SELECT * FROM workflow_triggers WHERE id = $1", id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &m, nil
}

// FindByType returns all triggers of the given type (e.g. "event", "cron").
func (r *Repository) FindByType(ctx context.Context, typ string) ([]models.WorkflowTrigger, error) {
	var items []models.WorkflowTrigger
	err := r.db.SelectContext(ctx, &items, "SELECT * FROM workflow_triggers WHERE type = $1", typ)
	return items, err
}

// FindByEventType returns all triggers matching the given event type.
func (r *Repository) FindByEventType(ctx context.Context, eventType string) ([]models.WorkflowTrigger, error) {
	var items []models.WorkflowTrigger
	err := r.db.SelectContext(ctx, &items, "SELECT * FROM workflow_triggers WHERE event_type = $1", eventType)
	return items, err
}

// FindAll returns all triggers.
func (r *Repository) FindAll(ctx context.Context) ([]models.WorkflowTrigger, int, error) {
	var items []models.WorkflowTrigger
	err := r.db.SelectContext(ctx, &items, "SELECT * FROM workflow_triggers")
	if err != nil {
		return nil, 0, err
	}
	total := len(items)
	return items, total, nil
}

// Update replaces a trigger by ID.
func (r *Repository) Update(ctx context.Context, m *models.WorkflowTrigger) error {
	_, err := r.db.NamedExecContext(ctx, `
		UPDATE workflow_triggers SET
			name = :name, type = :type, workflow_id = :workflow_id, event_type = :event_type,
			event_filter = :event_filter, cron_expression = :cron_expression, enabled = :enabled
		WHERE id = :id`, m)
	return err
}

// Delete removes a trigger by ID.
func (r *Repository) Delete(ctx context.Context, id string) error {
	result, err := r.db.ExecContext(ctx, "DELETE FROM workflow_triggers WHERE id = $1", id)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}
