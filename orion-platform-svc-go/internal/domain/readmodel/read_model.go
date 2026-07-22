// Package readmodel provides infrastructure for building materialized projections
// from domain events.  Projectors consume events from the EventStore and maintain
// denormalized views optimized for query performance.
package readmodel

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/domain/events"
)

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

// ErrProjectionNotFound indicates that no projection data exists for the given key.
var ErrProjectionNotFound = errors.New("projection not found")

// ErrProjectionAlreadyExists is returned when attempting to create a projection
// that already exists (e.g., inserting a duplicate pipeline run).
var ErrProjectionAlreadyExists = errors.New("projection already exists")

// ---------------------------------------------------------------------------
// EventStoreReader — minimal interface consumed by projectors
// ---------------------------------------------------------------------------

// EventStoreReader defines the read-only portion of EventStore that projectors
// need to replay events.
type EventStoreReader interface {
	GetByAggregate(ctx context.Context, tenantID, aggregateType, aggregateID string) ([]events.DomainEvent, error)
	GetByType(ctx context.Context, tenantID, eventType string, since time.Time) ([]events.DomainEvent, error)
	GetEventsAfterVersion(ctx context.Context, tenantID, aggregateType, aggregateID string, afterVersion int) ([]events.DomainEvent, error)
	GetLatestVersion(ctx context.Context, tenantID, aggregateType, aggregateID string) (int, error)
}

// ---------------------------------------------------------------------------
// Core interfaces
// ---------------------------------------------------------------------------

// ReadModelProjector defines the contract for building and rebuilding
// materialized projections from domain events.
type ReadModelProjector interface {
	// Project processes a single domain event and updates the projection.
	// Implementations should be idempotent.
	Project(ctx context.Context, event events.DomainEvent) error

	// Rebuild tears down and rebuilds the entire projection from the EventStore.
	// The since parameter limits replay to events after a given timestamp.
	Rebuild(ctx context.Context, since time.Time) error
}

// ProjectionRepository provides CRUD operations for projection data.
// Each projector typically owns its own repository implementation.
type ProjectionRepository interface {
	// FindByID retrieves a single projection row by its primary key.
	FindByID(ctx context.Context, id string) (interface{}, error)

	// List retrieves all projection rows, optionally filtered by tenant.
	List(ctx context.Context, tenantID string) ([]interface{}, error)

	// Save inserts or updates a projection row.
	Save(ctx context.Context, projection interface{}) error

	// Delete removes a projection row by its primary key.
	Delete(ctx context.Context, id string) error
}

// ---------------------------------------------------------------------------
// PipelineRunProjection — concrete projection example
// ---------------------------------------------------------------------------

// PipelineRunStatus represents the current status of a pipeline run.
type PipelineRunStatus string

const (
	PipelineRunPending   PipelineRunStatus = "pending"
	PipelineRunRunning   PipelineRunStatus = "running"
	PipelineRunSuccess   PipelineRunStatus = "success"
	PipelineRunFailed    PipelineRunStatus = "failed"
	PipelineRunCancelled PipelineRunStatus = "cancelled"
)

