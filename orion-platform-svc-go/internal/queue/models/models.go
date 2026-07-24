package models

import "time"

// Queue represents a queue record.
type Queue struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Value     string    `json:"value" db:"value"`
	Enabled   bool      `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type CreateQueueRequest struct {
	Name    string `json:"name" binding:"required"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
}

type UpdateQueueRequest struct {
	Name    *string `json:"name"`
	Value   *string `json:"value"`
	Enabled *bool   `json:"enabled"`
}

// ===== Job models =====

// Job represents a job in the task queue.
type Job struct {
	ID          string                 `json:"id" db:"id"`
	TenantID    string                 `json:"tenant_id" db:"tenant_id"`
	QueueName   string                 `json:"queueName" db:"queue_name"`
	Type        string                 `json:"type" db:"job_type"`
	Status      string                 `json:"status" db:"status"`
	Priority    int                    `json:"priority" db:"priority"`
	Payload     map[string]interface{} `json:"payload" db:"payload"`
	Result      map[string]interface{} `json:"result,omitempty" db:"result"`
	Attempts    int                    `json:"attempts" db:"attempts"`
	CreatedAt   int64                  `json:"createdAt" db:"created_at"`
	UpdatedAt   int64                  `json:"updatedAt" db:"updated_at"`
}

// EnqueueJobRequest is the request body for enqueuing a new job.
type EnqueueJobRequest struct {
	Type         string                 `json:"type" binding:"required"`
	Payload      map[string]interface{} `json:"payload"`
	Priority     int                    `json:"priority"`
	DelaySeconds int                    `json:"delaySeconds"`
}

// DequeueRequest is the request body for dequeuing a job.
type DequeueRequest struct {
	TimeoutSeconds int `json:"timeoutSeconds"`
}

// CompleteJobRequest is the request body for completing a job.
type CompleteJobRequest struct {
	Result map[string]interface{} `json:"result"`
}

// JobStatus constants
const (
	JobStatusPending    = "pending"
	JobStatusExecuting  = "executing"
	JobStatusCompleted  = "completed"
	JobStatusFailed     = "failed"
	JobStatusCancelled  = "cancelled"
)
