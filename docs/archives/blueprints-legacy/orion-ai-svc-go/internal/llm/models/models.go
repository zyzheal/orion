package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// ---------------------------------------------------------------------------
// JSONB helper – used for request_context / metadata columns
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Default model pricing (CNY per token) – mirrors Node.js MODEL_PRICING
// ---------------------------------------------------------------------------

var DefaultModelPricing = map[string]struct {
	Input  float64
	Output float64
}{
	"gpt-4":         {Input: 0.002, Output: 0.004},
	"gpt-4-turbo":   {Input: 0.001, Output: 0.002},
	"gpt-3.5-turbo": {Input: 0.0003, Output: 0.0006},
	"claude-opus":   {Input: 0.003, Output: 0.006},
	"claude-sonnet": {Input: 0.001, Output: 0.002},
	"claude-haiku":  {Input: 0.0003, Output: 0.0006},
	"qwen-max":      {Input: 0.0005, Output: 0.001},
	"deepseek":      {Input: 0.0003, Output: 0.0006},
}

// ---------------------------------------------------------------------------
// LLM Trace – the core entity tracking every LLM API call
// ---------------------------------------------------------------------------

type LLMTrace struct {
	ID                int64   `db:"id"                  json:"-"`
	TraceID           string  `db:"trace_id"            json:"trace_id"`
	TenantID          string  `db:"tenant_id"           json:"tenant_id"`
	UserID            *string `db:"user_id"             json:"user_id,omitempty"`
	ScenarioID        *string `db:"scenario_id"         json:"scenario_id,omitempty"`
	ProviderID        *string `db:"provider_id"         json:"provider_id,omitempty"`
	ModelID           string  `db:"model_id"            json:"model_id"`
	PromptContent     *string `db:"prompt_content"      json:"prompt_content,omitempty"`
	PromptHash        *string `db:"prompt_hash"         json:"prompt_hash,omitempty"`
	OutputContent     *string `db:"output_content"      json:"output_content,omitempty"`
	OutputHash        *string `db:"output_hash"         json:"output_hash,omitempty"`
	InputTokens       int64   `db:"input_tokens"        json:"input_tokens"`
	OutputTokens      int64   `db:"output_tokens"       json:"output_tokens"`
	TotalTokens       int64   `db:"total_tokens"        json:"total_tokens"`
	InputCost         float64 `db:"input_cost"          json:"input_cost"`
	OutputCost        float64 `db:"output_cost"         json:"output_cost"`
	TotalCost         float64 `db:"total_cost"          json:"total_cost"`
	Currency          string  `db:"currency"            json:"currency"`
	Status            string  `db:"status"              json:"status"`
	RequestStartedAt  time.Time `db:"request_started_at"  json:"request_started_at"`
	RequestCompletedAt *time.Time `db:"request_completed_at" json:"request_completed_at,omitempty"`
	DurationMs        *int64  `db:"duration_ms"         json:"duration_ms,omitempty"`
	ParentTraceID     *string `db:"parent_trace_id"     json:"parent_trace_id,omitempty"`
	ErrorMessage      *string `db:"error_message"       json:"error_message,omitempty"`
	RequestContext    JSONB   `db:"request_context"     json:"request_context,omitempty"`
	Metadata          JSONB   `db:"metadata"            json:"metadata,omitempty"`
	CreatedAt         time.Time `db:"created_at"         json:"created_at"`
}

// ---------------------------------------------------------------------------
// Model Custom Pricing – per-model token pricing overrides
// ---------------------------------------------------------------------------

type ModelPricing struct {
	ID          string    `db:"id"           json:"id"`
	ModelID     string    `db:"model_id"     json:"model_id"`
	InputPrice  float64   `db:"input_price"  json:"input_price"`
	OutputPrice float64   `db:"output_price" json:"output_price"`
	TenantID    *string   `db:"tenant_id"    json:"tenant_id,omitempty"`
	CreatedAt   time.Time `db:"created_at"   json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"   json:"updated_at"`
}

// ---------------------------------------------------------------------------
// Daily Stats – aggregated statistics for a tenant on a given day
// ---------------------------------------------------------------------------

type DailyStats struct {
	TotalRequests int     `db:"total_requests"  json:"total_requests"`
	TotalTokens   int64   `db:"total_tokens"    json:"total_tokens"`
	TotalCost     float64 `db:"total_cost"      json:"total_cost"`
	AvgDurationMs float64 `db:"avg_duration_ms" json:"avg_duration_ms"`
	SuccessRate   float64 `db:"success_rate"    json:"success_rate"`
}

// ---------------------------------------------------------------------------
// Cost Breakdown – result of cost calculation
// ---------------------------------------------------------------------------

type CostBreakdown struct {
	InputCost       float64            `json:"input_cost"`
	OutputCost      float64            `json:"output_cost"`
	TotalCost       float64            `json:"total_cost"`
	Currency        string             `json:"currency"`
	BreakdownByModel map[string]float64 `json:"breakdown_by_model"`
}

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

type TraceStartRequest struct {
	TenantID       string                 `json:"tenant_id"    binding:"required"`
	UserID         string                 `json:"user_id"`
	ScenarioID     string                 `json:"scenario_id"`
	ProviderID     string                 `json:"provider_id"`
	ModelID        string                 `json:"model_id"     binding:"required"`
	PromptContent  string                 `json:"prompt_content" binding:"required"`
	ParentTraceID  string                 `json:"parent_trace_id"`
	RequestContext map[string]interface{} `json:"request_context"`
}

type TraceCompleteRequest struct {
	OutputContent string `json:"output_content" binding:"required"`
	InputTokens   int64  `json:"input_tokens"   binding:"required"`
	OutputTokens  int64  `json:"output_tokens"  binding:"required"`
	ErrorMessage  string `json:"error_message"`
}

type SetPricingRequest struct {
	ModelID     string  `json:"model_id"     binding:"required"`
	InputPrice  float64 `json:"input_price"  binding:"required"`
	OutputPrice float64 `json:"output_price" binding:"required"`
	TenantID    string  `json:"tenant_id"`
}

type SavingsRequest struct {
	CurrentModel     string `json:"current_model"     binding:"required"`
	AlternativeModel string `json:"alternative_model" binding:"required"`
	InputTokens      int64  `json:"input_tokens"      binding:"required"`
	OutputTokens     int64  `json:"output_tokens"     binding:"required"`
}

type SavingsResult struct {
	CurrentCost      float64 `json:"current_cost"`
	AlternativeCost  float64 `json:"alternative_cost"`
	Savings          float64 `json:"savings"`
	SavingsPercent   float64 `json:"savings_percent"`
}

// PaginatedRequest is a reusable pagination parameter struct.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}
