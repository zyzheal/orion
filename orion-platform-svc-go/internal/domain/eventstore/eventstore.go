package eventstore

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/domain/events"
)

// EventStore defines the interface for storing and retrieving domain events.
// Events are persisted atomically with business data within the same transaction.
type EventStore interface {
	// Append appends one or more domain events (called within a transaction).
	Append(ctx context.Context, events ...events.DomainEvent) error

	// GetByAggregate retrieves all events for a specific aggregate (used for replay).
	GetByAggregate(ctx context.Context, tenantID, aggregateType, aggregateID string) ([]events.DomainEvent, error)

	// GetByType queries events by type (used for event subscription recovery).
	GetByType(ctx context.Context, tenantID, eventType string, since time.Time) ([]events.DomainEvent, error)

	// GetLatestVersion returns the latest event version for an aggregate.
	GetLatestVersion(ctx context.Context, tenantID, aggregateType, aggregateID string) (int, error)

	// GetEventsAfterVersion returns events after a specific version (incremental replay).
	GetEventsAfterVersion(ctx context.Context, tenantID, aggregateType, aggregateID string, afterVersion int) ([]events.DomainEvent, error)

	// DeleteOlderThan removes events older than the given timestamp (snapshot cleanup).
	DeleteOlderThan(ctx context.Context, tenantID string, olderThan time.Time) (int64, error)
}

// SnapshotStore defines the interface for storing and retrieving aggregate snapshots.
// Snapshots reduce replay cost by storing periodic aggregate state.
type SnapshotStore interface {
	// Save saves a snapshot of the aggregate state.
	Save(ctx context.Context, snapshot *Snapshot) error

	// GetLatest retrieves the latest snapshot for an aggregate.
	GetLatest(ctx context.Context, tenantID, aggregateType, aggregateID string) (*Snapshot, error)

	// GetByVersion retrieves a snapshot at a specific version.
	GetByVersion(ctx context.Context, tenantID, aggregateType, aggregateID string, version int) (*Snapshot, error)

	// ListByAggregate lists all snapshots for an aggregate.
	ListByAggregate(ctx context.Context, tenantID, aggregateType, aggregateID string) ([]*Snapshot, error)
}

// Snapshot represents a point-in-time state of an aggregate.
type Snapshot struct {
	ID            string    `db:"id" json:"id"`
	AggregateType string    `db:"aggregate_type" json:"aggregate_type"`
	AggregateID   string    `db:"aggregate_id" json:"aggregate_id"`
	TenantID      string    `db:"tenant_id" json:"tenant_id"`
	Version       int       `db:"version" json:"version"`
	State         string    `db:"state" json:"state"`  // JSONB - serialized aggregate state
	Metadata      string    `db:"metadata" json:"metadata"` // JSONB - optional metadata
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
}
