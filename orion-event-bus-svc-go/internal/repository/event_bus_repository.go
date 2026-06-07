package repository

import (
	"context"
	"orion/event-bus-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

// Repository provides data access for the Event Bus domain.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository instance.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---------- EventSubscription operations ----------

// Subscribe inserts a new event subscription for a tenant.
// The subscription is created as enabled by default.
func (r *Repository) Subscribe(ctx context.Context, tenantID, eventType, handler string) (*models.EventSubscription, error) {
	var sub models.EventSubscription
	err := r.db.QueryRowxContext(ctx,
		`INSERT INTO event_subscriptions (tenant_id, event_type, handler, enabled)
		 VALUES ($1, $2, $3, true)
		 RETURNING id, tenant_id, event_type, handler, enabled, created_at`,
		tenantID, eventType, handler,
	).StructScan(&sub)
	if err != nil {
		return nil, err
	}
	return &sub, nil
}

// Unsubscribe deletes an event subscription by ID and tenant.
func (r *Repository) Unsubscribe(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM event_subscriptions WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	if err != nil {
		return false, err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	return rows > 0, nil
}

// UpdateSubscriptionEnabled toggles the enabled state of a subscription.
func (r *Repository) UpdateSubscriptionEnabled(ctx context.Context, tenantID, id string, enabled bool) (*models.EventSubscription, error) {
	var sub models.EventSubscription
	err := r.db.QueryRowxContext(ctx,
		`UPDATE event_subscriptions SET enabled = $1
		 WHERE id = $2 AND tenant_id = $3
		 RETURNING id, tenant_id, event_type, handler, enabled, created_at`,
		enabled, id, tenantID,
	).StructScan(&sub)
	if err != nil {
		return nil, err
	}
	return &sub, nil
}

// GetSubscriptions returns all subscriptions for a tenant, optionally filtered by event type.
func (r *Repository) GetSubscriptions(ctx context.Context, tenantID string, eventType *string) ([]models.EventSubscription, error) {
	var subs []models.EventSubscription
	if eventType != nil && *eventType != "" {
		err := r.db.SelectContext(ctx, &subs,
			`SELECT id, tenant_id, event_type, handler, enabled, created_at
			 FROM event_subscriptions
			 WHERE tenant_id = $1 AND event_type = $2
			 ORDER BY created_at DESC`,
			tenantID, *eventType,
		)
		return subs, err
	}
	err := r.db.SelectContext(ctx, &subs,
		`SELECT id, tenant_id, event_type, handler, enabled, created_at
		 FROM event_subscriptions
		 WHERE tenant_id = $1
		 ORDER BY created_at DESC`,
		tenantID,
	)
	return subs, err
}

// GetSubscriptionByID returns a single subscription by ID and tenant.
func (r *Repository) GetSubscriptionByID(ctx context.Context, tenantID, id string) (*models.EventSubscription, error) {
	var sub models.EventSubscription
	err := r.db.GetContext(ctx, &sub,
		`SELECT id, tenant_id, event_type, handler, enabled, created_at
		 FROM event_subscriptions
		 WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &sub, nil
}

// CountSubscriptions returns the total number of subscriptions for a tenant.
func (r *Repository) CountSubscriptions(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM event_subscriptions WHERE tenant_id = $1`,
		tenantID,
	)
	return count, err
}

// ---------- EventLog operations ----------

// LogEvent inserts a new event log entry. The event is created with processed=false.
func (r *Repository) LogEvent(ctx context.Context, tenantID, eventType string, payload models.JSONB) (*models.EventLog, error) {
	var log models.EventLog
	err := r.db.QueryRowxContext(ctx,
		`INSERT INTO event_logs (tenant_id, event_type, payload, processed)
		 VALUES ($1, $2, $3, false)
		 RETURNING id, tenant_id, event_type, payload, processed, created_at`,
		tenantID, eventType, payload,
	).StructScan(&log)
	if err != nil {
		return nil, err
	}
	return &log, nil
}

// GetEventLogs returns event logs for a tenant, ordered by most recent first.
func (r *Repository) GetEventLogs(ctx context.Context, tenantID string, limit int) ([]models.EventLog, error) {
	var logs []models.EventLog
	err := r.db.SelectContext(ctx, &logs,
		`SELECT id, tenant_id, event_type, payload, processed, created_at
		 FROM event_logs
		 WHERE tenant_id = $1
		 ORDER BY created_at DESC
		 LIMIT $2`,
		tenantID, limit,
	)
	return logs, err
}

// GetEventLogByID returns a single event log by ID and tenant.
func (r *Repository) GetEventLogByID(ctx context.Context, tenantID, id string) (*models.EventLog, error) {
	var log models.EventLog
	err := r.db.GetContext(ctx, &log,
		`SELECT id, tenant_id, event_type, payload, processed, created_at
		 FROM event_logs
		 WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &log, nil
}

// MarkEventProcessed sets processed=true on an event log entry.
func (r *Repository) MarkEventProcessed(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE event_logs SET processed = true WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	return err
}
