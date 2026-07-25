package models

import "time"

// Rule represents a rule in the rule engine.
type Rule struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenant_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Priority    int       `json:"priority"`
	Conditions  string    `json:"conditions"` // JSON array of condition objects
	Actions     string    `json:"actions"`    // JSON array of action objects
	IsEnabled   bool      `json:"is_enabled"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// EvaluateRequest for evaluating a rule.
type EvaluateRequest struct {
	RuleID string                 `json:"rule_id"`
	Data   map[string]interface{} `json:"data" binding:"required"`
}

// EvaluateResult represents the result of rule evaluation.
type EvaluateResult struct {
	RuleID   string            `json:"rule_id"`
	Triggered bool            `json:"triggered"`
	Actions  []interface{}     `json:"actions"`
	Message  string            `json:"message"`
}

// CreateRuleRequest for creating a rule.
type CreateRuleRequest struct {
	Name        string   `json:"name" binding:"required"`
	Description string   `json:"description"`
	Priority    int      `json:"priority"`
	Conditions  []string `json:"conditions" binding:"required"`
	Actions     []string `json:"actions" binding:"required"`
}

// RuleResponse wraps rule query results.
type RuleResponse struct {
	Total int64  `json:"total"`
	Data  []Rule `json:"data"`
}
