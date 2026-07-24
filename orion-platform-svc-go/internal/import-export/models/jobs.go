package models

import "time"

// Job represents a persisted import or export operation record.
//
// A single job tracks the full lifecycle: creation → processing → completion/failure,
// including progress and aggregated result counts.
type Job struct {
	ID           string            `json:"id" db:"id"`
	TenantID     string            `json:"tenant_id" db:"tenant_id"`
	UserID       string            `json:"user_id" db:"user_id"`
	DataType     string            `json:"data_type" db:"data_type"`
	Operation    string            `json:"operation" db:"operation"` // "import" | "export"
	Status       string            `json:"status" db:"status"`       // pending, processing, completed, failed, cancelled
	Format       string            `json:"format" db:"format"`       // csv, json, excel
	SourceName   string            `json:"source_name" db:"source_name"`
	OutputName   string            `json:"output_name" db:"output_name"`
	ErrorCount   int               `json:"error_count" db:"error_count"`
	SuccessCount int               `json:"success_count" db:"success_count"`
	TotalCount   int               `json:"total_count" db:"total_count"`
	Progress     float64           `json:"progress" db:"progress"`
	ProgressMsg  string            `json:"progress_msg" db:"progress_msg"`
	Message      string            `json:"message,omitempty" db:"message"`
	Metadata     map[string]any    `json:"metadata,omitempty" db:"metadata"`
	CreatedAt    time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at" db:"updated_at"`
	FinishedAt   *time.Time        `json:"finished_at,omitempty" db:"finished_at"`
}

// ValidationError records one row-level validation failure during import.
//
// Each error is linked to the parent Job via JobID so they can be queried together.
type ValidationError struct {
	ID        string    `json:"id" db:"id"`
	JobID     string    `json:"job_id" db:"job_id"`
	RowNumber int       `json:"row_number" db:"row_number"`
	Field     string    `json:"field" db:"field"`
	Message   string    `json:"message" db:"message"`
	RawValue  string    `json:"raw_value" db:"raw_value"`
	ErrType   string    `json:"error_type" db:"error_type"` // "missing_field" | "invalid_format" | "constraint" | "other"
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// ImportOpts controls how import is performed.
type ImportOpts struct {
	// Format is the source data format: "csv", "json", "excel".
	Format string
	// HeaderRow indicates whether the first row is a header (CSV/Excel).
	HeaderRow bool
	// SkipRows is the number of rows to skip before data rows start.
	SkipRows int
	// BatchSize is the rows-per-batch limit for inserts; 0 means the default (500).
	BatchSize int
	// OnError: "abort" stops the import on first error, "continue" logs and proceeds.
	OnError string
	// Overwrite replaces existing rows by their primary key.
	Overwrite bool
	// DryRun validates only and never writes data.
	DryRun bool
	// UserID of the operator who triggered the import.
	UserID string
	// TenantID of the target tenant.
	TenantID string
}

// ExportOpts controls how export is performed.
type ExportOpts struct {
	// Format is the target format: "csv", "json", "excel".
	Format string
	// Headers includes a header row in the output (CSV/Excel).
	Headers bool
	// SheetName is the Excel sheet name; ignored for CSV/JSON.
	SheetName string
	// UserID of the operator who triggered the export.
	UserID string
	// TenantID of the target tenant.
	TenantID string
}

// ExportMetadata is returned alongside export payloads for async workflows.
type ExportMetadata struct {
	JobID     string    `json:"jobId"`
	Filename  string    `json:"filename"`
	Format    string    `json:"format"`
	RowCount  int       `json:"rowCount"`
	DataType  string    `json:"dataType"`
	CreatedAt time.Time `json:"createdAt"`
}

// ImportResult is the value returned by ImportHandler.Import().
type ImportResult struct {
	JobID        string          `json:"jobId"`
	SuccessCount int             `json:"successCount"`
	ErrorCount   int             `json:"errorCount"`
	TotalCount   int             `json:"totalCount"`
	Errors       []ValidationError `json:"errors,omitempty"`
	Mode         string          `json:"mode"` // "sync" | "async"
	Message      string          `json:"message"`
}

// JobFilter controls how jobs are listed.
type JobFilter struct {
	TenantID  string
	UserID    string
	DataType  string
	Operation string // "import" | "export"
	Status    string
}
