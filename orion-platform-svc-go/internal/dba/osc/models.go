// Package osc implements Online Schema Change (OSC) for MySQL via gh-ost.
//
// gh-ost is the industry-standard tool for lock-free schema migrations on
// MySQL. It works by:
//  1. Creating a shadow "ghost" table with the desired schema.
//  2. Copying data from the original table to the ghost table in chunks.
//  3. Tailing the binlog to apply concurrent writes to the ghost table.
//  4. Swapping the ghost table into place with a brief lock on cutover.
//
// This package wraps gh-ost as a subprocess, exposes lifecycle operations
// via HTTP, and persists job metadata in PostgreSQL for auditing.
package osc

import "time"

// Job status values persisted in dba_osc_jobs.status.
const (
	StatusPending   = "pending"
	StatusRunning   = "running"
	StatusCompleted = "completed"
	StatusFailed    = "failed"
	StatusCancelled = "cancelled"
)

// Cutover modes accepted by gh-ost.
const (
	CutoverTwoStep = "two-step"
	CutoverAtomic  = "atomic"
	CutoverInstant = "instant"
)

// OSCJob represents a persisted online schema change job.
//
// The DataSourceID is a foreign reference into dba_data_sources; we do not
// snapshot credentials onto the job record because gh-ost is short-lived
// and re-fetching credentials per job keeps secret rotation safe.
type OSCJob struct {
	ID             string         `json:"id" db:"id"`
	TenantID       string         `json:"tenant_id" db:"tenant_id"`
	UserID         string         `json:"user_id" db:"user_id"`
	DataSourceID   string         `json:"data_source_id" db:"data_source_id"`
	Table          string         `json:"table" db:"table"`
	AlterSQL       string         `json:"alter_sql" db:"alter_sql"`
	Status         string         `json:"status" db:"status"`
	DryRun         bool           `json:"dry_run" db:"dry_run"`
	CutoverMode    string         `json:"cutover_mode" db:"cutover_mode"`
	MaxLagMillis   int            `json:"max_lag_millis" db:"max_lag_millis"`
	ChunkSize      int            `json:"chunk_size" db:"chunk_size"`
	ErrorMessage   *string        `json:"error_message,omitempty" db:"error_message"`
	Log            string         `json:"log" db:"log"`
	RowsAffected   *int64         `json:"rows_affected,omitempty" db:"rows_affected"`
	MaxLagObserved *int64         `json:"max_lag_observed,omitempty" db:"max_lag_observed"`
	Duration       *int64         `json:"duration_ms,omitempty" db:"duration_ms"`
	CreatedAt      time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at" db:"updated_at"`
	StartedAt      *time.Time     `json:"started_at,omitempty" db:"started_at"`
	FinishedAt     *time.Time     `json:"finished_at,omitempty" db:"finished_at"`
}

// CreateOSCJobInput is the request payload for creating a new OSC job.
type CreateOSCJobInput struct {
	DataSourceID string `json:"data_source_id" binding:"required"`
	Table        string `json:"table" binding:"required"`
	AlterSQL     string `json:"alter_sql" binding:"required"`
	DryRun       bool   `json:"dry_run"`
	CutoverMode  string `json:"cutover_mode"`
	MaxLagMillis int    `json:"max_lag_millis"`
	ChunkSize    int    `json:"chunk_size"`
}

// DryRunRequest runs a dry-run plan against a data source without
// persisting a job. It is used to validate credentials and gh-ost
// connectivity before committing to a full migration.
type DryRunRequest struct {
	DataSourceID string `json:"data_source_id" binding:"required"`
	Table        string `json:"table" binding:"required"`
	AlterSQL     string `json:"alter_sql" binding:"required"`
}

// DryRunResult is the response payload for a dry-run.
type DryRunResult struct {
	Success   bool     `json:"success"`
	Message   string   `json:"message"`
	Duration  int64    `json:"duration_ms"`
	Log       []string `json:"log"`
	ExitCode  *int     `json:"exit_code,omitempty"`
}

// OSCStatus is the state snapshot returned by the service layer.
// Unlike GhOstStatus (raw gh-ost API data) it carries tenant-scoped context.
type OSCStatus struct {
	Job       OSCJob            `json:"job"`
	GhOst     *GhOstStatus      `json:"gh_ost,omitempty"`
	Reachable bool              `json:"reachable"`
	ReachableError string        `json:"reachable_error,omitempty"`
}

// OSCJobListResult wraps the paginated response.
type OSCJobListResult struct {
	Data  []OSCJob `json:"data"`
	Total int      `json:"total"`
	Page  int      `json:"page"`
	Limit int      `json:"limit"`
}

// OSCListQuery is the query string filter set for ListJobs.
type OSCListQuery struct {
	Status string
	Page   int
	Limit  int
}
