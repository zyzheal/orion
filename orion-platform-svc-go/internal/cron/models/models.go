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
