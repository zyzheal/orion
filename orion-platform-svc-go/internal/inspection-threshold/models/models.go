package models

import "time"

// Threshold defines a monitoring threshold with severity levels.
type Threshold struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenantId" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	MetricName  string    `json:"metricName" db:"metric_name"`
	Warning     float64   `json:"warning" db:"warning"`
	Critical    float64   `json:"critical" db:"critical"`
	EvaluationPeriod int  `json:"evaluationPeriod" db:"evaluation_period"`
	Operator    string    `json:"operator" db:"operator"`
	Enabled     bool      `json:"enabled" db:"enabled"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}

type CreateThresholdRequest struct {
	Name             string   `json:"name" binding:"required"`
	MetricName       string   `json:"metricName" binding:"required"`
	Warning          float64  `json:"warning"`
	Critical         float64  `json:"critical"`
	EvaluationPeriod int      `json:"evaluationPeriod"`
	Operator         string   `json:"operator"`
	Enabled          bool     `json:"enabled"`
	TenantID         *string  `json:"tenantId"`
}
