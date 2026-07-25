package models

import "time"

// LLMTrace represents an LLM call trace.
type LLMTrace struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Model       string    `json:"model" db:"model"`
	Provider    string    `json:"provider" db:"provider"`
	PromptTokens  int     `json:"prompt_tokens" db:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens" db:"completion_tokens"`
	TotalTokens   int     `json:"total_tokens" db:"total_tokens"`
	Cost        float64   `json:"cost" db:"cost"`
	LatencyMs   int       `json:"latency_ms" db:"latency_ms"`
	Status      string    `json:"status" db:"status"`
	Error       string    `json:"error" db:"error"`
	TraceID     string    `json:"trace_id" db:"trace_id"`
	Input       string    `json:"input" db:"input"`
	Output      string    `json:"output" db:"output"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// CostSummary represents aggregated cost data.
type CostSummary struct {
	Period      string    `json:"period"`
	TotalCost   float64   `json:"total_cost"`
	TotalTokens int       `json:"total_tokens"`
	PromptTokens int      `json:"prompt_tokens"`
	CompletionTokens int  `json:"completion_tokens"`
	CallCount   int64     `json:"call_count"`
	ByModel     []ModelCost `json:"by_model"`
	ByProvider  []ProviderCost `json:"by_provider"`
}

// ModelCost represents cost breakdown by model.
type ModelCost struct {
	Model       string  `json:"model"`
	Cost        float64 `json:"cost"`
	CallCount   int64   `json:"call_count"`
	Tokens      int     `json:"tokens"`
}

// ProviderCost represents cost breakdown by provider.
type ProviderCost struct {
	Provider  string  `json:"provider"`
	Cost      float64 `json:"cost"`
	CallCount int64   `json:"call_count"`
	Tokens    int     `json:"tokens"`
}

// QueryRequest for querying traces.
type QueryRequest struct {
	TenantID   string `json:"tenant_id" binding:"required"`
	Model      string `json:"model"`
	Provider   string `json:"provider"`
	Status     string `json:"status"`
	StartTime  string `json:"start_time"`
	EndTime    string `json:"end_time"`
	Limit      int    `json:"limit"`
	Offset     int    `json:"offset"`
}

// TraceResponse wraps trace query results.
type TraceResponse struct {
	Total int64      `json:"total"`
	Data  []LLMTrace `json:"data"`
}

// CreateTraceRequest for creating a trace.
type CreateTraceRequest struct {
	Model          string  `json:"model" binding:"required"`
	Provider       string  `json:"provider"`
	PromptTokens   int     `json:"prompt_tokens"`
	CompletionTokens int   `json:"completion_tokens"`
	TotalTokens    int     `json:"total_tokens"`
	Cost           float64 `json:"cost"`
	LatencyMs      int     `json:"latency_ms"`
	Status         string  `json:"status"`
	Error          string  `json:"error"`
	TraceID        string  `json:"trace_id"`
	Input          string  `json:"input"`
	Output         string  `json:"output"`
}
