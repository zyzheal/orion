package models

import "time"

// AgentTrace records a single agent execution for observability.
type AgentTrace struct {
	ID            string    `json:"id"`
	TenantID      string    `json:"tenant_id"`
	UserID        string    `json:"user_id"`
	AgentID       string    `json:"agent_id"`
	AgentName     string    `json:"agent_name"`
	Prompt        string    `json:"prompt,omitempty"`
	ToolCalls     []ToolCall `json:"tool_calls,omitempty"`
	Response      string    `json:"response,omitempty"`
	Status        string    `json:"status"` // running, completed, failed
	DurationMs    int64     `json:"duration_ms"`
	TokenUsage    TokenUsage `json:"token_usage,omitempty"`
	Error         string    `json:"error,omitempty"`
	ParentTraceID string    `json:"parent_trace_id,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	CompletedAt   time.Time `json:"completed_at"`
}

// ToolCall records a single tool invocation within an agent trace.
type ToolCall struct {
	Name      string `json:"name"`
	Input     string `json:"input,omitempty"`
	Output    string `json:"output,omitempty"`
	DurationMs int64 `json:"duration_ms"`
	Error     string `json:"error,omitempty"`
}

// TokenUsage records LLM token consumption for a trace.
type TokenUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
	TotalTokens  int `json:"total_tokens"`
	EstimatedCost float64 `json:"estimated_cost"` // USD
}

// AgentMetric aggregates trace data for a dashboard.
type AgentMetric struct {
	AgentID       string    `json:"agent_id"`
	TotalRuns     int       `json:"total_runs"`
	SuccessCount  int       `json:"success_count"`
	FailureCount  int       `json:"failure_count"`
	SuccessRate   float64   `json:"success_rate"`
	AvgDurationMs float64   `json:"avg_duration_ms"`
	P95DurationMs float64   `json:"p95_duration_ms"`
	TotalInputTokens  int   `json:"total_input_tokens"`
	TotalOutputTokens int   `json:"total_output_tokens"`
	TotalEstimatedCost float64 `json:"total_estimated_cost"`
	WindowStart  time.Time `json:"window_start"`
	WindowEnd    time.Time `json:"window_end"`
}

// TraceQueryRequest filters traces for listing.
type TraceQueryRequest struct {
	AgentID   string    `json:"agent_id"`
	UserID    string    `json:"user_id"`
	Status    string    `json:"status"`
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`
	Limit     int       `json:"limit"`
	Page      int       `json:"page"`
}

// MetricQueryRequest configures metric aggregation window.
type MetricQueryRequest struct {
	AgentID  string `json:"agent_id"`
	Days     int    `json:"days"` // 7, 30, 90
}