// PipelineRunProjection is a materialized view of pipeline run state,
// denormalized from pipeline domain events for fast queries.
type PipelineRunProjection struct {
	// RunID is the unique identifier of the pipeline run.
	RunID string `db:"run_id" json:"run_id"`

	// PipelineID is the pipeline definition this run belongs to.
	PipelineID string `db:"pipeline_id" json:"pipeline_id"`

	// PipelineName is the human-readable name of the pipeline.
	PipelineName string `db:"pipeline_name" json:"pipeline_name"`

	// TenantID for multi-tenant isolation.
	TenantID string `db:"tenant_id" json:"tenant_id"`

	// Status is the current run status.
	Status PipelineRunStatus `db:"status" json:"status"`

	// Branch is the git branch being built.
	Branch string `db:"branch" json:"branch"`

	// TriggerSource describes how the run was triggered (manual, webhook, cron, etc.).
	TriggerSource string `db:"trigger_source" json:"trigger_source"`

	// StartedAt is when the run started.
	StartedAt *time.Time `db:"started_at" json:"started_at"`

	// CompletedAt is when the run completed.
	CompletedAt *time.Time `db:"completed_at" json:"completed_at"`

	// TotalDurationMs is the total execution duration in milliseconds.
	TotalDurationMs int64 `db:"total_duration_ms" json:"total_duration_ms"`

	// ErrorMessage captures the failure reason if the run failed.
	ErrorMessage string `db:"error_message" json:"error_message"`

	// Version is the event version this projection was last synced to.
	Version int `db:"version" json:"version"`

	// UpdatedAt is when this projection row was last updated.
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

// ---------------------------------------------------------------------------
// PostgresReadModelProjector — PostgreSQL-backed projector
// ---------------------------------------------------------------------------

// PostgresReadModelProjector builds pipeline run projections by replaying
// domain events from the EventStore and maintaining a materialized table.
type PostgresReadModelProjector struct {
	db        *sqlx.DB
	eventStore EventStoreReader
	mu        sync.RWMutex
}

// NewPostgresReadModelProjector creates a new projector backed by PostgreSQL.
func NewPostgresReadModelProjector(db *sqlx.DB, eventStore EventStoreReader) *PostgresReadModelProjector {
	return &PostgresReadModelProjector{
		db:         db,
		eventStore: eventStore,
	}
}

// EnsureSchema creates the projections table if it does not exist.
func (p *PostgresReadModelProjector) EnsureSchema(ctx context.Context) error {
	_, err := p.db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS pipeline_run_projections (
			run_id          TEXT        NOT NULL PRIMARY KEY,
			pipeline_id     TEXT        NOT NULL,
			pipeline_name   TEXT        NOT NULL DEFAULT '',
			tenant_id       TEXT        NOT NULL,
			status          TEXT        NOT NULL DEFAULT 'pending',
			branch          TEXT        NOT NULL DEFAULT '',
			trigger_source  TEXT        NOT NULL DEFAULT '',
			started_at      TIMESTAMPTZ,
			completed_at    TIMESTAMPTZ,
			total_duration_ms BIGINT   NOT NULL DEFAULT 0,
			error_message   TEXT        NOT NULL DEFAULT '',
			version         INT         NOT NULL DEFAULT 0,
			updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("create pipeline_run_projections table: %w", err)
	}

	_, err = p.db.ExecContext(ctx, `
		CREATE INDEX IF NOT EXISTS idx_pipeline_run_projections_tenant
		ON pipeline_run_projections (tenant_id, pipeline_id, status)
	`)
	if err != nil {
		return fmt.Errorf("create index: %w", err)
	}

	return nil
}

// Project processes a single domain event and updates the pipeline run projection.
// Supported event types: pipeline.started, pipeline.completed, pipeline.cancelled,
// pipeline.created (for notification before execution).
func (p *PostgresReadModelProjector) Project(ctx context.Context, event events.DomainEvent) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	switch event.EventType() {
	case "pipeline.started":
		return p.handlePipelineStarted(ctx, event)
	case "pipeline.completed":
		return p.handlePipelineCompleted(ctx, event)
	case "pipeline.cancelled":
		return p.handlePipelineCancelled(ctx, event)
	case "pipeline.created":
		return p.handlePipelineCreated(ctx, event)
	default:
		// Unknown event types are silently ignored.
		return nil
	}
}

// Rebuild replays all pipeline events from the EventStore since the given
// timestamp, dropping and recreating the projection table.
func (p *PostgresReadModelProjector) Rebuild(ctx context.Context, since time.Time) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	// Drop and recreate the table and index.
	if _, err := p.db.ExecContext(ctx, `DROP TABLE IF EXISTS pipeline_run_projections`); err != nil {
		return fmt.Errorf("drop projections table: %w", err)
	}
	if err := p.EnsureSchema(ctx); err != nil {
		return err
	}

	// Fetch all pipeline events since the given timestamp.
	eventTypes := []string{
		"pipeline.created",
		"pipeline.started",
		"pipeline.completed",
		"pipeline.cancelled",
	}

	for _, et := range eventTypes {
		evs, err := p.eventStore.GetByType(ctx, "", et, since)
		if err != nil {
			return fmt.Errorf("get events by type %s: %w", et, err)
		}
		for _, ev := range evs {
			if err := p.Project(ctx, ev); err != nil {
				return fmt.Errorf("project event %s/%s: %w", ev.EventType(), ev.AggregateID(), err)
			}
		}
	}

	return nil
}

