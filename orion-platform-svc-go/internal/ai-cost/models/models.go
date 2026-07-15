package models

import "time"

type CostRecord struct {
	ID          string     `json:"id" db:"id"`
	TenantID    string     `json:"tenantId" db:"tenant_id"`
	ModelID     string     `json:"modelId" db:"model_id"`
	PromptTokens int64    `json:"promptTokens" db:"prompt_tokens"`
	CompletionTokens int64 `json:"completionTokens" db:"completion_tokens"`
	Cost        float64    `json:"cost" db:"cost"`
	CreatedAt   time.Time  `json:"createdAt" db:"created_at"`
}

type CostSummary struct {
	TotalCost       float64 `json:"totalCost"`
	TotalRequests   int64   `json:"totalRequests"`
	AvgCost         float64 `json:"avgCost"`
	ByModel         map[string]float64 `json:"byModel"`
	ByDate          map[string]float64 `json:"byDate"`
}

type CostFilter struct {
	ModelID string `json:"modelId"`
	FromDate string `json:"fromDate"`
	ToDate   string `json:"toDate"`
}
