package slowquery

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	dba_models "orion/platform-svc-go/internal/dba/models"
)

// CollectError wraps a collection pass failure so the caller can
// distinguish a missing data source from an unsupported DB type from
// a mid-pass query error.
type CollectError struct {
	DataSourceID string
	Stage        string // "resolve" | "query" | "persist"
	Cause        error
}

func (e *CollectError) Error() string {
	return fmt.Sprintf("slowquery collect %s %s: %v", e.DataSourceID, e.Stage, e.Cause)
}

func (e *CollectError) Unwrap() error { return e.Cause }

// Collector pulls slow-query rows from a live data source and pushes
// them to the Repository. Each Collect* method is one data source,
// one DB type; the service orchestrates across them.
type Collector struct {
	repo     *Repository
	dsLookup DataSourceLookup
}

// DataSourceLookup resolves a data source ID to its credentials.
// The same shape as dba.Repository.GetDataSource so a single adapter
// satisfies both modules.
type DataSourceLookup interface {
	GetDataSource(ctx context.Context, id string) (*dba_models.DataSource, error)
}

// NewCollector wires a Collector with the persistence + lookup
// dependencies.
func NewCollector(repo *Repository, ds DataSourceLookup) *Collector {
	return &Collector{repo: repo, dsLookup: ds}
}

// Collect runs a single collection pass against the data source.
// When dbType is empty it is inferred from ds.Type. The threshold and
// since parameters narrow what gets ingested; threshold <= 0 means
// "accept the server's own slow-log threshold".
func (c *Collector) Collect(ctx context.Context, tenantID, dataSourceID string, thresholdMs int64, since *time.Time) (int, error) {
	if c.dsLookup == nil {
		return 0, &CollectError{DataSourceID: dataSourceID, Stage: "resolve", Cause: fmt.Errorf("no DataSourceLookup wired")}
	}
	ds, err := c.dsLookup.GetDataSource(ctx, dataSourceID)
	if err != nil {
		return 0, &CollectError{DataSourceID: dataSourceID, Stage: "resolve", Cause: err}
	}
	if ds.TenantID != "" && ds.TenantID != tenantID {
		return 0, &CollectError{DataSourceID: dataSourceID, Stage: "resolve", Cause: fmt.Errorf("data source %q does not belong to tenant", dataSourceID)}
	}
	dbType := normalizeDBType(ds.Type)
	switch dbType {
	case "postgres":
		return c.collectPG(ctx, tenantID, ds, thresholdMs, since)
	case "mysql":
		return c.collectMySQL(ctx, tenantID, ds, thresholdMs, since)
	default:
		return 0, &CollectError{DataSourceID: dataSourceID, Stage: "query", Cause: fmt.Errorf("unsupported db type: %s", ds.Type)}
	}
}

// collectPG pulls rows from pg_stat_statements filtered by mean time
// and last execution. It falls back to a "no extension" error message
// if the view does not exist on the target server.
func (c *Collector) collectPG(ctx context.Context, tenantID string, ds *dba_models.DataSource, thresholdMs int64, since *time.Time) (int, error) {
	dsn := buildPGDSN(ds)
	conn, err := sql.Open("postgres", dsn)
	if err != nil {
		return 0, fmt.Errorf("open pg: %w", err)
	}
	defer conn.Close()

	if err := conn.PingContext(ctx); err != nil {
		return 0, fmt.Errorf("ping pg: %w", err)
	}

	// Defense-in-depth: the collector only reads pg_stat_statements.
	// Force the session read-only so a misconfigured account can never
	// write through this connection even if it holds wider grants.
	if _, err := conn.ExecContext(ctx, "SET default_transaction_read_only = on"); err != nil {
		return 0, fmt.Errorf("set pg session read-only: %w", err)
	}

	thresh := thresholdMs
	if thresh <= 0 {
		// Default: 1000ms. pg_stat_statements stores mean_time in ms.
		thresh = 1000
	}

	// pg_stat_statements: mean_time_ms, total_time_ms, calls, rows, shared_relid, queryid, query
	// last_executed is available since PG 14; we use it only when since is set.
	where := "WHERE mean_time_ms >= $1"
	args := []any{thresh}
	if since != nil {
		where += " AND last_executed >= $2"
		args = append(args, *since)
	}

	q := `SELECT COALESCE(queryid::text, ''), query, calls, mean_time_ms, total_time_ms, rows
			FROM pg_stat_statements ` + where + `
			ORDER BY total_time_ms DESC LIMIT 1000`

	rows, err := conn.QueryContext(ctx, q, args...)
	if err != nil {
		// Missing extension is a common first-run failure.
		return 0, fmt.Errorf("query pg_stat_statements (install the extension on the target server): %w", err)
	}
	defer rows.Close()

	out := []*SlowQuery{}
	for rows.Next() {
		var sq SlowQuery
		var meanTime, totalTime sql.NullFloat64
		var calls, rRows sql.NullInt64
		if err := rows.Scan(&sq.QueryHash, &sq.Query, &calls, &meanTime, &totalTime, &rRows); err != nil {
			return 0, fmt.Errorf("scan pg row: %w", err)
		}
		sq.TenantID = tenantID
		sq.DataSourceID = ds.ID
		sq.DBType = "postgres"
		sq.Schema = ds.Database
		sq.CallCount = calls.Int64
		sq.MeanTime = meanTime.Float64
		sq.TotalTime = totalTime.Float64
		sq.RowsRead = rRows.Int64
		sq.QueryHash = normalizeSQL(sq.Query)
		out = append(out, &sq)
	}
	if err := rows.Err(); err != nil {
		return 0, fmt.Errorf("iterate pg rows: %w", err)
	}
	if err := c.repo.UpsertBatch(ctx, out); err != nil {
		return 0, fmt.Errorf("persist pg rows: %w", err)
	}
	return len(out), nil
}

