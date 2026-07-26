package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"
)

// JSONB is a PostgreSQL JSONB-compatible map type.
type JSONB map[string]any

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(value any) error {
	if value == nil {
		*j = make(JSONB)
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		*j = make(JSONB)
		return nil
	}
	return json.Unmarshal(bytes, j)
}

// AlertBreakerRule defines a rule for breaking/suppressing alerts.
type AlertBreakerRule struct {
	ID           string  `json:"id" db:"id"`
	TenantID     string  `json:"tenant_id" db:"tenant_id"`
	Name         string  `json:"name" db:"name"`
	Description  string  `json:"description" db:"description"`
	Matchers     JSONB   `json:"matchers" db:"matchers"`
	Actions      JSONB   `json:"actions" db:"actions"`
	IsActive     bool    `json:"is_active" db:"is_active"`
	CreatedBy    string  `json:"created_by" db:"created_by"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// CreateRuleRequest creates a new alert breaker rule.
type CreateRuleRequest struct {
	Name        string         `json:"name" binding:"required"`
	Description string         `json:"description"`
	Matchers    map[string]any `json:"matchers" binding:"required"`
	Actions     map[string]any `json:"actions" binding:"required"`
	IsActive    *bool          `json:"is_active"`
}

// UpdateRuleRequest updates an existing rule.
type UpdateRuleRequest struct {
	Name        *string        `json:"name"`
	Description *string        `json:"description"`
	Matchers    map[string]any `json:"matchers"`
	Actions     map[string]any `json:"actions"`
	IsActive    *bool          `json:"is_active"`
}

// EvaluateRequest evaluates rules against an alert.
type EvaluateRequest struct {
	Labels      map[string]any `json:"labels" binding:"required"`
	Annotations map[string]any `json:"annotations"`
}

// EvaluateResult contains evaluation output.
type EvaluateResult struct {
	RulesApplied []string `json:"rules_applied"`
	Actions      []any    `json:"actions"`
	EvaluatedAt  time.Time `json:"evaluated_at"`
}
