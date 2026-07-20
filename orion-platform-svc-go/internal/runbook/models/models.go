package models

import "time"

// Runbook represents a runbook document.
type Runbook struct {
	ID          string        `json:"id" db:"id"`
	TenantID    string        `json:"tenant_id" db:"tenant_id"`
	Title       string        `json:"title" db:"title"`
	Description string        `json:"description" db:"description"`
	Category    string        `json:"category" db:"category"`
	Severity    string        `json:"severity" db:"severity"`
	Steps       []RunbookStep `json:"steps" db:"steps"`
	Tags        []string      `json:"tags" db:"tags"`
	Owner       string        `json:"owner" db:"owner"`
	Approved    bool          `json:"approved" db:"approved"`
	Enabled     bool          `json:"enabled" db:"enabled"`
	CreatedAt   time.Time     `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at" db:"updated_at"`
}

// RunbookStep is a single execution step.
type RunbookStep struct {
	Order          int    `json:"order"`
	Title          string `json:"title"`
	Command        string `json:"command"`
	ExpectedOutput string `json:"expected_output"`
	Automated      bool   `json:"automated"`
}

// RunbookExecution tracks a runbook execution.
type RunbookExecution struct {
	ID          string     `json:"id" db:"id"`
	TenantID    string     `json:"tenant_id" db:"tenant_id"`
	RunbookID   string     `json:"runbook_id" db:"runbook_id"`
	IncidentID  string     `json:"incident_id" db:"incident_id"`
	ExecutorID  string     `json:"executor_id" db:"executor_id"`
	Status      string     `json:"status" db:"status"`
	StartedAt   time.Time  `json:"started_at" db:"started_at"`
	CompletedAt *time.Time `json:"completed_at" db:"completed_at"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
}

// RunbookExecutionStep tracks individual step results.
type RunbookExecutionStep struct {
	ID          string     `json:"id" db:"id"`
	ExecutionID string     `json:"execution_id" db:"execution_id"`
	StepOrder   int        `json:"step_order" db:"step_order"`
	Status      string     `json:"status" db:"status"`
	Output      string     `json:"output" db:"output"`
	StartedAt   time.Time  `json:"started_at" db:"started_at"`
	CompletedAt *time.Time `json:"completed_at" db:"completed_at"`
}

type CreateRunbookRequest struct {
	Title       string        `json:"title" binding:"required"`
	Description string        `json:"description"`
	Category    string        `json:"category"`
	Severity    string        `json:"severity"`
	Steps       []RunbookStep `json:"steps"`
	Tags        []string      `json:"tags"`
	Owner       string        `json:"owner"`
}

type UpdateRunbookRequest struct {
	Title       *string       `json:"title"`
	Description *string       `json:"description"`
	Category    *string       `json:"category"`
	Severity    *string       `json:"severity"`
	Steps       []RunbookStep `json:"steps"`
	Tags        []string      `json:"tags"`
	Owner       *string       `json:"owner"`
	Approved    *bool         `json:"approved"`
	Enabled     *bool         `json:"enabled"`
}

type CreateRunbookExecutionRequest struct {
	RunbookID  string `json:"runbook_id" binding:"required"`
	IncidentID string `json:"incident_id"`
	ExecutorID string `json:"executor_id"`
}

// ListQuery filters runbook records.
type ListQuery struct {
	Limit    *int   `json:"limit"`
	Offset   *int   `json:"offset"`
	Category string `json:"category"`
	Severity string `json:"severity"`
	Approved *bool  `json:"approved"`
}
