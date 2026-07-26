package models

import "time"

// Agent represents an AI agent instance.
type Agent struct {
	ID        string      `json:"id"`
	Config    AgentConfig `json:"config"`
	Status    string      `json:"status"`
	TenantID  string      `json:"tenant_id"`
	CreatedAt time.Time   `json:"created_at"`
}

// AgentConfig holds the configuration for an agent.
type AgentConfig struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Type        string `json:"type"`
	Enabled     bool   `json:"enabled"`
}

// AgentAuditLogEntry represents an audit log entry for an agent execution.
type AgentAuditLogEntry struct {
	ID        string                 `json:"id"`
	AgentID   string                 `json:"agent_id"`
	TenantID  string                 `json:"tenant_id"`
	Action    string                 `json:"action"`
	Input     map[string]interface{} `json:"input,omitempty"`
	Output    map[string]interface{} `json:"output,omitempty"`
	Status    string                 `json:"status"`
	Error     string                 `json:"error,omitempty"`
	CreatedAt time.Time              `json:"created_at"`
}

// ExecuteRequest represents a request to execute an agent.
type ExecuteRequest struct {
	Input map[string]interface{} `json:"input" binding:"required"`
}

// ExecuteResponse represents the result of an agent execution.
type ExecuteResponse struct {
	Result   map[string]interface{} `json:"result"`
	Status   string                 `json:"status"`
	Duration int64                  `json:"duration_ms"`
}