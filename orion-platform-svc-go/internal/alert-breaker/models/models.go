package models

import "time"

// AlertBreaker represents a circuit-breaker rule for alert handling.
type AlertBreaker struct {
	ID          string            `db:"id" json:"id"`
	TenantID    string            `db:"tenant_id" json:"tenant_id"`
	Name        string            `db:"name" json:"name"`
	Description string            `db:"description" json:"description"`
	AlertID     string            `db:"alert_id" json:"alert_id"`
	Rule        map[string]string `db:"rule" json:"rule"`
	Status      string            `db:"status" json:"status"` // active|inactive|open|half-open
	CreatedAt   time.Time         `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time         `db:"updated_at" json:"updated_at"`
}

// CreateAlertBreakerRequest is the request body for creating an alert breaker.
type CreateAlertBreakerRequest struct {
	Name        string            `json:"name" binding:"required"`
	Description string            `json:"description"`
	AlertID     string            `json:"alertId"`
	Rule        map[string]string `json:"rule"`
}

// UpdateAlertBreakerRequest is the request body for updating an alert breaker.
type UpdateAlertBreakerRequest struct {
	Name        *string           `json:"name"`
	Description *string           `json:"description"`
	Status      *string           `json:"status"`
	Rule        map[string]string `json:"rule"`
}

// EvaluateAlertRequest is the request body for POST /alert-breaker/evaluate.
// It is independent of the AlertBreaker CRUD: the caller supplies the policy
// identifier (numeric, matching alert_breaker_state.policy_id), the alert
// identity, and the rule to evaluate against.
type EvaluateAlertRequest struct {
	// PolicyID is the numeric policy identifier stored in alert_breaker_state.
	// It does NOT have to match alert_breakers.id (which is a UUID string);
	// the mapping between the two is a separate concern (mapping table or
	// BIGINT column on alert_breakers).
	PolicyID int64 `json:"policyId" binding:"required"`
	// AlertID is the source alert's identity.
	AlertID string `json:"alertId"`
	// Fingerprint is a stable hash of the alert content.
	Fingerprint string `json:"fingerprint"`
	// Rule is the AlertBreaker rule (map[string]string). Missing "threshold"
	// or "window" keys fall back to defaults (5 / 10min).
	Rule map[string]string `json:"rule"`
}

// EvaluateAlertResponse is the response body for POST /alert-breaker/evaluate.
type EvaluateAlertResponse struct {
	// Broken is true when the alert should be suppressed.
	Broken bool `json:"broken"`
	// Count is the current counter value after this evaluation.
	Count int64 `json:"count"`
	// WindowStart is the start of the current counting window.
	WindowStart time.Time `json:"windowStart"`
	// WindowEnd is the end of the current counting window.
	WindowEnd time.Time `json:"windowEnd"`
	// Threshold is the rule's threshold.
	Threshold int64 `json:"threshold"`
	// Reason is a human-readable explanation.
	Reason string `json:"reason"`
}
