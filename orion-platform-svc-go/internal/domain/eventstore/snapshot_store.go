package eventstore

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// ErrSnapshotNotFound indicates no snapshot matched the query.
var ErrSnapshotNotFound = errors.New("no snapshot found")

// PostgreSQLSnapshotStore is a PostgreSQL-backed implementation of SnapshotStore.
type PostgreSQLSnapshotStore struct {
	db *sqlx.DB
}

// NewPostgreSQLSnapshotStore creates a new PostgreSQL-backed SnapshotStore.
func NewPostgreSQLSnapshotStore(db *sqlx.DB) *PostgreSQLSnapshotStore {
	return &PostgreSQLSnapshotStore{db: db}
}

// Save inserts a snapshot into the domain_snapshots table.
func (s *PostgreSQLSnapshotStore) Save(ctx context.Context, snapshot *Snapshot) error {
	if snapshot.ID == "" {
		snapshot.ID = uuid.New().String()
	}
	if snapshot.CreatedAt.IsZero() {
		snapshot.CreatedAt = time.Now().UTC()
	}

	_, err := s.db.ExecContext(ctx,
		`INSERT INTO domain_snapshots (id, aggregate_type, aggregate_id, tenant_id, snapshot_version, snapshot_data, metadata, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 ON CONFLICT (aggregate_id, snapshot_version) DO UPDATE SET
			 snapshot_data = EXCLUDED.snapshot_data,
			 metadata = EXCLUDED.metadata,
			 created_at = EXCLUDED.created_at`,
		snapshot.ID,
		snapshot.AggregateType,
		snapshot.AggregateID,
		snapshot.TenantID,
		snapshot.Version,
		snapshot.State,
		snapshot.Metadata,
		snapshot.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("save snapshot: %w", err)
	}
	return nil
}

// GetLatest retrieves the most recent snapshot for an aggregate.
func (s *PostgreSQLSnapshotStore) GetLatest(ctx context.Context, tenantID, aggregateType, aggregateID string) (*Snapshot, error) {
	var snapshot Snapshot
	err := s.db.GetContext(ctx, &snapshot,
		`SELECT id, aggregate_type, aggregate_id, tenant_id, snapshot_version, snapshot_data, metadata, created_at
		 FROM domain_snapshots
		 WHERE aggregate_type=$1 AND aggregate_id=$2 AND tenant_id=$3
		 ORDER BY snapshot_version DESC
		 LIMIT 1`,
		aggregateType, aggregateID, tenantID,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrSnapshotNotFound
		}
		return nil, fmt.Errorf("get latest snapshot: %w", err)
	}
	return &snapshot, nil
}

// GetByVersion retrieves a specific snapshot at a given version.
func (s *PostgreSQLSnapshotStore) GetByVersion(ctx context.Context, tenantID, aggregateType, aggregateID string, version int) (*Snapshot, error) {
	var snapshot Snapshot
	err := s.db.GetContext(ctx, &snapshot,
		`SELECT id, aggregate_type, aggregate_id, tenant_id, snapshot_version, snapshot_data, metadata, created_at
		 FROM domain_snapshots
		 WHERE aggregate_type=$1 AND aggregate_id=$2 AND tenant_id=$3 AND snapshot_version=$4`,
		aggregateType, aggregateID, tenantID, version,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrSnapshotNotFound
		}
		return nil, fmt.Errorf("get snapshot by version: %w", err)
	}
	return &snapshot, nil
}

// ListByAggregate lists all snapshots for an aggregate, ordered by version.
func (s *PostgreSQLSnapshotStore) ListByAggregate(ctx context.Context, tenantID, aggregateType, aggregateID string) ([]*Snapshot, error) {
	rows, err := s.db.QueryxContext(ctx,
		`SELECT id, aggregate_type, aggregate_id, tenant_id, snapshot_version, snapshot_data, metadata, created_at
		 FROM domain_snapshots
		 WHERE aggregate_type=$1 AND aggregate_id=$2 AND tenant_id=$3
		 ORDER BY snapshot_version ASC`,
		aggregateType, aggregateID, tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("list snapshots: %w", err)
	}
	defer rows.Close()

	snaps := make([]*Snapshot, 0)
	for rows.Next() {
		var snap Snapshot
		if err := rows.StructScan(&snap); err != nil {
			return nil, fmt.Errorf("scan snapshot row: %w", err)
		}
		snaps = append(snaps, &snap)
	}

	return snaps, nil
}
