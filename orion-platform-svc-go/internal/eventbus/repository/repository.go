package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/eventbus/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

// sentinel.NotFound is returned when a query matches no rows.

// Repository provides PostgreSQL-backed storage for events.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new event repository backed by the given database.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new event into the database.
func (r *Repository) Create(ctx context.Context, event *models.Event) error {
	event.ID = uuid.New().String()
	event.CreatedAt = time.Now().UTC()
	if event.OccurredAt.IsZero() {
		event.OccurredAt = event.CreatedAt
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO events (id, type, payload, source, tenant_id, user_id, correlation_id, causation_id, occurred_at, created_at)
			 VALUES (:id, :type, :payload, :source, :tenantId, :userId, :correlationId, :causationId, :occurredAt, :createdAt)`,
		event)
	return err
}

// List retrieves events for a tenant, applying an optional filter with pagination.
// offset and limit control pagination; limit must be > 0.
func (r *Repository) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.Event, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil && filter.Type != nil && *filter.Type != "" {
		where += fmt.Sprintf(" AND type = $%d", argIdx)
		args = append(args, *filter.Type)
		argIdx++
	}

	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	var events []models.Event
	err := r.db.SelectContext(ctx, &events,
		fmt.Sprintf(`SELECT * FROM events %s ORDER BY occurred_at DESC LIMIT $%d OFFSET $%d`,
			where, argIdx, argIdx+1),
		append(args, limit, offset)...)
	return events, err
}

// Count returns the total number of events for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM events WHERE tenant_id=$1`, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, nil
		}
		return 0, err
	}
	return count, nil
}
