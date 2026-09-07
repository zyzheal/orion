// Package query provides paginated SQL query execution and asynchronous
// Excel export for the DBA module. It layers on top of the existing
// ExecuteDirectQuery logic but adds:
//
//  1. Cursor-based pagination so callers can page through large results
//     without triggering an OOM on the server (see pagination.go).
//  2. Asynchronous Excel export via excelize: the caller submits a job,
//     receives a JobID, and polls GetExportStatus until the file URL
//     is available (see exporter.go and service.go).
//
// The module never surfaces raw filesystem paths to callers — every
// response carries either an opaque signed-URL string or an empty value.
package query

import "time"

// ---- Pagination request/response ----

// DefaultPageSize is used when the caller does not specify PageSize.
const DefaultPageSize = 100

// MaxPageSize bounds a single page so a caller cannot request an
// unreasonably large result set that would exhaust server memory.
const MaxPageSize = 10000

// DefaultTimeoutMs is applied when TimeoutMs is zero or negative.
const DefaultTimeoutMs = 30000

// MaxTimeoutMs bounds query duration; beyond this the audit engine
// would need to escalate the request.
const MaxTimeoutMs = 300000

// PagedQueryRequest is the JSON payload for POST /query/paged.
type PagedQueryRequest struct {
	// SQL is the raw SELECT statement. It is re-validated by the
	// inception LocalAuditEngine.Check before execution.
	SQL string `json:"sql" binding:"required"`
	// DataSourceID selects the target PostgreSQL/MySQL connection.
	DataSourceID string `json:"data_source_id" binding:"required"`
	// PageToken is the opaque cursor returned by a previous call.
	// Empty means "first page".
	PageToken string `json:"page_token,omitempty"`
	// PageSize defaults to DefaultPageSize and is capped at MaxPageSize.
	PageSize int `json:"page_size,omitempty"`
	// TimeoutMs defaults to DefaultTimeoutMs and is capped at MaxTimeoutMs.
	TimeoutMs int `json:"timeout_ms,omitempty"`
}

// PagedQueryResult is the response for POST /query/paged. Rows is
// shaped as [][]interface{} (row-major) rather than a slice of maps so
// column names can be shared once at the top level and memory per row
// is minimal.
type PagedQueryResult struct {
	Columns       []QueryColumn  `json:"columns"`
	Rows          [][]interface{} `json:"rows"`
	// Total is an estimated row count. It is only populated when the
	// caller passes a SQL pattern the module can wrap in a count()
	// probe; otherwise it is 0 and callers must rely on NextPageToken.
	Total int64 `json:"total,omitempty"`
	// NextPageToken is empty when there are no more rows.
	NextPageToken string `json:"next_page_token,omitempty"`
	// QueryMs is the wall-clock duration of this single page fetch.
	QueryMs int64 `json:"query_ms"`
	// Truncated is true when the query hit its timeout while scanning
	// and the module stopped early to return what it had.
	Truncated bool `json:"truncated,omitempty"`
}

// QueryColumn describes a single column returned by the query.
type QueryColumn struct {
	// Name is the column identifier as returned by the driver.
	Name string `json:"name"`
	// DataType is a driver-independent short label ("int64", "string",
	// "float64", "bool", "time", "[]byte", "null"). Useful for the
	// frontend to render values without guessing.
	DataType string `json:"data_type"`
}

// ---- Export request/response ----

// DefaultExportMaxRows is applied when ExportRequest.MaxRows is 0.
const DefaultExportMaxRows = 100000

// MaxExportMaxRows is the hard ceiling for a single export job.
const MaxExportMaxRows = 1000000

// DefaultExportTimeoutMs bounds the wall-clock time an export job may
// spend scanning rows. When exceeded the job finishes as "completed"
// with Truncated=true so callers know the file is partial.
const DefaultExportTimeoutMs = 300000

// ExportRequest is the JSON payload for POST /query/export.
type ExportRequest struct {
	SQL          string `json:"sql" binding:"required"`
	DataSourceID string `json:"data_source_id" binding:"required"`
	// MaxRows bounds the row count the exporter will write. Default
	// 100_000, hard ceiling MaxExportMaxRows.
	MaxRows int `json:"max_rows,omitempty"`
	// TimeoutMs bounds scan duration. Default 300_000.
	TimeoutMs int `json:"timeout_ms,omitempty"`
}

// ExportResult is the async job state returned by POST /query/export
// and GET /query/export/:id. Callers poll until Status is "completed"
// or "failed", then use FileURL to download the artifact.
type ExportResult struct {
	JobID  string `json:"id"`
	Status string `json:"status"`
	// FileURL is the signed URL of the produced .xlsx file. Empty
	// while Status is "pending" or "running"; populated once "completed".
	FileURL string `json:"file_url,omitempty"`
	// RowsExported is the number of rows actually written to the file.
	RowsExported int `json:"rows_exported,omitempty"`
	// Truncated is true when the job finished early because of
	// TimeoutMs or MaxRows.
	Truncated bool `json:"truncated,omitempty"`
	// Error holds a human-readable failure reason. Empty on success.
	Error string `json:"error,omitempty"`
	// CreatedAt / UpdatedAt let the client detect stale pending jobs.
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Export job status constants. Status progresses monotonically:
// pending -> running -> completed|failed. It never leaves terminal state.
const (
	ExportStatusPending   = "pending"
	ExportStatusRunning   = "running"
	ExportStatusCompleted = "completed"
	ExportStatusFailed    = "failed"
)

// Export status terminal check helpers used by the handler.
func (r *ExportResult) IsTerminal() bool {
	return r != nil && (r.Status == ExportStatusCompleted || r.Status == ExportStatusFailed)
}
