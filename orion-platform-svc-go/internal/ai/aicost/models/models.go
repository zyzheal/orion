package models

import "time"

// CostOptimizationAnalysis represents the result of a cost analysis.
type CostOptimizationAnalysis struct {
	TenantID      string                   `json:"tenant_id"`
	TotalSpend    float64                  `json:"total_spend"`
	Opportunities []CostSavingsOpportunity `json:"opportunities"`
	Currency      string                   `json:"currency"`
}

// CostSavingsOpportunity represents a potential savings opportunity.
type CostSavingsOpportunity struct {
	Category                string  `json:"category"`
	ResourceName            string  `json:"resource_name"`
	EstimatedMonthlySavings float64 `json:"estimated_monthly_savings"`
	RiskLevel               string  `json:"risk_level"`
	Description             string  `json:"description"`
}

// SavingsRecord represents a historical savings record.
//
// The db tags are load-bearing: ListSavingsHistory reads SELECT * and sqlx
// maps a column to db:"..." first, falling back to the Go field name. Without
// them tenant_id and created_at have no destination and the whole history
// route answers 500 as soon as a tenant holds one record.
type SavingsRecord struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Amount      float64   `json:"amount" db:"amount"`
	Category    string    `json:"category" db:"category"`
	Description string    `json:"description" db:"description"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// CostSummary represents the cost summary response.
type CostSummary struct {
	TotalSpend         float64 `json:"total_spend"`
	TotalSavingsToDate float64 `json:"total_savings_to_date"`
	OpportunityCount   int     `json:"opportunity_count"`
	Currency           string  `json:"currency"`
}

// CostAlert represents a cost-related alert.
type CostAlert struct {
	Type                    string  `json:"type"`
	Category                string  `json:"category"`
	ResourceName            string  `json:"resource_name"`
	EstimatedMonthlySavings float64 `json:"estimated_monthly_savings"`
	RiskLevel               string  `json:"risk_level"`
	Description             string  `json:"description"`
}

// OptimizeRequest is the request body for POST /optimize.
type OptimizeRequest struct {
	TenantID string `json:"tenant_id"`
}

// OptimizeResponse is the response for POST /optimize.
type OptimizeResponse struct {
	Analysis        CostOptimizationAnalysis `json:"analysis"`
	Recommendations []CostSavingsOpportunity `json:"recommendations"`
}
