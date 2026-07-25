package models

import "time"

// AutomationRule defines an automation rule for ticket processing
type AutomationRule struct {
	ID                string            `json:"id" db:"id"`
	TenantID          string            `json:"tenant_id" db:"tenant_id"`
	Name              string            `json:"name" db:"name"`
	Description       string            `json:"description" db:"description"`
	Condition         string            `json:"condition" db:"condition"` // JSON string for conditions
	Actions           string            `json:"actions" db:"actions"`     // JSON string for actions
	Enabled           bool              `json:"enabled" db:"enabled"`
	ExecutionCount    int               `json:"execution_count" db:"execution_count"`
	CreatedBy         string            `json:"created_by" db:"created_by"`
	CreatedAt         time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time         `json:"updated_at" db:"updated_at"`
}

// AutomationRuleExecution logs rule execution
type AutomationRuleExecution struct {
	ID              string    `json:"id" db:"id"`
	RuleID          string    `json:"rule_id" db:"rule_id"`
	TicketID        string    `json:"ticket_id" db:"ticket_id"`
	TenantID        string    `json:"tenant_id" db:"tenant_id"`
	TriggeredBy     string    `json:"triggered_by" db:"triggered_by"` // create, update, manual
	ConditionsMet   bool      `json:"conditions_met" db:"conditions_met"`
	ActionsTaken    string    `json:"actions_taken" db:"actions_taken"` // JSON string
	Status          string    `json:"status" db:"status"` // running, success, failed
	ErrorMessage    string    `json:"error_message" db:"error_message"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	CompletedAt     *time.Time `json:"completed_at" db:"completed_at"`
}

// CreateAutomationRuleRequest is input for creating an automation rule
type CreateAutomationRuleRequest struct {
	ID          string `json:"id"`
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Condition   string `json:"condition" binding:"required"` // JSON conditions array
	Actions     string `json:"actions" binding:"required"`   // JSON actions array
	Enabled     *bool  `json:"enabled"`
}

// UpdateAutomationRuleRequest is input for updating an automation rule
type UpdateAutomationRuleRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Condition   string `json:"condition"`
	Actions     string `json:"actions"`
	Enabled     *bool  `json:"enabled"`
}

// ExecuteRuleRequest is input for executing a rule
type ExecuteRuleRequest struct {
	TicketID   string `json:"ticket_id" binding:"required"`
	TriggeredBy string `json:"triggered_by"` // create, update, manual
	TicketData map[string]any `json:"ticket"`
}
