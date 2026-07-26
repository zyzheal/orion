package models

import "time"

// Task represents a task to be executed.
type Task struct {
	ID          string            `json:"id"`
	TenantID    string            `json:"tenant_id"`
	Type        string            `json:"type"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Input       map[string]interface{} `json:"input"`
	Output      map[string]interface{} `json:"output"`
	Status      string            `json:"status"` // pending, running, completed, failed, cancelled
	TimeoutSec  int               `json:"timeout_sec"`
	CreatedAt   time.Time         `json:"created_at"`
	CompletedAt *time.Time        `json:"completed_at"`
}

// CreateTaskRequest for creating a task.
type CreateTaskRequest struct {
	Type        string                 `json:"type" binding:"required"`
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description"`
	Input       map[string]interface{} `json:"input"`
	TimeoutSec  int                    `json:"timeout_sec"`
}

// TaskResponse wraps task query results.
type TaskResponse struct {
	Total int64  `json:"total"`
	Data  []Task `json:"data"`
}

// ExecuteRequest for executing a task.
type ExecuteRequest struct {
	TaskID string                 `json:"task_id" binding:"required"`
	Input  map[string]interface{} `json:"input"`
}
