package models

import "time"

// --- Command Execution ---

type CommandLog struct {
	ID        string    `json:"id" db:"id"`
	Command   string    `json:"command" db:"command"`
	HostIDs   string    `json:"host_ids" db:"host_ids"`
	HostCount int       `json:"host_count" db:"host_count"`
	Timeout   int       `json:"timeout" db:"timeout"`
	Status    string    `json:"status" db:"status"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type CommandLogDetail struct {
	ID        string `json:"id" db:"id"`
	CommandID string `json:"command_id" db:"command_id"`
	Hostname  string `json:"hostname" db:"hostname"`
	Output    string `json:"output" db:"output"`
	ErrorOutput string `json:"error_output" db:"error_output"`
	ExitCode  int    `json:"exit_code" db:"exit_code"`
	Status    string `json:"status" db:"status"`
}

// --- Script Templates ---

type Template struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Content     string    `json:"content" db:"content"`
	Category    string    `json:"category" db:"category"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type CreateTemplateRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description *string `json:"description"`
	Content     string  `json:"content" binding:"required"`
	Category    *string `json:"category"`
}

type UpdateTemplateRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Content     *string `json:"content"`
	Category    *string `json:"category"`
}

// --- Cron Jobs ---

type CronJob struct {
	ID             string     `json:"id" db:"id"`
	Name           string     `json:"name" db:"name"`
	Command        string     `json:"command" db:"command"`
	HostIDs        string     `json:"host_ids" db:"host_ids"`
	Hostnames      string     `json:"hostnames" db:"hostnames"`
	CronExpression string     `json:"cron_expression" db:"cron_expression"`
	Enabled        bool       `json:"enabled" db:"enabled"`
	LastRunAt      *time.Time `json:"last_run_at,omitempty" db:"last_run_at"`
	NextRunAt      *time.Time `json:"next_run_at,omitempty" db:"next_run_at"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
}

type CreateCronJobRequest struct {
	Name           string   `json:"name" binding:"required"`
	Command        string   `json:"command" binding:"required"`
	HostIDs        []string `json:"host_ids" binding:"required"`
	CronExpression string   `json:"cron_expression" binding:"required"`
	Enabled        *bool    `json:"enabled"`
}

type UpdateCronJobRequest struct {
	Name           *string  `json:"name"`
	Command        *string  `json:"command"`
	HostIDs        []string `json:"host_ids"`
	CronExpression *string  `json:"cron_expression"`
	Enabled        *bool    `json:"enabled"`
}

type ToggleCronJobRequest struct {
	Enabled bool `json:"enabled"`
}

// --- Cron Job Logs ---

type CronJobLog struct {
	ID        string    `json:"id" db:"id"`
	JobID     string    `json:"job_id" db:"job_id"`
	CommandID string    `json:"command_id" db:"command_id"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// --- Upload Tasks ---

type UploadTask struct {
	ID         string    `json:"id" db:"id"`
	FileName   string    `json:"file_name" db:"file_name"`
	FileSize   int64     `json:"file_size" db:"file_size"`
	HostIDs    string    `json:"host_ids" db:"host_ids"`
	Hostnames  string    `json:"hostnames" db:"hostnames"`
	TargetPath string    `json:"target_path" db:"target_path"`
	Status     string    `json:"status" db:"status"`
	Progress   int       `json:"progress" db:"progress"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

type CreateUploadTaskRequest struct {
	FileName   *string  `json:"file_name"`
	FileSize   *int64   `json:"file_size"`
	HostIDs    []string `json:"host_ids" binding:"required"`
	TargetPath string   `json:"target_path" binding:"required"`
}

type UpdateUploadTaskRequest struct {
	Status *string `json:"status"`
}

// --- Request / Response ---

type PaginatedResult struct {
	Total    int `json:"total"`
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
}
