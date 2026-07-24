package models

import "time"

// Orchestration represents a multi-agent orchestration session.
type Orchestration struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Agents      []AgentConfig `json:"agents" db:"agents"`
	Status      string    `json:"status" db:"status"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// AgentConfig represents an agent configuration within an orchestration.
type AgentConfig struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Type        string `json:"type"` // planner, executor, reviewer, tool
	Capabilities string `json:"capabilities"`
	Config      string `json:"config"`
}

// OrchestrationRun represents a run of an orchestration.
type OrchestrationRun struct {
	ID          string    `json:"id" db:"id"`
	OrchestrationID string `json:"orchestration_id" db:"orchestration_id"`
	Status      string    `json:"status" db:"status"`
	Input       string    `json:"input" db:"input"`
	Output      string    `json:"output" db:"output"`
	Error       string    `json:"error" db:"error"`
	StartedAt   time.Time `json:"started_at" db:"started_at"`
	CompletedAt *time.Time `json:"completed_at" db:"completed_at"`
}

// RunRequest for starting an orchestration run.
type RunRequest struct {
	OrchestrationID string            `json:"orchestration_id" binding:"required"`
	Input           map[string]interface{} `json:"input" binding:"required"`
	Options         RunOptions       `json:"options"`
}

// RunOptions configures the run behavior.
type RunOptions struct {
	TimeoutSec int    `json:"timeout_sec"`
	MaxSteps   int    `json:"max_steps"`
	Parallel   bool   `json:"parallel"`
	DryRun     bool   `json:"dry_run"`
}

// OrchestrationResponse wraps orchestration query results.
type OrchestrationResponse struct {
	Total int64           `json:"total"`
	Data  []Orchestration `json:"data"`
}

// RunResponse wraps run results.
type RunResponse struct {
	Run  *OrchestrationRun `json:"run"`
}
