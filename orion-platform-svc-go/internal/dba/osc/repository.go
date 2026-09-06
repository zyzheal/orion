package osc

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"orion/go-common/pkg/sentinel"
)

// Repository persists OSCJob records in PostgreSQL. It mirrors the
// style of internal/dba/repository: explicit column lists on writes,
// SELECT * on reads, and RETURNING * for updates.
type Repository struct {
	db *sqlx.DB
}

// NewRepository constructs a Repository. db must be a PostgreSQL
// connection; the underlying table is created by migrations/dba/osc_jobs.sql.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// CreateJob inserts a new job record. It assigns ID, CreatedAt,
// UpdatedAt and default Status="pending" when unset.
func (r *Repository) CreateJob(ctx context.Context, j *OSCJob) error {
	if j.ID == "" {
		j.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	if j.CreatedAt.IsZero() {
		j.CreatedAt = now
	}
	j.UpdatedAt = now
	if j.Status == "" {
		j.Status = StatusPending
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO dba_osc_jobs (
			id, tenant_id, user_id, data_source_id, table, alter_sql,
			status, dry_run, cutover_mode, max_lag_millis, chunk_size,
			error_message, log, rows_affected, max_lag_observed, duration_ms,
			created_at, updated_at, started_at, finished_at
		 ) VALUES (
			:id, :tenant_id, :user_id, :data_source_id, :table, :alter_sql,
			:status, :dry_run, :cutover_mode, :max_lag_millis, :chunk_size,
			:error_message, :log, :rows_affected, :max_lag_observed, :duration_ms,
			:created_at, :updated_at, :started_at, :finished_at
		 )`,
		j)
	if err != nil {
		return fmt.Errorf("insert osc job: %w", err)
	}
	return nil
}

// GetJob fetches a single job by ID. Returns sentinel.NotFound when
// no row matches.
func (r *Repository) GetJob(ctx context.Context, id string) (*OSCJob, error) {
	var j OSCJob
	err := r.db.GetContext(ctx, &j,
		`SELECT * FROM dba_osc_jobs WHERE id=$1`, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, sentinel.NotFound
		}
		return nil, fmt.Errorf("get osc job: %w", err)
	}
	return &j, nil
}

// ListJobs returns a paginated list for the given tenant. status="" means
// all statuses. Page is 1-based; Limit defaults to 20 when <= 0.
func (r *Repository) ListJobs(ctx context.Context, tenantID, status string, page, limit int) ([]OSCJob, int, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit

	where := "WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	idx := 2
	if status != "" {
		where += fmt.Sprintf(" AND status=$%d", idx)
		args = append(args, status)
		idx++
	}

	var total int
	if err := r.db.GetContext(ctx, &total,
		fmt.Sprintf(`SELECT COUNT(*) FROM dba_osc_jobs %s`, where), args...); err != nil {
		return nil, 0, fmt.Errorf("count osc jobs: %w", err)
	}

	query := fmt.Sprintf(`SELECT * FROM dba_osc_jobs %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		where, idx, idx+1)
	args = append(args, limit, offset)

	var jobs []OSCJob
	if err := r.db.SelectContext(ctx, &jobs, query, args...); err != nil {
		return nil, 0, fmt.Errorf("list osc jobs: %w", err)
	}
	return jobs, total, nil
}

// UpdateJob applies a partial update and returns the full row. The
// updates map is keyed by column name; unknown keys cause a SQL error
// rather than a silent no-op, which is intentional — callers should not
// invent column names.
//
// updated_at is always bumped so callers can rely on it for freshness.
func (r *Repository) UpdateJob(ctx context.Context, id string, updates map[string]interface{}) (*OSCJob, error) {
	if len(updates) == 0 {
		return r.GetJob(ctx, id)
	}
	updates["updated_at"] = time.Now().UTC()

	_, err := r.db.NamedExecContext(ctx,
		`UPDATE dba_osc_jobs SET :updates WHERE id=$1`,
		map[string]interface{}{
			"updates": updates,
			"id":      id,
		})
	if err != nil {
		return nil, fmt.Errorf("update osc job: %w", err)
	}
	return r.GetJob(ctx, id)
}

// UpdateJobStatus is a convenience wrapper around UpdateJob that sets
// status + error_message + started_at + finished_at atomically. Only
// non-nil arguments are applied; this keeps partial status transitions
// simple from the service layer.
func (r *Repository) UpdateJobStatus(ctx context.Context, id, status string, startedAt, finishedAt *time.Time, errMsg *string) (*OSCJob, error) {
	updates := map[string]interface{}{"status": status}
	if startedAt != nil {
		updates["started_at"] = *startedAt
	}
	if finishedAt != nil {
		updates["finished_at"] = *finishedAt
	}
	if errMsg != nil {
		updates["error_message"] = *errMsg
	}
	return r.UpdateJob(ctx, id, updates)
}
