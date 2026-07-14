package models

import "time"

// Metric represents an efficiency metric.
type Metric struct {
	ID           string  `json:"id" db:"id"`
	TenantID     string  `json:"tenantId" db:"tenant_id"`
	Name         string  `json:"name" db:"name"`
	Description  *string `json:"description" db:"description"`
	MetricType   string  `json:"metricType" db:"metric_type"`
	Scope        *string `json:"scope" db:"scope"`
	ScopeID      *string `json:"scopeId" db:"scope_id"`
	BaselineValue *float64 `json:"baselineValue" db:"baseline_value"`
	CurrentValue *float64 `json:"currentValue" db:"current_value"`
	TargetValue  *float64 `json:"targetValue" db:"target_value"`
	Unit         *string `json:"unit" db:"unit"`
	Status       string  `json:"status" db:"status"`
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt" db:"updated_at"`
}

// CreateMetricRequest is the request body for creating a metric.
type CreateMetricRequest struct {
	Name          string   `json:"name" binding:"required"`
	Description   *string  `json:"description"`
	MetricType    string   `json:"metricType" binding:"required"`
	Scope         *string  `json:"scope"`
	ScopeID       *string  `json:"scopeId"`
	BaselineValue *float64 `json:"baselineValue"`
	TargetValue   *float64 `json:"targetValue"`
	Unit          *string  `json:"unit"`
}

// UpdateMetricRequest is the request body for updating a metric.
type UpdateMetricRequest struct {
	Name          *string  `json:"name"`
	Description   *string  `json:"description"`
	MetricType    *string  `json:"metricType"`
	Status        *string  `json:"status"`
	CurrentValue  *float64 `json:"currentValue"`
}

// Score represents an efficiency score.
type Score struct {
	ID        string     `json:"id" db:"id"`
	TenantID  string     `json:"tenantId" db:"tenant_id"`
	MetricID  string     `json:"metricId" db:"metric_id"`
	Score     float64    `json:"score" db:"score"`
	ScoreDate string     `json:"scoreDate" db:"score_date"`
	Notes     *string    `json:"notes" db:"notes"`
	CreatedAt time.Time  `json:"createdAt" db:"created_at"`
}

// CreateScoreRequest is the request body for creating a score.
type CreateScoreRequest struct {
	MetricID string  `json:"metricId" binding:"required"`
	Score    float64 `json:"score" binding:"required"`
	Notes    *string `json:"notes"`
}

// Recommendation represents an efficiency recommendation.
type Recommendation struct {
	ID                 string     `json:"id" db:"id"`
	TenantID           string     `json:"tenantId" db:"tenant_id"`
	MetricID           *string    `json:"metricId" db:"metric_id"`
	Title              string     `json:"title" db:"title"`
	Description        string     `json:"description" db:"description"`
	ImpactLevel        string     `json:"impactLevel" db:"impact_level"`
	EstimatedSavings   *float64   `json:"estimatedSavings" db:"estimated_savings"`
	ImplementationEffort *string   `json:"implementationEffort" db:"implementation_effort"`
	Status             string     `json:"status" db:"status"`
	AcceptedBy         *string    `json:"acceptedBy" db:"accepted_by"`
	AcceptedAt         *time.Time `json:"acceptedAt" db:"accepted_at"`
	ImplementedAt      *time.Time `json:"implementedAt" db:"implemented_at"`
	CreatedAt          time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt          time.Time  `json:"updatedAt" db:"updated_at"`
}

// CreateRecommendationRequest is the request body for creating a recommendation.
type CreateRecommendationRequest struct {
	Title                 string   `json:"title" binding:"required"`
	Description           string   `json:"description" binding:"required"`
	ImpactLevel           string   `json:"impactLevel" binding:"required"`
	EstimatedSavings      *float64 `json:"estimatedSavings"`
	ImplementationEffort  *string  `json:"implementationEffort"`
}

// UpdateRecommendationRequest is the request body for updating a recommendation.
type UpdateRecommendationRequest struct {
	Status *string `json:"status"`
}

// MetricFilter represents filter parameters for listing metrics.
type MetricFilter struct {
	MetricType *string
	Scope      *string
	Status     *string
	Limit      int
	Offset     int
}

// EfficiencyStats holds aggregated efficiency statistics.
type EfficiencyStats struct {
	TotalMetrics      int     `json:"totalMetrics"`
	AvgScore          float64 `json:"avgScore"`
	TotalRecommendations int `json:"totalRecommendations"`
	AcceptedCount     int     `json:"acceptedCount"`
	ImplementedCount  int     `json:"implementedCount"`
}