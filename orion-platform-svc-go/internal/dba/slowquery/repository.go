package slowquery

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// ErrNoRecord is returned when a TopN/GetByHash call finds no rows.
var ErrNoRecord = errors.New("slowquery: no record")

// Repository persists SlowQuery rows. All methods are idempotent —
// repeated collections with the same QueryHash update the existing row
// rather than inserting a duplicate, so re-running Collect is safe.
type Repository struct {
	db *sqlx.DB
}

// NewRepository returns a Repository backed by db. db is used
// read-write; the caller must ensure the dba_slowquery_records table
// exists (see migrations/dba/slowquery_records.sql).
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// upsertSQL is the shared SQL for Upsert/UpsertBatch. ON CONFLICT
// merges by (data_source_id, query_hash) so re-running the collector
// accumulates call_count/total_time instead of duplicating rows.
const upsertSQL = `
INSERT INTO dba_slowquery_records
	(id, tenant_id, data_source_id, db_type, schema, query, query_hash,
	 call_count, mean_time_ms, total_time_ms, rows_read, rows_returned,
	 collected_at, updated_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
ON CONFLICT (data_source_id, query_hash) DO UPDATE SET
	call_count     = dba_slowquery_records.call_count + EXCLUDED.call_count,
	mean_time_ms   = EXCLUDED.mean_time_ms,
	total_time_ms  = dba_slowquery_records.total_time_ms + EXCLUDED.total_time_ms,
	rows_read      = dba_slowquery_records.rows_read + EXCLUDED.rows_read,
	rows_returned  = dba_slowquery_records.rows_returned + EXCLUDED.rows_returned,
	updated_at     = NOW()
`

// Upsert writes a single SlowQuery record.
func (r *Repository) Upsert(ctx context.Context, sq *SlowQuery) error {
	if err := r.applyDefaults(sq); err != nil {
		return err
	}
	_, err := r.db.ExecContext(ctx, upsertSQL, args(sq)...)
	return err
}

// UpsertBatch writes many records in a single transaction. Used by the
// collector which pulls hundreds of rows per pass.
func (r *Repository) UpsertBatch(ctx context.Context, sqs []*SlowQuery) error {
	if len(sqs) == 0 {
		return nil
	}
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	stmt, err := tx.PreparexContext(ctx, upsertSQL)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, sq := range sqs {
		if err := r.applyDefaults(sq); err != nil {
			return err
		}
		if _, err := stmt.ExecContext(ctx, args(sq)...); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// TopN returns the top N slowest queries for a data source, ordered by
// the given metric. Since is inclusive. When since is nil all rows are
// considered. Limit is capped to 500 for safety.
func (r *Repository) TopN(ctx context.Context, filter TopNRequest) ([]SlowQuery, error) {
	if filter.Limit <= 0 || filter.Limit > 500 {
		filter.Limit = 50
	}
	order := filter.OrderBy
	if order != "mean_time_ms" && order != "rows_read" {
		order = "total_time_ms"
	}

	query := `SELECT id, tenant_id, data_source_id, db_type, schema, query, query_hash,
			call_count, mean_time_ms, total_time_ms, rows_read, rows_returned,
			collected_at
		FROM dba_slowquery_records
		WHERE tenant_id = $1 AND data_source_id = $2`
	args := []any{filter.TenantID, filter.DataSourceID}
	if filter.Since != nil {
		query += " AND collected_at >= $3"
		args = append(args, *filter.Since)
	}
	query += fmt.Sprintf(" ORDER BY %s DESC LIMIT %d", order, filter.Limit)

	var out []SlowQuery
	if err := r.db.SelectContext(ctx, &out, query, args...); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNoRecord
		}
		return nil, err
	}
	return out, nil
}

// CountActive returns the number of distinct slow queries collected
// within the retention window for a tenant.
func (r *Repository) CountActive(ctx context.Context, tenantID, dataSourceID string, since time.Time) (int, error) {
	row := r.db.QueryRowContext(ctx,
		`SELECT COUNT(DISTINCT query_hash) FROM dba_slowquery_records
		 WHERE tenant_id = $1 AND data_source_id = $2 AND collected_at >= $3`,
		tenantID, dataSourceID, since,
	)
	var n int
	if err := row.Scan(&n); err != nil {
		return 0, err
	}
	return n, nil
}

// Prune deletes records older than the given cutoff. Returns the
// number of rows removed.
func (r *Repository) Prune(ctx context.Context, cutoff time.Time) (int64, error) {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM dba_slowquery_records WHERE collected_at < $1`, cutoff,
	)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// applyDefaults fills ID/CollectedAt when missing.
func (r *Repository) applyDefaults(sq *SlowQuery) error {
	if sq == nil {
		return fmt.Errorf("slowquery: nil record")
	}
	if sq.ID == "" {
		sq.ID = uuid.NewString()
	}
	if sq.CollectedAt.IsZero() {
		sq.CollectedAt = time.Now().UTC()
	}
	return nil
}

// args flattens a SlowQuery into the positional parameter list the
// upsert SQL expects.
func args(sq *SlowQuery) []any {
	return []any{
		sq.ID, sq.TenantID, sq.DataSourceID, sq.DBType, sq.Schema, sq.Query, sq.QueryHash,
		sq.CallCount, sq.MeanTime, sq.TotalTime, sq.RowsRead, sq.RowsReturned,
	}
}
