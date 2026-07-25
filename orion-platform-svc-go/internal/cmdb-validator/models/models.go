package models

import "time"

// CMDBValidationRule defines a reusable validation rule for CMDB data.
// Categories: format, range, reference, enum, custom, relationship, uniqueness
type CMDBValidationRule struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenant_id"`
	Name         string    `db:"name" json:"name"`
	Category     string    `db:"category" json:"category"`     // format, range, reference, enum, custom, relationship, uniqueness
	TargetType   string    `db:"target_type" json:"target_type"` // CI, relation, attribute
	Condition    string    `db:"condition" json:"condition"`    // JSON: validation condition
	ErrorMessage string    `db:"error_message" json:"error_message"`
	Severity     string    `db:"severity" json:"severity"`     // error, warning, info
	Enabled      bool      `db:"enabled" json:"enabled"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
}

// CMDBValidationResult records a single validation execution.
type CMDBValidationResult struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	RuleID    string    `db:"rule_id" json:"rule_id"`
	TargetID  string    `db:"target_id" json:"target_id"`
	Status    string    `db:"status" json:"status"`    // pass, fail, warning
	Message   string    `db:"message" json:"message"`
	Details   string    `db:"details" json:"details"`  // JSON
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// CreateRuleRequest is the input for creating a new validation rule.
type CreateRuleRequest struct {
	Name         string `json:"name" binding:"required"`
	Category     string `json:"category" binding:"required"`
	TargetType   string `json:"target_type" binding:"required"`
	Condition    string `json:"condition" binding:"required"`
	ErrorMessage string `json:"error_message"`
	Severity     string `json:"severity"`
}

// UpdateRuleRequest is the input for updating a validation rule.
type UpdateRuleRequest struct {
	Name         string `json:"name,omitempty"`
	Category     string `json:"category,omitempty"`
	TargetType   string `json:"target_type,omitempty"`
	Condition    string `json:"condition,omitempty"`
	ErrorMessage string `json:"error_message,omitempty"`
	Severity     string `json:"severity,omitempty"`
	Enabled      *bool  `json:"enabled,omitempty"`
}

// ValidateRequest is the generic input for validating arbitrary data.
type ValidateRequest struct {
	TargetType string                 `json:"target_type" binding:"required"`
	TargetID   string                 `json:"target_id" binding:"required"`
	Data       map[string]interface{} `json:"data" binding:"required"`
}

// ValidateCIRequest is the input for validating a CI record.
type ValidateCIRequest struct {
	Data map[string]interface{} `json:"data" binding:"required"`
}

// ValidateRelationshipRequest is the input for validating a CI relationship.
type ValidateRelationshipRequest struct {
	Data map[string]interface{} `json:"data" binding:"required"`
}

// ValidationResultSummary aggregates a validation run for the handler response.
type ValidationResultSummary struct {
	Passed  int `json:"passed"`
	Failed  int `json:"failed"`
	Warning int `json:"warning"`
	Results []CMDBValidationResult `json:"results"`
}