// GetRunByID retrieves a single pipeline run projection.
func (p *PostgresReadModelProjector) GetRunByID(ctx context.Context, runID string) (*PipelineRunProjection, error) {
	var proj PipelineRunProjection
	err := p.db.GetContext(ctx, &proj,
		`SELECT run_id, pipeline_id, pipeline_name, tenant_id, status, branch, trigger_source,
		        started_at, completed_at, total_duration_ms, error_message, version, updated_at
		 FROM pipeline_run_projections WHERE run_id = $1`, runID,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrProjectionNotFound
		}
		return nil, fmt.Errorf("get run by id: %w", err)
	}
	return &proj, nil
}

// ListRunsByPipeline returns all runs for a given pipeline, ordered by most recent first.
func (p *PostgresReadModelProjector) ListRunsByPipeline(ctx context.Context, tenantID, pipelineID string, limit, offset int) ([]PipelineRunProjection, error) {
	if limit <= 0 {
		limit = 20
	}
	rows, err := p.db.QueryxContext(ctx,
		`SELECT run_id, pipeline_id, pipeline_name, tenant_id, status, branch, trigger_source,
		        started_at, completed_at, total_duration_ms, error_message, version, updated_at
		 FROM pipeline_run_projections
		 WHERE tenant_id = $1 AND pipeline_id = $2
		 ORDER BY COALESCE(started_at, updated_at) DESC
		 LIMIT $3 OFFSET $4`,
		tenantID, pipelineID, limit, offset,
	)
	if err != nil {
		return nil, fmt.Errorf("list runs by pipeline: %w", err)
	}
	defer rows.Close()

	result := make([]PipelineRunProjection, 0)
	for rows.Next() {
		var proj PipelineRunProjection
		if err := rows.StructScan(&proj); err != nil {
			return nil, fmt.Errorf("scan projection row: %w", err)
		}
		result = append(result, proj)
	}
	return result, nil
}

// ListRunsByStatus returns runs filtered by status.
func (p *PostgresReadModelProjector) ListRunsByStatus(ctx context.Context, tenantID string, status PipelineRunStatus, limit, offset int) ([]PipelineRunProjection, error) {
	if limit <= 0 {
		limit = 20
	}
	rows, err := p.db.QueryxContext(ctx,
		`SELECT run_id, pipeline_id, pipeline_name, tenant_id, status, branch, trigger_source,
		        started_at, completed_at, total_duration_ms, error_message, version, updated_at
		 FROM pipeline_run_projections
		 WHERE tenant_id = $1 AND status = $2
		 ORDER BY updated_at DESC
		 LIMIT $3 OFFSET $4`,
		tenantID, string(status), limit, offset,
	)
	if err != nil {
		return nil, fmt.Errorf("list runs by status: %w", err)
	}
	defer rows.Close()

	result := make([]PipelineRunProjection, 0)
	for rows.Next() {
		var proj PipelineRunProjection
		if err := rows.StructScan(&proj); err != nil {
			return nil, fmt.Errorf("scan projection row: %w", err)
		}
		result = append(result, proj)
	}
	return result, nil
}

// ---------------------------------------------------------------------------
// Internal event handlers
// ---------------------------------------------------------------------------

