package models

import (
	"database/sql"
	"time"
)

// --- Enums ---

type TraceStatus string

const (
	TraceStatusPending   TraceStatus = "pending"
	TraceStatusCompleted TraceStatus = "completed"
	TraceStatusFailed    TraceStatus = "failed"
)

// --- Default model pricing (CNY per token) ---

var DefaultModelPricing = map[string]ModelPricing{
	"gpt-4":         {Input: 0.002, Output: 0.004},
	"gpt-4-turbo":   {Input: 0.001, Output: 0.002},
	"gpt-3.5-turbo": {Input: 0.0003, Output: 0.0006},
	"claude-opus":   {Input: 0.003, Output: 0.006},
	"claude-sonnet": {Input: 0.001, Output: 0.002},
	"claude-haiku":  {Input: 0.0003, Output: 0.0006},
	"qwen-max":      {Input: 0.0005, Output: 0.001},
	"deepseek":      {Input: 0.0003, Output: 0.0006},
}

// --- Core entity: LLMTrace ---

// LLMTrace records a single LLM call with token usage and cost.
type LLMTrace struct {
	ID                 string         `db:"id" json:"id"`
	TenantID           string         `db:"tenant_id" json:"tenantId"`
	UserID             sql.NullString `db:"user_id" json:"userId"`
	ScenarioID         sql.NullString `db:"scenario_id" json:"scenarioId"`
	ProviderID         sql.NullString `db:"provider_id" json:"providerId"`
	ModelID            string         `db:"model_id" json:"modelId"`
	PromptContent      sql.NullString `db:"prompt_content" json:"promptContent"`
	PromptHash         string         `db:"prompt_hash" json:"promptHash"`
	OutputContent      sql.NullString `db:"output_content" json:"outputContent"`
	OutputHash         sql.NullString `db:"output_hash" json:"outputHash"`
	InputTokens        int            `db:"input_tokens" json:"inputTokens"`
	OutputTokens       int            `db:"output_tokens" json:"outputTokens"`
	TotalTokens        int            `db:"total_tokens" json:"totalTokens"`
	InputCost          float64        `db:"input_cost" json:"inputCost"`
	OutputCost         float64        `db:"output_cost" json:"outputCost"`
	TotalCost          float64        `db:"total_cost" json:"totalCost"`
	Currency           string         `db:"currency" json:"currency"`
	Status             TraceStatus    `db:"status" json:"status"`
	RequestStartedAt   time.Time      `db:"request_started_at" json:"requestStartedAt"`
	RequestCompletedAt sql.NullTime   `db:"request_completed_at" json:"requestCompletedAt"`
	DurationMs         sql.NullInt64  `db:"duration_ms" json:"durationMs"`
	ParentTraceID      sql.NullString `db:"parent_trace_id" json:"parentTraceId"`
	ErrorMessage       sql.NullString `db:"error_message" json:"errorMessage"`
	RequestContext     sql.NullString `db:"request_context" json:"requestContext"` // JSONB
	Metadata           sql.NullString `db:"metadata" json:"metadata"`              // JSONB
	CreatedAt          time.Time      `db:"created_at" json:"createdAt"`
}

// --- Pricing ---

// ModelPricing holds input/output price per token for a model.
type ModelPricing struct {
	Input  float64 `json:"input"`
	Output float64 `json:"output"`
}

// --- Daily Stats ---

// DailyStats aggregates LLM trace statistics for a given day.
type DailyStats struct {
	TenantID      string  `json:"tenantId"`
	Date          string  `json:"date"`
	TotalRequests int64   `json:"totalRequests"`
	TotalTokens   int64   `json:"totalTokens"`
	TotalCost     float64 `json:"totalCost"`
	AvgDurationMs float64 `json:"avgDurationMs"`
	SuccessRate   float64 `json:"successRate"`
}

// --- Cost Breakdown ---

// CostBreakdown is the result of a cost calculation.
type CostBreakdown struct {
	InputCost        float64            `json:"inputCost"`
	OutputCost       float64            `json:"outputCost"`
	TotalCost        float64            `json:"totalCost"`
	Currency         string             `json:"currency"`
	BreakdownByModel map[string]float64 `json:"breakdownByModel"`
}

// --- Tracking Accuracy ---

// TrackingAccuracy is the accuracy metrics for LLM tracing.
type TrackingAccuracy struct {
	Accuracy       float64 `json:"accuracy"`
	CompletedCount int64   `json:"completed"`
	FailedCount    int64   `json:"failed"`
	Total          int64   `json:"total"`
	TargetAccuracy float64 `json:"targetAccuracy"`
	MeetsTarget    bool    `json:"meetsTarget"`
}

// --- Request types ---

// ListTracesQuery holds query parameters for listing traces.
type ListTracesQuery struct {
	ScenarioID *string
	Limit      *int
}

// DailyStatsQuery holds query parameters for daily stats.
type DailyStatsQuery struct {
	Date *string // YYYY-MM-DD
}

// CostBreakdownQuery holds query parameters for cost breakdown.
type CostBreakdownQuery struct {
	StartDate *time.Time
	EndDate   *time.Time
}

// CostEstimateRequest is the body for estimating cost.
type CostEstimateRequest struct {
	ModelID      string `json:"modelId" binding:"required"`
	InputTokens  int    `json:"inputTokens" binding:"required"`
	OutputTokens int    `json:"outputTokens" binding:"required"`
}

// TraceCreateRequest is the body for creating a trace.
type TraceCreateRequest struct {
	UserID         string                 `json:"userId"`
	ScenarioID     string                 `json:"scenarioId"`
	ProviderID     string                 `json:"providerId"`
	ModelID        string                 `json:"modelId" binding:"required"`
	PromptContent  string                 `json:"promptContent" binding:"required"`
	ParentTraceID  string                 `json:"parentTraceId"`
	RequestContext map[string]interface{} `json:"requestContext"`
	Metadata       map[string]interface{} `json:"metadata"`
}

// TraceCompleteRequest is the body for completing a trace.
type TraceCompleteRequest struct {
	OutputContent string `json:"outputContent" binding:"required"`
	InputTokens   int    `json:"inputTokens" binding:"required"`
	OutputTokens  int    `json:"outputTokens" binding:"required"`
	ErrorMessage  string `json:"errorMessage"`
}
