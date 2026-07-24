package models

import "time"

// AutoRecoveryRule defines an auto-recovery rule.
type AutoRecoveryRule struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenant_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Trigger     string    `json:"trigger"` // error_rate, latency, timeout
	Condition   string    `json:"condition"`
	Action      string    `json:"action"` // restart, scale, failover, degrade
	Target      string    `json:"target"`
	IsEnabled   bool      `json:"is_enabled"`
	MaxRetries  int       `json:"max_retries"`
	CreatedAt   time.Time `json:"created_at"`
}

// RecoveryAction represents a recovery action taken.
type RecoveryAction struct {
	ID          string    `json:"id"`
	RuleID      string    `json:"rule_id"`
	TenantID    string    `json:"tenant_id"`
	Action      string    `json:"action"`
	Target      string    `json:"target"`
	Status      string    `json:"status"` // pending, executing, succeeded, failed
	Result      string    `json:"result"`
	RetryCount  int       `json:"retry_count"`
	CreatedAt   time.Time `json:"created_at"`
	CompletedAt *time.Time `json:"completed_at"`
}

// CreateRuleRequest for creating an auto-recovery rule.
type CreateRuleRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Trigger     string `json:"trigger" binding:"required,oneof=error_rate latency timeout"`
	Condition   string `json:"condition" binding:"required"`
	Action      string `json:"action" binding:"required,oneof=restart scale failover degrade"`
	Target      string `json:"target" binding:"required"`
	IsEnabled   *bool  `json:"is_enabled"`
	MaxRetries  int    `json:"max_retries"`
}

// RuleResponse wraps rule query results.
type RuleResponse struct {
	Total int64             `json:"total"`
	Data  []AutoRecoveryRule `json:"data"`
}

// ActionResponse wraps action query results.
type ActionResponse struct {
	Total int64            `json:"total"`
	Data  []RecoveryAction `json:"data"`
}
