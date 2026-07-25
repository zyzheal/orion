// Package models defines data models for the CMDB Import service.
// The CMDB Import service provides a pluggable data import pipeline for
// loading CMDB configuration items (CI), relations, and attributes from
// various source formats (CSV, Excel, JSON, YAML, API, DB, SFTP).
//
// Data flow:
//   1. Create import job with source config and field mapping
//   2. Start job → manager dispatches to matching IImportHandler
//   3. Handler parses, validates, and returns structured rows
//   4. Each row produces a CMDBImportRecord (created/updated/skipped/failed)
//   5. Job transitions to completed/failed with aggregate counts
//
// Tables: cmdb_import_jobs, cmdb_import_records
package models

import (
	"time"
)

// ===========================================================================
// CMDB Import Job — a single import execution tracked end-to-end
// ===========================================================================

// CMDBImportJob represents one import execution.
type CMDBImportJob struct {
	ID           string     `db:"id"`
	TenantID     string     `db:"tenant_id"`
	Name         string     `db:"name"`
	SourceType   string     `db:"source_type"`   // csv | excel | json | yaml | api | db | sftp
	SourcePath   string     `db:"source_path"`
	TargetType   string     `db:"target_type"`   // ci | relation | attribute
	Mapping      string     `db:"mapping"`       // JSON string: field mapping
	Mode         string     `db:"mode"`          // create | update | upsert | merge
	Status       string     `db:"status"`        // pending | running | completed | failed | cancelled
	TotalCount   int        `db:"total_count"`
	SuccessCount int        `db:"success_count"`
	ErrorCount   int        `db:"error_count"`
	Error        string     `db:"error"`
	StartedAt    time.Time  `db:"started_at"`
	FinishedAt   *time.Time `db:"finished_at"`
	CreatedAt    time.Time  `db:"created_at"`
}

// JobStatus is the lifecycle state of an import job.
type JobStatus string

const (
	JobStatusPending   JobStatus = "pending"
	JobStatusRunning   JobStatus = "running"
	JobStatusCompleted JobStatus = "completed"
	JobStatusFailed    JobStatus = "failed"
	JobStatusCancelled JobStatus = "cancelled"
)

// ValidJobStatuses is the set of valid job statuses.
var ValidJobStatuses = map[JobStatus]bool{
	JobStatusPending:   true,
	JobStatusRunning:   true,
	JobStatusCompleted: true,
	JobStatusFailed:    true,
	JobStatusCancelled: true,
}

// ValidStatusTransitions defines allowed forward-progress transitions.
var ValidStatusTransitions = map[JobStatus][]JobStatus{
	JobStatusPending:  {JobStatusRunning, JobStatusCancelled},
	JobStatusRunning:  {JobStatusCompleted, JobStatusFailed, JobStatusCancelled},
	JobStatusCompleted: {}, // terminal
	JobStatusFailed:    {}, // terminal
	JobStatusCancelled: {}, // terminal
}

// ValidSourceTypes defines allowed source types for import.
var ValidSourceTypes = map[string]bool{
	"csv":   true,
	"excel": true,
	"json":  true,
	"yaml":  true,
	"api":   true,
	"db":    true,
	"sftp":  true,
}

// ValidTargetTypes defines allowed target entity types.
var ValidTargetTypes = map[string]bool{
	"ci":        true,
	"relation":  true,
	"attribute": true,
}

// ValidImportModes defines allowed import modes.
var ValidImportModes = map[string]bool{
	"create": true,
	"update": true,
	"upsert": true,
	"merge":  true,
}

// ===========================================================================
// CMDB Import Record — per-row result of an import job
// ===========================================================================

// CMDBImportRecord tracks the result of a single row during import.
type CMDBImportRecord struct {
	ID        string    `db:"id"`
	JobID     string    `db:"job_id"`
	SourceRow string    `db:"source_row"` // JSON string: raw source row data
	TargetID  string    `db:"target_id"`  // resulting CMDB entity ID (if successful)
	Action    string    `db:"action"`     // created | updated | skipped | failed
	Error     string    `db:"error"`
	CreatedAt time.Time `db:"created_at"`
}

// ValidRecordActions defines allowed record actions.
var ValidRecordActions = map[string]bool{
	"created": true,
	"updated": true,
	"skipped": true,
	"failed":  true,
}

// ===========================================================================
// Request/Response types
// ===========================================================================

// CreateImportJobRequest is the request payload for creating an import job.
type CreateImportJobRequest struct {
	Name       string            `json:"name" binding:"required"`
	SourceType string            `json:"source_type" binding:"required"` // csv|excel|json|yaml|api|db|sftp
	SourcePath string            `json:"source_path" binding:"required"`
	TargetType string            `json:"target_type" binding:"required"` // ci|relation|attribute
	Mode       string            `json:"mode"`                           // create|update|upsert|merge
	Mapping    map[string]string `json:"mapping"`                        // field mapping
	Config     map[string]string `json:"config"`                         // source-specific config
}

// ValidateImportRequest is the request payload for validating a source before import.
type ValidateImportRequest struct {
	SourceType string            `json:"source_type" binding:"required"`
	SourcePath string            `json:"source_path" binding:"required"`
	Mapping    map[string]string `json:"mapping"`
	Config     map[string]string `json:"config"`
}

// ValidateImportResponse is the response from validation.
type ValidateImportResponse struct {
	Valid        bool    `json:"valid"`
	RowCount     int     `json:"row_count"`
	Columns      []string `json:"columns"`
	MappingHints []string `json:"mapping_hints"`
	Errors       []string `json:"errors"`
}

// PaginatedRequest holds pagination parameters.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

// Offset returns the SQL OFFSET value, applying defaults.
func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

// Limit returns the SQL LIMIT value, capping at 100.
func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}
