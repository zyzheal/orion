package models

import "time"

// JobSource represents a source that triggers jobs automatically.
type JobSource struct {
	ID        string     `json:"id" db:"id"`
	TenantID  string     `json:"tenant_id" db:"tenant_id"`
	Name      string     `json:"name" db:"name"`
	Type      string     `json:"type" db:"type"` // "manual", "schedule", "webhook", "api", "event_trigger", "cron", "alert_callback", "pipeline_step", "approval_step", "chat_command"
	Config    string     `json:"config" db:"config"` // JSON
	Enabled   bool       `json:"enabled" db:"enabled"`
	Status    string     `json:"status" db:"status"` // "active", "disabled", "error"
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt time.Time  `json:"updated_at" db:"updated_at"`
}

// JobSourceEvent represents a single event received from a job source.
type JobSourceEvent struct {
	ID          string     `json:"id" db:"id"`
	TenantID    string     `json:"tenant_id" db:"tenant_id"`
	SourceID    string     `json:"source_id" db:"source_id"`
	Payload     string     `json:"payload" db:"payload"` // JSON
	Status      string     `json:"status" db:"status"` // "received", "processed", "failed"
	JobID       string     `json:"job_id" db:"job_id"`
	Error       string     `json:"error" db:"error"`
	ReceivedAt  time.Time  `json:"received_at" db:"received_at"`
	ProcessedAt *time.Time `json:"processed_at" db:"processed_at"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
}

// CreateJobSourceRequest is the request body for creating a job source.
type CreateJobSourceRequest struct {
	Name   string            `json:"name" binding:"required"`
	Type   string            `json:"type" binding:"required"`
	Config map[string]string `json:"config"`
}

// UpdateJobSourceRequest is the request body for partially updating a job source.
type UpdateJobSourceRequest struct {
	Name    *string             `json:"name"`
	Type    *string             `json:"type"`
	Config  *map[string]string  `json:"config"`
	Enabled *bool               `json:"enabled"`
}

// TriggerRequest is the request body for manually triggering a job source.
type TriggerRequest struct {
	Payload map[string]interface{} `json:"payload"`
}
