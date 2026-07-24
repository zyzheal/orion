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

// LogEvent inserts a new event log entry with CloudEvents envelope fields.
// The event is created with status=pending_published and published_at=NOW().
func (r *Repository) LogEvent(ctx context.Context, tenantID, eventType, subject, source, publishedBy string, payload models.JSONB) (*models.EventLog, error) {
	var log models.EventLog
	err := r.db.QueryRowxContext(ctx,
		`INSERT INTO event_logs (tenant_id, event_type, subject, source, payload, sequence_num, status, published_by, published_at, processed)
		 VALUES ($1, $2, $3, $4, $5, nextval('event_bus_seq'), $6, $7, NOW(), false)
		 RETURNING id, tenant_id, event_type, subject, source, payload, sequence_num, status, published_by, published_at, processed, created_at`,
		tenantID, eventType, subject, source, payload, models.EventStatusPendingPublished, publishedBy,
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
		`SELECT id, tenant_id, event_type, subject, source, payload, sequence_num, status, published_by, published_at, retry_count, last_retry_at, processed, created_at
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
		`SELECT id, tenant_id, event_type, subject, source, payload, sequence_num, status, published_by, published_at, retry_count, last_retry_at, processed, created_at
		 FROM event_logs
		 WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &log, nil
}

// UpdateEventStatus updates the delivery status of an event log entry.
func (r *Repository) UpdateEventStatus(ctx context.Context, id string, status models.EventStatus) (*models.EventLog, error) {
	var log models.EventLog
	err := r.db.QueryRowxContext(ctx,
		`UPDATE event_logs SET status = $1 WHERE id = $2
		 RETURNING id, tenant_id, event_type, subject, source, payload, sequence_num, status, published_by, published_at, retry_count, last_retry_at, processed, created_at`,
		status, id,
	).StructScan(&log)
	if err != nil {
		return nil, err
	}
	return &log, nil
}

// FindPendingFallbackEvents returns events that need retry (pending_fallback or pending_published).
// Ordered by age, filtered by max retry count. Aligned with TS EventBusEventRepository.
func (r *Repository) FindPendingFallbackEvents(ctx context.Context, limit int, maxRetryCount int) ([]models.EventLog, error) {
	var logs []models.EventLog
	err := r.db.SelectContext(ctx, &logs,
		`SELECT id, tenant_id, event_type, subject, source, payload, sequence_num, status, published_by, published_at, retry_count, last_retry_at, processed, created_at
		 FROM event_logs
		 WHERE status IN ('pending_fallback', 'pending_published') AND retry_count < $1
		 ORDER BY published_at ASC
		 LIMIT $2`,
		maxRetryCount, limit,
	)
	return logs, err
}

// IncrementRetryCount increments the retry count and updates last_retry_at timestamp.
// Aligned with TS EventBusEventRepository.
func (r *Repository) IncrementRetryCount(ctx context.Context, id string) (*models.EventLog, error) {
	var log models.EventLog
	err := r.db.QueryRowxContext(ctx,
		`UPDATE event_logs
		 SET retry_count = retry_count + 1, last_retry_at = NOW()
		 WHERE id = $1
		 RETURNING id, tenant_id, event_type, subject, source, payload, sequence_num, status, published_by, published_at, retry_count, last_retry_at, processed, created_at`,
		id,
	).StructScan(&log)
	if err != nil {
		return nil, err
	}
	return &log, nil
}

// CountByStatus returns the total number of events with a given status.
func (r *Repository) CountByStatus(ctx context.Context, status models.EventStatus) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM event_logs WHERE status = $1`,
		status,
	)
	return count, err
}

// CountByType returns the total number of events with a given event type.
func (r *Repository) CountByType(ctx context.Context, eventType string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM event_logs WHERE event_type = $1`,
		eventType,
	)
	return count, err
}

// MarkEventProcessed marks an event as processed and delivered.
func (r *Repository) MarkEventProcessed(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE event_logs SET processed = true, status = $1 WHERE id = $2 AND tenant_id = $3`,
		models.EventStatusDelivered, id, tenantID,
	)
	return err
}

// ---------- EventBusConfig operations (aligned with TS EventBusConfigRepository) ----------

// FindConfigByKey returns a config entry by its key.
func (r *Repository) FindConfigByKey(ctx context.Context, key string) (*models.EventBusConfig, error) {
	var cfg models.EventBusConfig
	err := r.db.GetContext(ctx, &cfg,
		`SELECT id, config_key, config_value, description, created_at, updated_at
		 FROM event_bus_config
		 WHERE config_key = $1`,
		key,
	)
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

// UpsertConfig creates or updates a config entry by key.
func (r *Repository) UpsertConfig(ctx context.Context, key string, value models.JSONB, description *string) (*models.EventBusConfig, error) {
	var cfg models.EventBusConfig
	err := r.db.QueryRowxContext(ctx,
		`INSERT INTO event_bus_config (config_key, config_value, description)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (config_key) DO UPDATE SET config_value = $2, description = COALESCE($3, event_bus_config.description), updated_at = NOW()
		 RETURNING id, config_key, config_value, description, created_at, updated_at`,
		key, value, description,
	).StructScan(&cfg)
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

// GetAllConfigs returns all config entries.
func (r *Repository) GetAllConfigs(ctx context.Context) ([]models.EventBusConfig, error) {
	var configs []models.EventBusConfig
	err := r.db.SelectContext(ctx, &configs,
		`SELECT id, config_key, config_value, description, created_at, updated_at
		 FROM event_bus_config
		 ORDER BY config_key ASC`,
	)
	return configs, err
}
