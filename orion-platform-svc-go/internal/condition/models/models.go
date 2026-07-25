package models

import "time"

// ConditionGroup represents a condition group that can contain nested groups
// and condition expressions.
type ConditionGroup struct {
	ID          string     `json:"id" db:"id"`
	TenantID    string     `json:"tenant_id" db:"tenant_id"`
	Name        string     `json:"name" db:"name"`
	Type        string     `json:"type" db:"type"`         // "and", "or", "not"
	Children    string     `json:"children" db:"children"` // JSON: nested condition expressions
	Enabled     bool       `json:"enabled" db:"enabled"`
	Description string     `json:"description" db:"description"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
}

// ConditionExpression represents a single condition expression within a group.
type ConditionExpression struct {
	ID        string    `json:"id" db:"id"`
	GroupID   string    `json:"group_id" db:"group_id"`
	Field     string    `json:"field" db:"field"`      // Variable/field name
	Operator  string    `json:"operator" db:"operator"` // "=", "!", ">", "<", ">=", "<=", "contains", "regex", "in", "between", "null", "matches"
	Value     string    `json:"value" db:"value"`       // Expected value
	ValueType string    `json:"value_type" db:"value_type"` // "string", "number", "boolean", "array", "object"
	Enabled   bool      `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// CreateGroupRequest is the body for creating a condition group.
type CreateGroupRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Type        string                 `json:"type" binding:"required,oneof=and or not"`
	Children    []map[string]interface{} `json:"children"`
	Description string                 `json:"description"`
	Enabled     *bool                  `json:"enabled"`
}

// CreateExpressionRequest is the body for creating a condition expression.
type CreateExpressionRequest struct {
	Field     string `json:"field" binding:"required"`
	Operator  string `json:"operator" binding:"required"`
	Value     string `json:"value"`
	ValueType string `json:"value_type"`
	Enabled   *bool  `json:"enabled"`
}

// EvaluateRequest is the body for evaluating a condition group.
type EvaluateRequest struct {
	GroupID   string                 `json:"groupId" binding:"required"`
	Variables map[string]interface{} `json:"variables" binding:"required"`
}

// EvaluateResult is the response from evaluating a condition group.
type EvaluateResult struct {
	GroupID string `json:"groupId"`
	Result  bool   `json:"result"`
}
