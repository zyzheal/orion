package models

import "time"

// JobStatus represents the lifecycle of a scheduled job.
type JobStatus string

const (
	JobActive   JobStatus = "active"
	JobPaused   JobStatus = "paused"
	JobDisabled JobStatus = "disabled"
)

// JobType represents the type of scheduled job.
type JobType string

const (
	JobTypeCron     JobType = "cron"
	JobTypeOnce     JobType = "once"
	JobTypeInterval JobType = "interval"
)

// Job represents a scheduled job.
type Job struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenant_id"`
	Name         string    `db:"name" json:"name"`
	Description  string    `db:"description" json:"description"`
	Type         JobType   `db:"type" json:"type"`
	CronExpr     *string   `db:"cron_expr" json:"cron_expr,omitempty"`
	IntervalSec  *int      `db:"interval_sec" json:"interval_sec,omitempty"`
	Status       JobStatus `db:"status" json:"status"`
	LastRunAt    *time.Time `db:"last_run_at" json:"last_run_at,omitempty"`
	NextRunAt    *time.Time `db:"next_run_at" json:"next_run_at,omitempty"`
	RunCount     int       `db:"run_count" json:"run_count"`
	MaxRuns      *int      `db:"max_runs" json:"max_runs,omitempty"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
}

// JobRun represents a single execution of a job.
type JobRun struct {
	ID        string    `db:"id" json:"id"`
	JobID     string    `db:"job_id" json:"job_id"`
	Status    string    `db:"status" json:"status"`
	Error     *string   `db:"error" json:"error,omitempty"`
	StartedAt time.Time `db:"started_at" json:"started_at"`
	EndedAt   *time.Time `db:"ended_at" json:"ended_at,omitempty"`
	DurationMs int64    `db:"duration_ms" json:"duration_ms"`
}

// CreateJobRequest is the input for creating a scheduled job.
type CreateJobRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description string  `json:"description"`
	Type        JobType `json:"type" binding:"required"`
	CronExpr    *string `json:"cron_expr"`
	IntervalSec *int    `json:"interval_sec"`
	MaxRuns     *int    `json:"max_runs"`
}

// UpdateJobRequest is the input for updating a scheduled job.
type UpdateJobRequest struct {
	Name        *string  `json:"name"`
	Description *string  `json:"description"`
	CronExpr    *string  `json:"cron_expr"`
	IntervalSec *int     `json:"interval_sec"`
	MaxRuns     *int     `json:"max_runs"`
	Status      *JobStatus `json:"status"`
}

// PaginatedRequest provides pagination parameters.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}
