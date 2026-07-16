package eventstore

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/domain/events"
)

// ErrEventNotFound indicates no events matched the query.
var ErrEventNotFound = errors.New("no events found for aggregate")

// PostgreSQLEventStore is a PostgreSQL-backed implementation of EventStore.
type PostgreSQLEventStore struct {
	db *sqlx.DB
}

// NewPostgreSQLEventStore creates a new PostgreSQL-backed EventStore.
func NewPostgreSQLEventStore(db *sqlx.DB) *PostgreSQLEventStore {
	return &PostgreSQLEventStore{db: db}
}

// Append inserts one or more domain events into the domain_events table.
func (es *PostgreSQLEventStore) Append(ctx context.Context, evs ...events.DomainEvent) error {
	if len(evs) == 0 {
		return nil
	}

	tx, err := es.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback()

	for _, ev := range evs {
		dataJSON, err := json.Marshal(ev)
		if err != nil {
			return fmt.Errorf("marshal event %s: %w", ev.EventType(), err)
		}

		_, err = tx.ExecContext(ctx,
			`INSERT INTO domain_events (id, aggregate_type, aggregate_id, tenant_id, event_type, event_data, occurred_at, correlation_id, causation_id, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
			uuid.New().String(),
			ev.AggregateType(),
			ev.AggregateID(),
			ev.TenantID(),
			ev.EventType(),
			dataJSON,
			ev.OccurredAt(),
			"",
			"",
			time.Now().UTC(),
		)
		if err != nil {
			return fmt.Errorf("insert event %s: %w", ev.EventType(), err)
		}
	}

	return tx.Commit()
}

// GetByAggregate retrieves all events for a specific aggregate, ordered by occurrence time.
func (es *PostgreSQLEventStore) GetByAggregate(ctx context.Context, tenantID, aggregateType, aggregateID string) ([]events.DomainEvent, error) {
	rows, err := es.db.QueryxContext(ctx,
		`SELECT id, aggregate_type, aggregate_id, tenant_id, event_type, event_data, occurred_at, correlation_id, causation_id
		 FROM domain_events
		 WHERE aggregate_type=$1 AND aggregate_id=$2 AND tenant_id=$3
		 ORDER BY occurred_at ASC, created_at ASC`,
		aggregateType, aggregateID, tenantID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := make([]events.DomainEvent, 0)
	for rows.Next() {
		var row struct {
			ID           string          `db:"id"`
			AggregateType string         `db:"aggregate_type"`
			AggregateID  string          `db:"aggregate_id"`
			TenantID     string          `db:"tenant_id"`
			EventType    string          `db:"event_type"`
			EventData    json.RawMessage `db:"event_data"`
			OccurredAt   time.Time       `db:"occurred_at"`
			CorrelationID string         `db:"correlation_id"`
			CausationID  string          `db:"causation_id"`
		}
		if err := rows.StructScan(&row); err != nil {
			return nil, fmt.Errorf("scan event row: %w", err)
		}
		events = append(events, row)
	}

	return events, nil
}

// GetByType queries events by event type since a given timestamp.
func (es *PostgreSQLEventStore) GetByType(ctx context.Context, tenantID, eventType string, since time.Time) ([]events.DomainEvent, error) {
	rows, err := es.db.QueryxContext(ctx,
		`SELECT id, aggregate_type, aggregate_id, tenant_id, event_type, event_data, occurred_at, correlation_id, causation_id
		 FROM domain_events
		 WHERE tenant_id=$1 AND event_type=$2 AND occurred_at >= $3
		 ORDER BY occurred_at ASC`,
		tenantID, eventType, since,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := make([]events.DomainEvent, 0)
	_ = rows // events would be populated from rows
	// TODO: Implement full row scanning and deserialization

	return events, nil
}

// GetLatestVersion returns the latest event version number for an aggregate.
func (es *PostgreSQLEventStore) GetLatestVersion(ctx context.Context, tenantID, aggregateType, aggregateID string) (int, error) {
	var version int
	err := es.db.GetContext(ctx, &version,
		`SELECT COUNT(*) FROM domain_events
		 WHERE aggregate_type=$1 AND aggregate_id=$2 AND tenant_id=$3`,
		aggregateType, aggregateID, tenantID,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, nil
		}
		return 0, err
	}
	return version, nil
}

// GetEventsAfterVersion returns events after a specific version for incremental replay.
func (es *PostgreSQLEventStore) GetEventsAfterVersion(ctx context.Context, tenantID, aggregateType, aggregateID string, afterVersion int) ([]events.DomainEvent, error) {
	// Get the timestamp of the event at the afterVersion position
	var refTime time.Time
	err := es.db.GetContext(ctx, &refTime,
		`SELECT occurred_at FROM domain_events
		 WHERE aggregate_type=$1 AND aggregate_id=$2 AND tenant_id=$3
		 ORDER BY occurred_at ASC, created_at ASC
		 LIMIT 1 OFFSET $4`,
		aggregateType, aggregateID, tenantID, afterVersion,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return []events.DomainEvent{}, nil
		}
		return nil, err
	}

	// Get all events after that timestamp
	rows, err := es.db.QueryxContext(ctx,
		`SELECT id, aggregate_type, aggregate_id, tenant_id, event_type, event_data, occurred_at, correlation_id, causation_id
		 FROM domain_events
		 WHERE aggregate_type=$1 AND aggregate_id=$2 AND tenant_id=$3 AND occurred_at > $4
		 ORDER BY occurred_at ASC, created_at ASC`,
		aggregateType, aggregateID, tenantID, refTime,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := make([]events.DomainEvent, 0)
	for rows.Next() {
		var row struct {
			ID           string          `db:"id"`
			AggregateType string         `db:"aggregate_type"`
			AggregateID  string          `db:"aggregate_id"`
			TenantID     string          `db:"tenant_id"`
			EventType    string          `db:"event_type"`
			EventData    json.RawMessage `db:"event_data"`
			OccurredAt   time.Time       `db:"occurred_at"`
			CorrelationID string         `db:"correlation_id"`
			CausationID  string          `db:"causation_id"`
		}
		if err := rows.StructScan(&row); err != nil {
			return nil, fmt.Errorf("scan event row: %w", err)
		}
		events = append(events, row)
	}

	return events, nil
}

// DeleteOlderThan removes events older than the given timestamp.
// Returns the number of deleted events.
func (es *PostgreSQLEventStore) DeleteOlderThan(ctx context.Context, tenantID string, olderThan time.Time) (int64, error) {
	result, err := es.db.ExecContext(ctx,
		`DELETE FROM domain_events WHERE tenant_id=$1 AND occurred_at < $2`,
		tenantID, olderThan,
	)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
