package models

import "time"

type CostRecord struct {
	ID               string    `json:"id" db:"id"`
	TenantID         string    `json:"tenantId" db:"tenant_id"`
	ModelID          string    `json:"modelId" db:"model_id"`
	PromptTokens     int64     `json:"promptTokens" db:"prompt_tokens"`
	CompletionTokens int64     `json:"completionTokens" db:"completion_tokens"`
	Cost             float64   `json:"cost" db:"cost"`
	CreatedAt        time.Time `json:"createdAt" db:"created_at"`
}

// CostSummary is filled by an aggregate SELECT, so its scanned fields need db
// tags: sqlx maps a returned column against db:"...", falling back to the Go
// field name only when no tag exists. Untagged, TotalCost looked for the column
// "totalcost" while GetSummary aliases SUM(cost) as "total_cost", so
// GET /ai/cost/summary failed in sqlx safe mode with
// "missing destination name total_cost". The untagged fields are set in Go
// rather than scanned, so they need no tag.
type CostSummary struct {
	TotalCost     float64            `json:"totalCost" db:"total_cost"`
	TotalRequests int64              `json:"totalRequests" db:"total_requests"`
	AvgCost       float64            `json:"avgCost"`
	ByModel       map[string]float64 `json:"byModel"`
	ByDate        map[string]float64 `json:"byDate"`
}

type CostFilter struct {
	ModelID  string `json:"modelId"`
	FromDate string `json:"fromDate"`
	ToDate   string `json:"toDate"`
}

// DailyCost aggregates cost for a single day.
type DailyCost struct {
	Date    string  `json:"date"`
	Total   float64 `json:"total"`
	Records int     `json:"records"`
}

// ModelCost aggregates cost for a single model.
type ModelCost struct {
	Model   string  `json:"model"`
	Total   float64 `json:"total"`
	Records int     `json:"records"`
}
