package models

import "time"

// SLODefinition represents a Service Level Objective definition.
type SLODefinition struct {
	ID                string            `db:"id" json:"id"`
	TenantID          string            `db:"tenant_id" json:"tenant_id"`
	Name              string            `db:"name" json:"name"`
	DisplayName       string            `db:"display_name" json:"display_name"`
	SLOType           string            `db:"slo_type" json:"slo_type"`          // availability, latency, throughput, custom
	Target            float64           `db:"target" json:"target"`              // e.g. 99.9
	MeasurementWindow string            `db:"measurement_window" json:"measurement_window"` // 7d, 30d, 90d
	AlertThreshold    float64           `db:"alert_threshold" json:"alert_threshold"`
	MetricQuery       string            `db:"metric_query" json:"metric_query"`
	Enabled           bool              `db:"enabled" json:"enabled"`
	Description       string            `db:"description" json:"description"`
	Tags              map[string]string `db:"tags" json:"tags"`
	CreatedAt         time.Time         `db:"created_at" json:"created_at"`
	UpdatedAt         time.Time         `db:"updated_at" json:"updated_at"`
}

// SLIMeasurement represents a point-in-time SLI measurement.
type SLIMeasurement struct {
	ID            string    `db:"id" json:"id"`
	SLOID         string    `db:"slo_id" json:"slo_id"`
	TenantID      string    `db:"tenant_id" json:"tenant_id"`
	Value         float64   `db:"value" json:"value"`
	MeasuredAt    time.Time `db:"measured_at" json:"measured_at"`
	Total         int64     `db:"total" json:"total"`
	Success       int64     `db:"success" json:"success"`
	ErrorCount    int64     `db:"error_count" json:"error_count"`
	Metadata      string    `db:"metadata" json:"metadata"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
}

// ErrorBudget represents the remaining error budget for an SLO.
type ErrorBudget struct {
	ID               string    `db:"id" json:"id"`
	SLOID            string    `db:"slo_id" json:"slo_id"`
	TenantID         string    `db:"tenant_id" json:"tenant_id"`
	PeriodStart      time.Time `db:"period_start" json:"period_start"`
	PeriodEnd        time.Time `db:"period_end" json:"period_end"`
	TotalBudget      float64   `db:"total_budget" json:"total_budget"`
	RemainingBudget  float64   `db:"remaining_budget" json:"remaining_budget"`
	ConsumedBudget   float64   `db:"consumed_budget" json:"consumed_budget"`
	BudgetUtilization float64  `db:"budget_utilization" json:"budget_utilization"`
	ComputedAt       time.Time `db:"computed_at" json:"computed_at"`
	CreatedAt        time.Time `db:"created_at" json:"created_at"`
}

// CreateSLORequest is the request body for creating an SLO definition.
type CreateSLORequest struct {
	Name              string            `json:"name" binding:"required"`
	DisplayName       string            `json:"display_name" binding:"required"`
	SLOType           string            `json:"slo_type" binding:"required"`
	Target            float64           `json:"target" binding:"required,gt=0,lte=100"`
	MeasurementWindow string            `json:"measurement_window" binding:"required"`
	AlertThreshold    float64           `json:"alert_threshold"`
	MetricQuery       string            `json:"metric_query"`
	Description       string            `json:"description"`
	Tags              map[string]string `json:"tags"`
}

// UpdateSLORequest is the request body for updating an SLO definition.
type UpdateSLORequest struct {
	DisplayName       *string           `json:"display_name"`
	SLOType           *string           `json:"slo_type"`
	Target            *float64          `json:"target"`
	MeasurementWindow *string           `json:"measurement_window"`
	AlertThreshold    *float64          `json:"alert_threshold"`
	MetricQuery       *string           `json:"metric_query"`
	Enabled           *bool             `json:"enabled"`
	Description       *string           `json:"description"`
	Tags              map[string]string `json:"tags"`
}

// SLIMeasurementRequest is the request body for recording an SLI measurement.
type SLIMeasurementRequest struct {
	SLOID      string    `json:"slo_id" binding:"required"`
	Value      float64   `json:"value" binding:"required"`
	Total      int64     `json:"total" binding:"required"`
	Success    int64     `json:"success" binding:"required"`
	ErrorCount int64     `json:"error_count"`
	MeasuredAt time.Time `json:"measured_at"`
	Metadata   string    `json:"metadata"`
}
