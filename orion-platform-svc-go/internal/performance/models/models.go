package models

import "time"

// Baseline represents a performance baseline for a service.
type Baseline struct {
	ID            string     `db:"id" json:"id"`
	TenantID      string     `db:"tenant_id" json:"tenantId"`
	ServiceName   string     `db:"service_name" json:"serviceName"`
	Metric        string     `db:"metric" json:"metric"`
	Threshold     float64    `db:"threshold" json:"threshold"`
	WindowDays    int        `db:"window_days" json:"windowDays"`
	Status        string     `db:"status" json:"status"`
	CreatedAt     time.Time  `db:"created_at" json:"createdAt"`
}

// Evaluation represents a baseline evaluation history.
type Evaluation struct {
	ID         string     `db:"id" json:"id"`
	TenantID   string     `db:"tenant_id" json:"tenantId"`
	BaselineID string     `db:"baseline_id" json:"baselineId"`
	Value      float64    `db:"value" json:"value"`
	Status     string     `db:"status" json:"status"`
	Timestamp  time.Time  `db:"timestamp" json:"timestamp"`
	CreatedAt  time.Time  `db:"created_at" json:"createdAt"`
}

// Profile represents a service performance profile.
type Profile struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenantId"`
	ServiceName string     `db:"service_name" json:"serviceName"`
	Timestamp   time.Time  `db:"timestamp" json:"timestamp"`
	CreatedAt   time.Time  `db:"created_at" json:"createdAt"`
}

// Bottleneck represents a detected performance bottleneck.
type Bottleneck struct {
	ID          string  `db:"id" json:"id"`
	ProfileID   string  `db:"profile_id" json:"profileId"`
	ServiceName string  `db:"service_name" json:"serviceName"`
	Type        string  `db:"type" json:"type"`
	Description string  `db:"description" json:"description"`
	Score       float64 `db:"score" json:"score"`
}

// Suggestion represents a performance improvement suggestion.
type Suggestion struct {
	ID          string  `db:"id" json:"id"`
	ServiceName string  `db:"service_name" json:"serviceName"`
	Type        string  `db:"type" json:"type"`
	Description string  `db:"description" json:"description"`
	Priority    string  `db:"priority" json:"priority"`
}

// RegressionResult represents a detected regression.
type RegressionResult struct {
	ID          string  `db:"id" json:"id"`
	ServiceName string  `db:"service_name" json:"serviceName"`
	Metric      string  `db:"metric" json:"metric"`
	Previous    float64 `db:"previous" json:"previous"`
	Current     float64 `db:"current" json:"current"`
	ChangePct   float64 `db:"change_pct" json:"changePct"`
	Timestamp   time.Time `db:"timestamp" json:"timestamp"`
}

// CreateBaselineRequest is the request body for creating a baseline.
type CreateBaselineRequest struct {
	ServiceName string  `json:"serviceName" binding:"required"`
	Metric      string  `json:"metric" binding:"required"`
	Threshold   float64 `json:"threshold"`
	WindowDays  int     `json:"windowDays"`
}

// EvaluateRequest is the request body for evaluating performance.
type EvaluateRequest struct {
	ServiceName string  `json:"serviceName" binding:"required"`
	Metric      string  `json:"metric" binding:"required"`
	Value       float64 `json:"value" binding:"required"`
}

// DetectRegressionRequest is the request body for detecting regressions.
type DetectRegressionRequest struct {
	ServiceName string  `json:"serviceName" binding:"required"`
	Metric      string  `json:"metric" binding:"required"`
	Previous    float64 `json:"previous"`
	Current     float64 `json:"current" binding:"required"`
}

// TestResultRequest is the request body for recording test results.
type TestResultRequest struct {
	ServiceName string  `json:"serviceName" binding:"required"`
	TestName    string  `json:"testName" binding:"required"`
	Duration    int64   `json:"duration"`
	Status      string  `json:"status" binding:"required"`
}
