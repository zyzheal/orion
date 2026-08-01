package models

import "database/sql"

// --- Enums ---

type AgentStatus string

const (
	AgentStatusIdle     AgentStatus = "idle"
	AgentStatusRunning  AgentStatus = "running"
	AgentStatusDisabled AgentStatus = "disabled"
	AgentStatusError    AgentStatus = "error"
)

type ExecutionResult string

const (
	ExecutionResultSuccess ExecutionResult = "success"
	ExecutionResultFailed  ExecutionResult = "failed"
)

// --- Core entity: AIAgent ---

// AIAgent represents a registered AI agent configuration.
type AIAgent struct {
	ID                  string         `db:"id" json:"id"`
	TenantID            string         `db:"tenant_id" json:"tenantId"`
	Name                string         `db:"name" json:"name"`
	Enabled             bool           `db:"enabled" json:"enabled"`
	Scenario            string         `db:"scenario" json:"scenario"`
	Provider            string         `db:"provider" json:"provider"`
	MaxConcurrency      int            `db:"max_concurrency" json:"maxConcurrency"`
	TimeoutMs           int            `db:"timeout_ms" json:"timeoutMs"`
	MaxRetries          int            `db:"max_retries" json:"maxRetries"`
	BackoffMs           int            `db:"backoff_ms" json:"backoffMs"`
	RequiredTools       string         `db:"required_tools" json:"requiredTools"`             // JSONB array
	RequiredPermissions string         `db:"required_permissions" json:"requiredPermissions"` // JSONB array
	ModelConfig         sql.NullString `db:"model_config" json:"modelConfig"`                 // JSONB
	Status              AgentStatus    `db:"status" json:"status"`
	CreatedBy           string         `db:"created_by" json:"createdBy"`
	CreatedAt           int64          `db:"created_at" json:"createdAt"` // unix seconds
	UpdatedAt           sql.NullInt64  `db:"updated_at" json:"updatedAt"` // unix seconds
}

// --- Audit log ---

// AgentAuditLog records an agent execution with its input, output, and token usage.
type AgentAuditLog struct {
	ID           string         `db:"id" json:"id"`
	TenantID     string         `db:"tenant_id" json:"tenantId"`
	AgentID      string         `db:"agent_id" json:"agentId"`
	Context      string         `db:"context" json:"context"` // JSONB
	Input        string         `db:"input" json:"input"`     // JSONB
	Output       string         `db:"output" json:"output"`   // JSONB
	DurationMs   int            `db:"duration_ms" json:"durationMs"`
	InputTokens  int            `db:"input_tokens" json:"inputTokens"`
	OutputTokens int            `db:"output_tokens" json:"outputTokens"`
	TotalTokens  int            `db:"total_tokens" json:"totalTokens"`
	Success      bool           `db:"success" json:"success"`
	Error        sql.NullString `db:"error" json:"error"`
	CreatedAt    int64          `db:"created_at" json:"createdAt"` // unix seconds
}

// --- Request / Response types ---

// RegisterAgentRequest is the body for creating a new agent.
type RegisterAgentRequest struct {
	Name                string       `json:"name" binding:"required"`
	Enabled             bool         `json:"enabled"`
	Scenario            string       `json:"scenario" binding:"required"`
	Provider            string       `json:"provider" binding:"required"`
	MaxConcurrency      int          `json:"maxConcurrency"`
	TimeoutMs           int          `json:"timeoutMs"`
	MaxRetries          int          `json:"maxRetries"`
	BackoffMs           int          `json:"backoffMs"`
	RequiredTools       []string     `json:"requiredTools"`
	RequiredPermissions []string     `json:"requiredPermissions"`
	ModelConfig         *ModelConfig `json:"modelConfig"`
}

// ModelConfig holds optional LLM tuning parameters.
type ModelConfig struct {
	MaxTokens   *int     `json:"maxTokens"`
	Temperature *float64 `json:"temperature"`
}

// UpdateAgentRequest is the body for updating an agent.
type UpdateAgentRequest struct {
	Name                *string      `json:"name"`
	Enabled             *bool        `json:"enabled"`
	Scenario            *string      `json:"scenario"`
	Provider            *string      `json:"provider"`
	MaxConcurrency      *int         `json:"maxConcurrency"`
	TimeoutMs           *int         `json:"timeoutMs"`
	MaxRetries          *int         `json:"maxRetries"`
	BackoffMs           *int         `json:"backoffMs"`
	RequiredTools       *[]string    `json:"requiredTools"`
	RequiredPermissions *[]string    `json:"requiredPermissions"`
	ModelConfig         *ModelConfig `json:"modelConfig"`
	Status              *AgentStatus `json:"status"`
}

// ExecuteAgentRequest is the body for executing an agent.
type ExecuteAgentRequest struct {
	Input    map[string]interface{} `json:"input" binding:"required"`
	TraceID  string                 `json:"traceId"`
	UserID   string                 `json:"userId"`
	Metadata map[string]interface{} `json:"metadata"`
}

// ExecuteAgentResult is the response returned by agent execution.
type ExecuteAgentResult struct {
	Success    bool                   `json:"success"`
	Data       map[string]interface{} `json:"data"`
	Error      string                 `json:"error"`
	DurationMs int                    `json:"durationMs"`
	TokenUsage *AgentTokenUsage       `json:"tokenUsage"`
}

// AgentTokenUsage tracks LLM token consumption for an execution.
type AgentTokenUsage struct {
	Input  int `json:"input"`
	Output int `json:"output"`
	Total  int `json:"total"`
}

// AgentInfo is the API-facing representation of an agent.
type AgentInfo struct {
	ID             string       `json:"id"`
	Name           string       `json:"name"`
	Enabled        bool         `json:"enabled"`
	Scenario       string       `json:"scenario"`
	Provider       string       `json:"provider"`
	Status         AgentStatus  `json:"status"`
	MaxConcurrency int          `json:"maxConcurrency"`
	ModelConfig    *ModelConfig `json:"modelConfig"`
	CreatedAt      int64        `json:"createdAt"`
}

// AgentAuditLogResponse is the API-facing representation of an audit log entry.
type AgentAuditLogResponse struct {
	ID         string                 `json:"id"`
	AgentID    string                 `json:"agentId"`
	Context    map[string]interface{} `json:"context"`
	Input      map[string]interface{} `json:"input"`
	Output     map[string]interface{} `json:"output"`
	DurationMs int                    `json:"durationMs"`
	TokenUsage AgentTokenUsage        `json:"tokenUsage"`
	Success    bool                   `json:"success"`
	Error      string                 `json:"error"`
	CreatedAt  int64                  `json:"createdAt"`
}

// ListQuery mirrors the query parameters used by the handler.
type ListQuery struct {
	Status  string
	Enabled *bool
	Limit   *int
	Offset  *int
	Sort    string
	Order   string
}

// AgentStats aggregates agent statistics.
type AgentStats struct {
	Total        int64                 `json:"total"`
	EnabledCount int64                 `json:"enabledCount"`
	ByStatus     map[AgentStatus]int64 `json:"byStatus"`
}

// PaginatedResponse is a generic paginated response envelope.
type PaginatedResponse struct {
	Data   interface{} `json:"data"`
	Total  int64       `json:"total"`
	Offset int         `json:"offset"`
	Limit  int         `json:"limit"`
}
