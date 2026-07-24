// Package models defines data models for the Runner CI task execution service.
// Translated from TS blueprint: blueprints/orion-runner-svc (9 TS files, 915 lines).
//
// The Runner service manages CI task execution on worker agents. It tracks jobs
// dispatched by the Orion Platform, monitors runner agent lifecycle, and records
// execution results with full stdout/stderr capture.
//
// Data flow:
//   1. Platform dispatches a task → runner receives via POST /runner/execute
//   2. Runner creates a RunnerJob record (status=pending)
//   3. Task executes (shell/http/pipeline/deploy) in isolated workspace
//   4. Result written back (status=completed/failed, stdout, stderr, exitCode, duration)
//   5. Result reported to Platform via webhook callback
//
// Tables: runner_agents (agent registry), runner_jobs (job execution history)
package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JobStatus represents the lifecycle state of a CI job.
// Translated from TS: type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
type JobStatus string

const (
	JobStatusPending    JobStatus = "pending"
	JobStatusRunning    JobStatus = "running"
	JobStatusCompleted  JobStatus = "completed"
	JobStatusFailed     JobStatus = "failed"
	JobStatusCancelled  JobStatus = "cancelled"
)

// ValidJobStatuses is the set of valid transitions.
var ValidJobStatuses = map[JobStatus]bool{
	JobStatusPending:   true,
	JobStatusRunning:   true,
	JobStatusCompleted: true,
	JobStatusFailed:    true,
	JobStatusCancelled: true,
}

// AgentStatus represents the lifecycle state of a runner agent.
// Translated from TS RunnerStatus: 'registering' | 'online' | 'offline'
type AgentStatus string

const (
	AgentStatusRegistering AgentStatus = "registering"
	AgentStatusOnline      AgentStatus = "online"
	AgentStatusOffline     AgentStatus = "offline"
	AgentStatusDraining    AgentStatus = "draining" // extended: agent shutting down gracefully
)

var ValidAgentStatuses = map[AgentStatus]bool{
	AgentStatusRegistering: true,
	AgentStatusOnline:      true,
	AgentStatusOffline:     true,
	AgentStatusDraining:    true,
}

// ---------------------------------------------------------------------------
// JSONB helpers (copied from inception models for self-contained usage)
// ---------------------------------------------------------------------------

// JSONB is a PostgreSQL JSONB-compatible map type.
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(src interface{}) error {
	if src == nil {
		*j = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, j)
	case string:
		return json.Unmarshal([]byte(v), j)
	default:
		return fmt.Errorf("cannot scan %T into JSONB", src)
	}
}

// JSONArray is a PostgreSQL JSONB-compatible slice type.
type JSONArray []interface{}

func (a JSONArray) Value() (driver.Value, error) {
	if a == nil {
		return nil, nil
	}
	return json.Marshal(a)
}

func (a *JSONArray) Scan(src interface{}) error {
	if src == nil {
		*a = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, a)
	case string:
		return json.Unmarshal([]byte(v), a)
	default:
		return fmt.Errorf("cannot scan %T into JSONArray", src)
	}
}

// ---------------------------------------------------------------------------
// Runner Agent — CI worker node registered with the platform
// ---------------------------------------------------------------------------

