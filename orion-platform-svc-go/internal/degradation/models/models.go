package models

import "time"

// Degradation represents a Degradation.
type Degradation struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenantId" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

// CreateDegradationRequest is the request body for creating a Degradation.
type CreateDegradationRequest struct {
	Name string `json:"name" binding:"required"`
}

// UpdateDegradationRequest is the request body for updating a Degradation.
type UpdateDegradationRequest struct {
	Name *string `json:"name"`
}

// DegradationPolicy defines a degradation policy with thresholds.
type DegradationPolicy struct {
	ID                 string    `json:"id" db:"id"`
	TenantID           string    `json:"tenantId" db:"tenant_id"`
	Name               string    `json:"name" db:"name"`
	Description        string    `json:"description" db:"description"`
	ErrorRateThreshold float64   `json:"errorRateThreshold" db:"error_rate_threshold"`   // 0.0 - 1.0
	LatencyThresholdMs int64     `json:"latencyThresholdMs" db:"latency_threshold_ms"`   // ms
	WindowSeconds      int64     `json:"windowSeconds" db:"window_seconds"`               // evaluation window
	MinSampleCount     int       `json:"minSampleCount" db:"min_sample_count"`            // minimum samples before evaluation
	Action             string    `json:"action" db:"action"`                              // rate_limit | circuit_break | fallback | degrade_response
	Enabled            bool      `json:"enabled" db:"enabled"`
	CreatedAt          time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt          time.Time `json:"updatedAt" db:"updated_at"`
}

// DegradationTrigger records a degradation trigger event.
type DegradationTrigger struct {
	ID          string     `json:"id" db:"id"`
	TenantID    string     `json:"tenantId" db:"tenant_id"`
	PolicyID    string     `json:"policyId" db:"policy_id"`
	Status      string     `json:"status" db:"status"`   // active | resolved
	Reason      string     `json:"reason" db:"reason"`
	ErrorRate   float64    `json:"errorRate" db:"error_rate"`
	LatencyMs   int64      `json:"latencyMs" db:"latency_ms"`
	TriggeredAt time.Time  `json:"triggeredAt" db:"triggered_at"`
	ResolvedAt  *time.Time `json:"resolvedAt,omitempty" db:"resolved_at"`
	ResolvedBy  string     `json:"resolvedBy,omitempty" db:"resolved_by"`
	CreatedAt   time.Time  `json:"createdAt" db:"created_at"`
}

// DegradationAction records an action taken during degradation.
type DegradationAction struct {
	ID        string    `json:"id" db:"id"`
	TriggerID string    `json:"triggerId" db:"trigger_id"`
	TenantID  string    `json:"tenantId" db:"tenant_id"`
	Action    string    `json:"action" db:"action"`   // rate_limit | circuit_break | fallback | degrade_response
	Detail    string    `json:"detail" db:"detail"`
	Status    string    `json:"status" db:"status"`   // applied | reverted
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

// DegradationStatus represents the current degradation state for a policy.
type DegradationStatus struct {
	PolicyID          string              `json:"policyId"`
	PolicyName        string              `json:"policyName"`
	IsDegraded        bool                `json:"isDegraded"`
	CurrentErrorRate  float64             `json:"currentErrorRate"`
	CurrentLatencyMs  int64               `json:"currentLatencyMs"`
	ActiveTrigger     *DegradationTrigger `json:"activeTrigger,omitempty"`
	Actions           []DegradationAction `json:"actions,omitempty"`
	EvaluatedAt       time.Time           `json:"evaluatedAt"`
}

// EvaluateRequest is the request body for evaluating a degradation policy.
type EvaluateRequest struct {
	PolicyID    string  `json:"policyId" binding:"required"`
	ErrorRate   float64 `json:"errorRate" binding:"required"`
	LatencyMs   int64   `json:"latencyMs" binding:"required"`
	SampleCount int     `json:"sampleCount"`
}

// EvaluateResponse is the response body for evaluation.
type EvaluateResponse struct {
	ShouldDegrade       bool    `json:"shouldDegrade"`
	Reason              string  `json:"reason,omitempty"`
	ErrorRate           float64 `json:"errorRate"`
	LatencyMs           int64   `json:"latencyMs"`
	ErrorRateThreshold  float64 `json:"errorRateThreshold"`
	LatencyThresholdMs  int64   `json:"latencyThresholdMs"`
}

// TriggerRequest is the request body for triggering a degradation.
type TriggerRequest struct {
	PolicyID  string  `json:"policyId" binding:"required"`
	Reason    string  `json:"reason" binding:"required"`
	ErrorRate float64 `json:"errorRate"`
	LatencyMs int64   `json:"latencyMs"`
}

// ResolveRequest is the request body for resolving a degradation.
type ResolveRequest struct {
	ResolvedBy string `json:"resolvedBy" binding:"required"`
}