// handlePipelineStarted creates or updates a projection row when a pipeline starts.
func (p *PostgresReadModelProjector) handlePipelineStarted(ctx context.Context, event events.DomainEvent) error {
	now := time.Now().UTC()

	// Attempt to extract branch and trigger source from the event data.
	branch := extractField(event, "branch")
	triggerSource := extractField(event, "trigger_source")

	_, err := p.db.ExecContext(ctx,
		`INSERT INTO pipeline_run_projections (run_id, pipeline_id, pipeline_name, tenant_id, status, branch, trigger_source, started_at, version, updated_at)
		 VALUES ($1, $2, $3, $4, 'running', $5, $6, $7, $8, $9)
		 ON CONFLICT (run_id) DO UPDATE SET
		     status = 'running',
		     branch = EXCLUDED.branch,
		     trigger_source = EXCLUDED.trigger_source,
		     started_at = COALESCE(pipeline_run_projections.started_at, EXCLUDED.started_at),
		     version = EXCLUDED.version,
		     updated_at = EXCLUDED.updated_at`,
		event.AggregateID(),
		extractField(event, "pipeline_id"),
		extractField(event, "pipeline_name"),
		event.TenantID(),
		branch,
		triggerSource,
		now,
		event.Version(),
		now,
	)
	if err != nil {
		return fmt.Errorf("handle pipeline.started: %w", err)
	}
	return nil
}

// handlePipelineCompleted updates a projection row when a pipeline completes.
func (p *PostgresReadModelProjector) handlePipelineCompleted(ctx context.Context, event events.DomainEvent) error {
	now := time.Now().UTC()
	status := PipelineRunSuccess

	// Determine actual status from the event data.
	if s := extractField(event, "status"); s == "failed" || s == "error" {
		status = PipelineRunFailed
	}

	duration := parseInt64Field(event, "total_duration_ms")

	_, err := p.db.ExecContext(ctx,
		`UPDATE pipeline_run_projections
		 SET status = $1, completed_at = $2, total_duration_ms = $3, version = $4, updated_at = $5
		 WHERE run_id = $6`,
		string(status), now, duration, event.Version(), now, event.AggregateID(),
	)
	if err != nil {
		return fmt.Errorf("handle pipeline.completed: %w", err)
	}
	return nil
}

// handlePipelineCancelled updates a projection row when a pipeline is cancelled.
func (p *PostgresReadModelProjector) handlePipelineCancelled(ctx context.Context, event events.DomainEvent) error {
	now := time.Now().UTC()
	reason := extractField(event, "reason")

	_, err := p.db.ExecContext(ctx,
		`UPDATE pipeline_run_projections
		 SET status = 'cancelled', completed_at = $1, error_message = $2, version = $3, updated_at = $4
		 WHERE run_id = $5`,
		now, reason, event.Version(), now, event.AggregateID(),
	)
	if err != nil {
		return fmt.Errorf("handle pipeline.cancelled: %w", err)
	}
	return nil
}

// handlePipelineCreated creates an initial projection row when a pipeline is created.
func (p *PostgresReadModelProjector) handlePipelineCreated(ctx context.Context, event events.DomainEvent) error {
	now := time.Now().UTC()
	pipelineName := extractField(event, "pipeline_name")

	_, err := p.db.ExecContext(ctx,
		`INSERT INTO pipeline_run_projections (run_id, pipeline_id, pipeline_name, tenant_id, status, version, updated_at)
		 VALUES ($1, $2, $3, $4, 'pending', $5, $6)
		 ON CONFLICT (run_id) DO NOTHING`,
		event.AggregateID(),
		event.AggregateID(),
		pipelineName,
		event.TenantID(),
		event.Version(),
		now,
	)
	if err != nil {
		return fmt.Errorf("handle pipeline.created: %w", err)
	}
	return nil
}

// ---------------------------------------------------------------------------
// Field extraction helpers
// ---------------------------------------------------------------------------

// extractField attempts to extract a top-level field from a domain event's
// JSON serialization.  Returns empty string on failure.
func extractField(event events.DomainEvent, key string) string {
	data, err := json.Marshal(event)
	if err != nil {
		return ""
	}
	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		return ""
	}
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

// parseInt64Field attempts to extract a numeric field as int64.
func parseInt64Field(event events.DomainEvent, key string) int64 {
	data, err := json.Marshal(event)
	if err != nil {
		return 0
	}
	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		return 0
	}
	if v, ok := m[key]; ok {
		switch n := v.(type) {
		case float64:
			return int64(n)
		case int64:
			return n
		case json.Number:
			if val, err := n.Int64(); err == nil {
				return val
			}
		}
	}
	return 0
}