// RunnerAgent represents a CI worker node that executes jobs.
// Translated from TS RunnerService.register() payload + RunnerStatus.
type RunnerAgent struct {
	ID             string    `db:"id" json:"id"`
	AgentID        string    `db:"agent_id" json:"agent_id"` // unique external ID (e.g. "my-server-runner")
	TenantID       string    `db:"tenant_id" json:"tenant_id"`
	Name           string    `db:"name" json:"name"`
	Labels         JSONArray `db:"labels" json:"labels"`         // e.g. ["linux", "nodejs"]
	Endpoint       string    `db:"endpoint" json:"endpoint"`     // callback URL (e.g. "http://host:3028")
	MaxConcurrent  int       `db:"max_concurrent" json:"max_concurrent"`
	Status         string    `db:"status" json:"status"`         // online | offline | draining
	Metadata       JSONB     `db:"metadata" json:"metadata"`     // OS info, runtime version
	LastHeartbeatAt *time.Time `db:"last_heartbeat_at" json:"last_heartbeat_at,omitempty"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time `db:"updated_at" json:"updated_at"`
}

// CreateAgentRequest is the request payload for registering a runner agent.
// Translated from TS RunnerService.register() payload.
type CreateAgentRequest struct {
	Name          string            `json:"name" binding:"required"`
	Labels        []string          `json:"labels"`
	Endpoint      string            `json:"endpoint" binding:"required"`
	MaxConcurrent int               `json:"max_concurrent"`
	Metadata      map[string]string `json:"metadata"`
}

// UpdateAgentRequest is the request payload for updating a runner agent.
type UpdateAgentRequest struct {
	Labels        *[]string   `json:"labels"`
	MaxConcurrent *int        `json:"max_concurrent"`
	Status        *string     `json:"status"`
	Metadata      *JSONB      `json:"metadata"`
}

// HeartbeatRequest is the request payload for an agent heartbeat.
type HeartbeatRequest struct {
	ActiveJobs  int     `json:"active_jobs"`
	CPUUsage    *float64 `json:"cpu_usage"`
	MemoryUsage *float64 `json:"memory_usage"`
	DiskUsage   *float64 `json:"disk_usage"`
}

// AgentInfo is the response containing agent details + status summary.
// Translated from TS RunnerStatus getter.
type AgentInfo struct {
	AgentID       string `json:"agent_id"`
	ActiveJobs    int    `json:"active_jobs"`
	Status        string `json:"status"`
	MaxConcurrent int    `json:"max_concurrent"`
	Name          string `json:"name"`
	Endpoint      string `json:"endpoint"`
}

// ---------------------------------------------------------------------------
// Runner Job — a single CI task execution tracked by the runner
// ---------------------------------------------------------------------------

// RunnerJob represents a single job execution dispatched to a runner agent.
// Translated from TS RunnerJob interface (JobRepository.ts).
type RunnerJob struct {
	ID        string     `db:"id" json:"id"`
	JobID     string     `db:"job_id" json:"job_id"`         // external job identifier (unique)
	AgentID   string     `db:"agent_id" json:"agent_id"`     // FK → runner_agents.id
	TenantID  string     `db:"tenant_id" json:"tenant_id"`
	TaskType  string     `db:"task_type" json:"task_type"`   // shell | npm | test | build | http | pipeline | deploy
	Status    JobStatus  `db:"status" json:"status"`
	Params    JSONB      `db:"task_parameters" json:"task_parameters,omitempty"`
	Result    JSONB      `db:"result" json:"result,omitempty"`
	Stdout    *string    `db:"stdout" json:"stdout,omitempty"`
	Stderr    *string    `db:"stderr" json:"stderr,omitempty"`
	ExitCode  *int       `db:"exit_code" json:"exit_code,omitempty"`
	DurationMs *int      `db:"duration_ms" json:"duration_ms,omitempty"`
	ErrMsg    *string    `db:"error_message" json:"error_message,omitempty"`
	StartedAt  *time.Time `db:"started_at" json:"started_at,omitempty"`
	CompletedAt *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	CreatedAt time.Time  `db:"created_at" json:"created_at"`
}

// CreateJobRequest is the request payload for dispatching a task to a runner.
// Translated from TS ExecuteBody interface (runner-routes.ts).
type CreateJobRequest struct {
	AgentID string              `json:"agent_id" binding:"required"`
	Task    *TaskSpec           `json:"task" binding:"required"`
	TenantID string             `json:"tenant_id"` // optional; defaults to agent's tenant
}

// TaskSpec describes a single CI task to execute.
// Translated from TS: { type: string, parameters?: TaskParameters }.
type TaskSpec struct {
	Type       string            `json:"type" binding:"required"`
	Name       string            `json:"name"`
	Parameters map[string]string `json:"parameters"`
	// Common task parameters (TS-compatible field names)
	Command string `json:"command"` // shell command string
	Script  string `json:"script"`  // inline script
	Args    string `json:"args"`    // npm args string
	Timeout int    `json:"timeout"` // task timeout in ms
}

// UpdateJobStatusRequest is the request payload for manually updating job status.
type UpdateJobStatusRequest struct {
	Status    JobStatus `json:"status" binding:"required"`
	ErrMsg    *string   `json:"error_message"`
	ExitCode  *int      `json:"exit_code"`
	DurationMs *int     `json:"duration_ms"`
	Stdout    *string   `json:"stdout"`
	Stderr    *string   `json:"stderr"`
	Result    *JSONB    `json:"result"`
}

// JobResult is the task execution result reported back to the platform.
// Translated from TS TaskResult interface.
type JobResult struct {
	JobID      string `json:"job_id"`
	Status     string `json:"status"` // completed | failed
	Success    bool   `json:"success"`
	Stdout     string `json:"stdout"`
	Stderr     string `json:"stderr"`
	ExitCode   int    `json:"exit_code"`
	DurationMs int    `json:"duration_ms"`
}

// ---------------------------------------------------------------------------
// Runner Heartbeat — periodic agent status report
// ---------------------------------------------------------------------------

// RunnerHeartbeat stores a single heartbeat record from an agent.
type RunnerHeartbeat struct {
	ID          string    `db:"id" json:"id"`
	AgentID     string    `db:"agent_id" json:"agent_id"`
	ActiveJobs  int       `db:"active_jobs" json:"active_jobs"`
	CPUUsage    *float64  `db:"cpu_usage" json:"cpu_usage"`
	MemoryUsage *float64  `db:"memory_usage" json:"memory_usage"`
	DiskUsage   *float64  `db:"disk_usage" json:"disk_usage"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

// ---------------------------------------------------------------------------
// Task type constants
// ---------------------------------------------------------------------------

var ValidTaskTypes = map[string]bool{
	"shell":   true,
	"npm":     true,
	"test":    true,
	"build":   true,
	"http":    true,
	"pipeline": true,
	"deploy":  true,
}

// ---------------------------------------------------------------------------
// Pagination helpers
// ---------------------------------------------------------------------------

// PaginatedRequest holds pagination parameters.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

// Offset returns the SQL OFFSET value, applying defaults.
func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

// Limit returns the SQL LIMIT value, capping at 100.
func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}
