package advisor

import (
	"context"

	"github.com/jmoiron/sqlx"
)

// PlatformSlowLookup pulls slow query rows from the platform's own
// query_execution_records table (populated by dba_query's audit log
// when DBAs run queries). This is the primary signal for index
// recommendations when pg_stat_statements is not enabled.
type PlatformSlowLookup struct {
	db *sqlx.DB
}

// NewPlatformSlowLookup returns a SlowQueryLookup backed by the
// platform PG database.
func NewPlatformSlowLookup(db *sqlx.DB) *PlatformSlowLookup {
	return &PlatformSlowLookup{db: db}
}

// TopN returns the N slowest query execution records for a data
// source, joined with call counts from the slowquery records table
// when available. call_count is derived from the number of rows in
// query_execution_records with the same (data_source_id, sql_text)
// — this is an approximation; a real collector would track it
// explicitly. Results are scoped to the caller's tenant.
func (l *PlatformSlowLookup) TopN(ctx context.Context, tenantID, dsID string, limit int) ([]SlowQueryRow, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	q := `SELECT sql_text, latency_ms, row_count, data_source_id, COUNT(*) OVER (
		PARTITION BY data_source_id, sql_text
	) AS calls
	FROM query_execution_records
	WHERE tenant_id = $1 AND data_source_id = $2 AND sql_text IS NOT NULL
	ORDER BY latency_ms DESC
	LIMIT $3`
	rows, err := l.db.QueryxContext(ctx, q, tenantID, dsID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []SlowQueryRow
	for rows.Next() {
		var r struct {
			SQL          string
			LatencyMs    float64
			RowCount     int64
			DataSourceID string
			Calls        int64
		}
		if err := rows.StructScan(&r); err != nil {
			return nil, err
		}
		out = append(out, SlowQueryRow{
			Query:     r.SQL,
			CallCount: r.Calls,
			TotalTime: r.LatencyMs,
			RowsRead:  r.RowCount,
		})
	}
	return out, nil
}
