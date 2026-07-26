package models

import "time"

// PipelineBudget represents a budget configuration for a pipeline.
type PipelineBudget struct {
	ID            string    `db:"id" json:"id"`
	TenantID      string    `db:"tenant_id" json:"tenant_id"`
	PipelineID    *string   `db:"pipeline_id" json:"pipeline_id,omitempty"`
	BudgetLimit   float64   `db:"budget_limit" json:"budget_limit"`
	CurrentSpend  float64   `db:"current_spend" json:"current_spend"`
	Currency      string    `db:"currency" json:"currency"`
	Period        string    `db:"period" json:"period"`
	Description   string    `db:"description" json:"description"`
	CreatedBy     string    `db:"created_by" json:"created_by"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time `db:"updated_at" json:"updated_at"`
}

// BudgetCheckResult holds the result of a budget check.
type BudgetCheckResult struct {
	WithinBudget bool    `json:"within_budget"`
	BudgetLimit  float64 `json:"budget_limit"`
	CurrentSpend float64 `json:"current_spend"`
	Remaining    float64 `json:"remaining"`
	UsagePercent float64 `json:"usage_percent"`
	Currency     string  `json:"currency"`
}

// SetBudgetRequest is the input for setting a budget.
type SetBudgetRequest struct {
	PipelineID  *string `json:"pipeline_id,omitempty"`
	BudgetLimit float64 `json:"budget_limit" binding:"required"`
	Currency    string  `json:"currency"`
	Period      string  `json:"period"`
	Description string  `json:"description"`
}