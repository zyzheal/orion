// Package slowquery collects, persists, and analyzes slow SQL queries
// across supported data sources (PostgreSQL + MySQL). It replaces the
// legacy pattern of "read slow_log manually from a shell" with a
// governed service that:
//
//   1. pulls rows from pg_stat_statements / mysql.slow_log,
//   2. dedupes by a stable SQL signature (normalized whitespace),
//   3. exposes Top-N endpoints for DBA review, and
//   4. runs a rule-based analyzer that suggests concrete optimizations.
//
// The analyzer is intentionally heuristic (regex + keyword checks) so
// it works with no external dependencies. LLM-based analysis is added
// later via the advisor module; this module owns the deterministic
// surface.
package slowquery

import "time"

// ---- SlowQuery record ----

// SlowQuery is a single collected row from a data source. It is
// stored verbatim in the slowquery_records table so DBAs can correlate
// their findings with a specific data source at a specific time.
type SlowQuery struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenant_id" db:"tenant_id"`
	DataSourceID string    `json:"data_source_id" db:"data_source_id"`
	DBType       string    `json:"db_type" db:"db_type"` // "postgres" | "mysql"
	Schema       string    `json:"schema" db:"schema"`
	Query        string    `json:"query" db:"query"`
	QueryHash    string    `json:"query_hash" db:"query_hash"` // normalized SQL
	CallCount    int64     `json:"call_count" db:"call_count"`
	MeanTime     float64   `json:"mean_time_ms" db:"mean_time_ms"`
	TotalTime    float64   `json:"total_time_ms" db:"total_time_ms"`
	RowsRead     int64     `json:"rows_read" db:"rows_read"`
	RowsReturned int64     `json:"rows_returned" db:"rows_returned"`
	CollectedAt  time.Time `json:"collected_at" db:"collected_at"`
}

// ---- Analysis results ----

// Suggestion is one optimization hint returned by Analyze. Category
// buckets the suggestion so the UI can group them; Severity is one of
// critical/high/medium/low/info and matches the aireview severity set
// for consistency.
type Suggestion struct {
	Category    string `json:"category"`
	Severity    string `json:"severity"`
	Title       string `json:"title"`
	Description string `json:"description"`
	FixedSQL    string `json:"fixed_sql,omitempty"`
}

// AnalysisResult is the full output of Analyze. Suggestion count is
// stable so callers can rely on len(Suggestions) for progress meters.
type AnalysisResult struct {
	SQL          string       `json:"sql"`
	QueryHash    string       `json:"query_hash"`
	DBType       string       `json:"db_type"`
	Suggestions  []Suggestion `json:"suggestions"`
	Passed       bool         `json:"passed"`
	AnalyzedAt   time.Time    `json:"analyzed_at"`
}

// ---- Requests ----

// CollectRequest kicks off a collection pass against a data source.
// Since is optional — when omitted the collector uses the data source's
// own configured slow-log threshold.
type CollectRequest struct {
	DataSourceID string     `json:"data_source_id" binding:"required"`
	ThresholdMs  int64      `json:"threshold_ms"`
	Since        *time.Time `json:"since,omitempty"`
}

// TopNRequest filters the Top-N endpoint. Limit caps the number of
// rows returned (default 50, max 500). TenantID is set by the handler
// from the auth context — never trusted from the client.
type TopNRequest struct {
	DataSourceID string     `json:"data_source_id" binding:"required"`
	TenantID     string     `json:"-"`
	Limit        int        `json:"limit"`
	Since        *time.Time `json:"since,omitempty"`
	OrderBy      string     `json:"order_by"` // "total_time_ms" (default) | "mean_time_ms" | "rows_read"
}

// AnalyzeRequest submits one SQL string for heuristic review. The
// analyzer is stateless — the SQL is analyzed on the fly and the
// result is not persisted (callers can persist it if they want).
type AnalyzeRequest struct {
	SQL      string `json:"sql" binding:"required"`
	DBType   string `json:"db_type"` // defaults to "postgres"
	Schema   string `json:"schema"`
	RowsRead int64  `json:"rows_read"`
}
