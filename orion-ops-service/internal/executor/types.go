package executor

import (
	"time"
)

// TaskStatus represents the status of a batch task
type TaskStatus string

const (
	TaskStatusPending   TaskStatus = "PENDING"
	TaskStatusRunning   TaskStatus = "RUNNING"
	TaskStatusCompleted TaskStatus = "COMPLETED"
	TaskStatusFailed    TaskStatus = "FAILED"
	TaskStatusCancelled TaskStatus = "CANCELLED"
)

// Task represents a batch execution task
type Task struct {
	ID          string      `json:"id" gorm:"primaryKey"`
	TenantID    int64       `json:"tenant_id" gorm:"index"`
	UserID      string      `json:"user_id" gorm:"index"`
	Name        string      `json:"name"`
	Command     string      `json:"command"`
	HostIDs     string      `json:"host_ids"` // JSON array of host IDs
	Status      TaskStatus  `json:"status" gorm:"default:PENDING"`
	Progress    int         `json:"progress"` // 0-100
	TotalHosts  int         `json:"total_hosts"`
	SuccessCount int        `json:"success_count"`
	FailedCount  int        `json:"failed_count"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
	StartedAt   *time.Time `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at"`
}

// TaskResult represents the result of executing on a single host
type TaskResult struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	TaskID      string    `json:"task_id" gorm:"index"`
	HostID      string    `json:"host_id" gorm:"index"`
	HostName    string    `json:"host_name"`
	HostIP      string    `json:"host_ip"`
	ExitCode    int       `json:"exit_code"`
	Output      string    `json:"output"`
	Error       string    `json:"error"`
	Status      TaskStatus `json:"status"`
	ExecutedAt  time.Time `json:"executed_at"`
	DurationMs  int64     `json:"duration_ms"`
}

// ExecuteBatchInput represents the input for batch execution
type ExecuteBatchInput struct {
	TenantID int64    `json:"tenant_id" binding:"required"`
	UserID   string   `json:"user_id" binding:"required"`
	Name     string   `json:"name" binding:"required"`
	Command  string   `json:"command" binding:"required"`
	HostIDs  []string `json:"host_ids" binding:"required,min=1"`
	Timeout  int      `json:"timeout"` // timeout in seconds, default 300
}