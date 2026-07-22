// Package models defines data structures for the sandbox execution service.
package models

import "time"

// SandboxConfig holds resource limits and capability toggles for a sandbox run.
type SandboxConfig struct {
	MaxCPU     float64
	MaxMemory  uint64      // bytes
	Timeout    time.Duration
	Network    bool // Allow network access
	FileAccess bool // Allow filesystem access (read-only when true)
}

// SandboxJob represents a single code execution job in the sandbox.
type SandboxJob struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenantId" db:"tenant_id"`
	Code        string    `json:"code" db:"code"`
	Language    string    `json:"language" db:"language"`
	Status      string    `json:"status" db:"status"` // pending, running, completed, failed, timeout
	MaxCPU      float64   `json:"maxCPU" db:"max_cpu"`
	MaxMemory   uint64    `json:"maxMemory" db:"max_memory"`
	TimeoutSec  int64     `json:"timeoutSec" db:"timeout_sec"`
	Network     bool      `json:"network" db:"network"`
	FileAccess  bool      `json:"fileAccess" db:"file_access"`
	ExitCode    int       `json:"exitCode,omitempty" db:"exit_code"`
	Stdout      string    `json:"stdout,omitempty" db:"stdout"`
	Stderr      string    `json:"stderr,omitempty" db:"stderr"`
	Logs        string    `json:"logs,omitempty" db:"logs"` // JSON array of sandbox event logs
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}

// CreateSandboxJobRequest is the request body for submitting a sandbox job.
type CreateSandboxJobRequest struct {
	Code       string   `json:"code" binding:"required"`
	Language   string   `json:"language" binding:"required"`
	MaxCPU     *float64 `json:"maxCPU"`
	MaxMemory  *uint64  `json:"maxMemory"`
	TimeoutSec *int64   `json:"timeoutSec"`
	Network    *bool    `json:"network"`
	FileAccess *bool    `json:"fileAccess"`
}

// ExecResult is returned by the sandbox executor after running code.
type ExecResult struct {
	ExitCode int      `json:"exitCode"`
	Stdout   string   `json:"stdout"`
	Stderr   string   `json:"stderr"`
	Logs     []string `json:"logs"` // Sandbox event log lines
}

// Status constants
const (
	JobStatusPending   = "pending"
	JobStatusRunning   = "running"
	JobStatusCompleted = "completed"
	JobStatusFailed    = "failed"
	JobStatusTimeout   = "timeout"
)
