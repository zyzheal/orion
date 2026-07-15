package models

import "time"

// Agent represents an AI agent.
type Agent struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`
	Model     string    `db:"model" json:"model"`
	Prompt    string    `db:"prompt" json:"prompt"`
	Status    string    `db:"status" json:"status"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
	DeletedAt *time.Time `db:"deleted_at" json:"deleted_at,omitempty"`
}

// AgentRun represents an agent execution run.
type AgentRun struct {
	ID        string    `db:"id" json:"id"`
	AgentID   string    `db:"agent_id" json:"agent_id"`
	Input     string    `db:"input" json:"input"`
	Output    string    `db:"output" json:"output"`
	Status    string    `db:"status" json:"status"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// CreateAgentRequest is the payload for creating an agent.
type CreateAgentRequest struct {
	Name   string `json:"name" binding:"required"`
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
}

// UpdateAgentRequest is the payload for updating an agent.
type UpdateAgentRequest struct {
	Name   string `json:"name"`
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
	Status string `json:"status"`
}

// RunAgentRequest is the payload for running an agent.
type RunAgentRequest struct {
	Input string `json:"input" binding:"required"`
}

// ListAgentsQuery filters agent listing.
type ListAgentsQuery struct {
	Name   string
	Status string
	Limit  int
	Offset int
}

// AgentListResponse wraps a paginated agent list.
type AgentListResponse struct {
	Agents []Agent `json:"agents"`
	Total  int     `json:"total"`
}
