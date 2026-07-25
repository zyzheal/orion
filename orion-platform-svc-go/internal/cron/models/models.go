package models

import "time"

// CronJob represents a scheduled cron task.
type CronJob struct {
	ID          string     `json:"id" db:"id"`
	TenantID    string     `json:"tenant_id" db:"tenant_id"`
	Name        string     `json:"name" db:"name"`
	Schedule    string     `json:"schedule"`
	Task        string     `json:"task"`
	Description string     `json:"description"`
	Enabled     bool       `json:"enabled"`
	Status      string     `json:"status"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
}

// CreateCronJobRequest is the request body for creating a cron job.
type CreateCronJobRequest struct {
	Name        string `json:"name" binding:"required"`
	Schedule    string `json:"schedule" binding:"required"`
	Task        string `json:"task" binding:"required"`
	Description string `json:"description"`
	Enabled     *bool  `json:"enabled"`
}

// UpdateCronJobRequest is the request body for partially updating a cron job.
type UpdateCronJobRequest struct {
	Name        *string `json:"name"`
	Schedule    *string `json:"schedule"`
	Task        *string `json:"task"`
	Description *string `json:"description"`
	Enabled     *bool   `json:"enabled"`
}

// CronJobExecution represents a single execution of a cron job.
type CronJobExecution struct {
	ExecutionID string     `json:"execution_id" db:"execution_id"`
	JobID       string     `json:"job_id" db:"job_id"`
	TenantID    string     `json:"tenant_id" db:"tenant_id"`
	Status      string     `json:"status" db:"status"`
	Output      string     `json:"output" db:"output"`
	StartedAt   time.Time  `json:"started_at" db:"started_at"`
	FinishedAt  *time.Time `json:"finished_at" db:"finished_at"`
}

// JobDefinition represents a scheduled job definition (scheduler_job_definitions table).
type JobDefinition struct {
	ID          string     `json:"id" db:"id"`
	TenantID    string     `json:"tenant_id" db:"tenant_id"`
	Name        string     `json:"name" db:"name"`
	CronExpr    string     `json:"cron_expr" db:"cron_expr"`
	JobType     string     `json:"job_type" db:"job_type"`
	Config      string     `json:"config" db:"config"`
	Status      string     `json:"status" db:"status"`
	LastRunAt   *time.Time `json:"last_run_at" db:"last_run_at"`
	NextRunAt   *time.Time `json:"next_run_at" db:"next_run_at"`
	MaxRetries  int        `json:"max_retries" db:"max_retries"`
	TimeoutSec  int        `json:"timeout_sec" db:"timeout_sec"`
	Enabled     bool       `json:"enabled" db:"enabled"`
	Error       string     `json:"error" db:"error"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
}

// JobExecutionLog represents a single execution log of a job (scheduler_job_execution_logs table).
type JobExecutionLog struct {
	ID         string     `json:"id" db:"id"`
	JobID      string     `json:"job_id" db:"job_id"`
	Status     string     `json:"status" db:"status"`
	Output     string     `json:"output" db:"output"`
	Error      string     `json:"error" db:"error"`
	DurationMs int64      `json:"duration_ms" db:"duration_ms"`
	StartedAt  time.Time  `json:"started_at" db:"started_at"`
	FinishedAt *time.Time `json:"finished_at" db:"finished_at"`
}