// collectMySQL pulls rows from performance_schema.events_statements_summary_by_digest.
// This is preferred over the on-disk slow_log because it is always
// available and does not require slow_query_log=ON.
func (c *Collector) collectMySQL(ctx context.Context, tenantID string, ds *dba_models.DataSource, thresholdMs int64, since *time.Time) (int, error) {
	dsn := buildMySQLDSN(ds)
	conn, err := sql.Open("mysql", dsn)
	if err != nil {
		return 0, fmt.Errorf("open mysql: %w", err)
	}
	defer conn.Close()

	if err := conn.PingContext(ctx); err != nil {
		return 0, fmt.Errorf("ping mysql: %w", err)
	}

	// Defense-in-depth: the collector only reads performance_schema.
	// Force the session read-only so a misconfigured account can never
	// write through this connection even if it holds wider grants.
	if _, err := conn.ExecContext(ctx, "SET SESSION TRANSACTION READ ONLY"); err != nil {
		return 0, fmt.Errorf("set mysql session read-only: %w", err)
	}

	// MySQL stores timer_wait in picoseconds (10^-12 s). Convert to ms
	// for the threshold filter (ms -> ps is 1e9). AVG_TIMER_WAIT is
	// already a per-call average, so filtering on it is correct.
	where := "WHERE AVG_TIMER_WAIT >= ?"
	args := []any{thresholdMs * 1e9} // ms -> ps
	if since != nil {
		where += " AND FIRST_SEEN >= ?"
		args = append(args, since.Format(time.RFC3339Nano))
	}

	q := `SELECT DIGEST_TEXT, COUNT_STAR, AVG_TIMER_WAIT/1e9, SUM_TIMER_WAIT/1e9, SUM_ROWS_EXAMINED
			FROM performance_schema.events_statements_summary_by_digest ` + where + `
			ORDER BY SUM_TIMER_WAIT DESC LIMIT 1000`

	rows, err := conn.QueryContext(ctx, q, args...)
	if err != nil {
		return 0, fmt.Errorf("query mysql pfs digest: %w", err)
	}
	defer rows.Close()

	out := []*SlowQuery{}
	for rows.Next() {
		var sq SlowQuery
		var digestText sql.NullString
		var cnt, rRows sql.NullInt64
		var meanTime, totalTime sql.NullFloat64
		if err := rows.Scan(&digestText, &cnt, &meanTime, &totalTime, &rRows); err != nil {
			return 0, fmt.Errorf("scan mysql row: %w", err)
		}
		if !digestText.Valid || strings.TrimSpace(digestText.String) == "" {
			continue
		}
		sq.TenantID = tenantID
		sq.DataSourceID = ds.ID
		sq.DBType = "mysql"
		sq.Schema = ds.Database
		sq.Query = digestText.String
		sq.CallCount = cnt.Int64
		sq.MeanTime = meanTime.Float64
		sq.TotalTime = totalTime.Float64
		sq.RowsRead = rRows.Int64
		sq.QueryHash = normalizeSQL(sq.Query)
		out = append(out, &sq)
	}
	if err := rows.Err(); err != nil {
		return 0, fmt.Errorf("iterate mysql rows: %w", err)
	}
	if err := c.repo.UpsertBatch(ctx, out); err != nil {
		return 0, fmt.Errorf("persist mysql rows: %w", err)
	}
	return len(out), nil
}

// buildPGDSN builds a PostgreSQL DSN from a DataSource. sslmode=require
// enforces TLS so credentials are never sent in cleartext — consistent
// with dba/service and dba/query. Operators who need to disable SSL
// (e.g. for a local dev cluster) can override via the DataSource's
// Properties map in a future enhancement.
func buildPGDSN(ds *dba_models.DataSource) string {
	user := derefString(ds.Username)
	pass := derefString(ds.Password)
	return fmt.Sprintf("host=%s port=%d dbname=%s user=%s password=%s sslmode=require",
		ds.Host, ds.Port, ds.Database, user, pass)
}

// buildMySQLDSN builds a MySQL DSN from a DataSource.
func buildMySQLDSN(ds *dba_models.DataSource) string {
	user := derefString(ds.Username)
	pass := derefString(ds.Password)
	return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?timeout=10s&parseTime=true",
		user, pass, ds.Host, ds.Port, ds.Database)
}

func derefString(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

// normalizeDBType maps a DataSource.Type value ("mysql", "postgres",
// "postgresql", "pg", ...) to one of the two dialects this module
// understands. Empty string means "unsupported".
func normalizeDBType(raw string) string {
	s := strings.ToLower(strings.TrimSpace(raw))
	switch s {
	case "postgres", "postgresql", "pg", "postgre":
		return "postgres"
	case "mysql":
		return "mysql"
	}
	return ""
}
