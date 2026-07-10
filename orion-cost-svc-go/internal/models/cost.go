package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB is a helper type for PostgreSQL jsonb columns.
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(src interface{}) error {
	if src == nil {
		*j = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, j)
		case string:
		return json.Unmarshal([]byte(v), j)
	default:
		return fmt.Errorf("cannot scan %T into JSONB", src)
	}
}

// CostCategory represents the category of a cost record.
type CostCategory string

const (
	CategoryCompute   CostCategory = "compute"
	CategoryStorage   CostCategory = "storage"
	CategoryNetwork   CostCategory = "network"
	CategoryDatabase  CostCategory = "database"
	CategoryAI        CostCategory = "ai"
	CategorySaaS      CostCategory = "saas"
	CategoryOther     CostCategory = "other"
)

// AnomalyType represents the type of a cost anomaly.
type AnomalyType string

const (
	AnomalySpike         AnomalyType = "spike"
	AnomalyDrop          AnomalyType = "drop"
	AnomalyTrendChange   AnomalyType = "trend_change"
	AnomalySustainedHigh AnomalyType = "sustained_high"
)

// BudgetPeriod represents the billing period for a budget.
type BudgetPeriod string

const (
	BudgetPeriodDaily   BudgetPeriod = "daily"
	BudgetPeriodWeekly  BudgetPeriod = "weekly"
	BudgetPeriodMonthly BudgetPeriod = "monthly"
	BudgetPeriodYearly  BudgetPeriod = "yearly"
)

// OptimizationCategory represents the type of optimization.
type OptimizationCategory string

const (
	OptUnusedResources    OptimizationCategory = "unused-resources"
	OptRightSizing        OptimizationCategory = "right-sizing"
	OptScheduling         OptimizationCategory = "scheduling"
	OptReservedInstances  OptimizationCategory = "reserved-instances"
	OptSpotInstances      OptimizationCategory = "spot-instances"
	OptStorageOptimization OptimizationCategory = "storage-optimization"
	OptNetworkOptimization OptimizationCategory = "network-optimization"
)

// OptimizationPriority represents the priority of an optimization suggestion.
type OptimizationPriority string

const (
	PriorityCritical OptimizationPriority = "critical"
	PriorityHigh     OptimizationPriority = "high"
	PriorityMedium   OptimizationPriority = "medium"
	PriorityLow      OptimizationPriority = "low"
)

// OptimizationStatus represents the lifecycle state of an optimization.
type OptimizationStatus string

const (
	OptStatusIdentified OptimizationStatus = "identified"
	OptStatusPending    OptimizationStatus = "pending"
	OptStatusApplied    OptimizationStatus = "applied"
	OptStatusRejected   OptimizationStatus = "rejected"
	OptStatusCompleted  OptimizationStatus = "completed"
)

// BudgetStatus represents the lifecycle state of a budget.
type BudgetStatus string

const (
	BudgetStatusActive    BudgetStatus = "active"
	BudgetStatusExhausted BudgetStatus = "exhausted"
	BudgetStatusDeleted   BudgetStatus = "deleted"
)

// ==================== Entities ====================

// CostRecord represents a cost data point.
type CostRecord struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	Date      time.Time `db:"date" json:"date"`
	Service   string    `db:"service" json:"service"`
	ResourceID *string  `db:"resource_id" json:"resource_id"`
	Region    *string   `db:"region" json:"region"`
	Cost      float64   `db:"cost" json:"cost"`
	Currency  string    `db:"currency" json:"currency"`
	Category  string    `db:"category" json:"category"`
	Tags      JSONB     `db:"tags" json:"tags"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// Budget represents a tenant-level spending limit.
type Budget struct {
	ID             string       `db:"id" json:"id"`
	TenantID       string       `db:"tenant_id" json:"tenant_id"`
	Name           string       `db:"name" json:"name"`
	Amount         float64      `db:"amount" json:"amount"`
	Period         BudgetPeriod `db:"period" json:"period"`
	AlertThreshold float64      `db:"alert_threshold" json:"alert_threshold"`
	CurrentSpend   float64      `db:"current_spend" json:"current_spend"`
	Status         string       `db:"status" json:"status"`
	CreatedAt      time.Time    `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time    `db:"updated_at" json:"updated_at"`
}

// AnomalyAlert represents a detected cost anomaly.
type AnomalyAlert struct {
	ID              string      `db:"id" json:"id"`
	TenantID        string      `db:"tenant_id" json:"tenant_id"`
	Type            AnomalyType `db:"type" json:"type"`
	Severity        string      `db:"severity" json:"severity"`
	Value           float64     `db:"value" json:"value"`
	ExpectedValue   float64     `db:"expected_value" json:"expected_value"`
	Deviation       float64     `db:"deviation" json:"deviation"`
	DetectedAt      time.Time   `db:"detected_at" json:"detected_at"`
	TimeWindowStart time.Time   `db:"time_window_start" json:"time_window_start"`
	TimeWindowEnd   time.Time   `db:"time_window_end" json:"time_window_end"`
	Description     string      `db:"description" json:"description"`
	Metadata        JSONB       `db:"metadata" json:"metadata"`
}

// ==================== Business Models ====================

// CostAggregation groups costs by a dimension.
type CostAggregation struct {
	Service   string  `json:"service"`
	TotalCost float64 `json:"total_cost"`
	Count     int     `json:"count"`
}

// CostSummary aggregates costs across multiple dimensions.
type CostSummary struct {
	TotalCost     float64             `json:"total_cost"`
	Currency      string              `json:"currency"`
	ByService     map[string]float64  `json:"by_service"`
	ByResource    map[string]float64  `json:"by_resource"`
	ByRegion      map[string]float64  `json:"by_region"`
	ByCategory    map[string]float64  `json:"by_category"`
	RecordCount   int                 `json:"record_count"`
	PeriodStart   string              `json:"period_start"`
	PeriodEnd     string              `json:"period_end"`
}

// CostTrendPoint represents a point in a cost time series.
type CostTrendPoint struct {
	Date string  `json:"date"`
	Cost float64 `json:"cost"`
}

// CostTrendResult contains trend analysis data.
type CostTrendResult struct {
	Points      []CostTrendPoint `json:"points"`
	TotalCost   float64          `json:"total_cost"`
	AverageCost float64          `json:"average_cost"`
	Trend       string           `json:"trend"`
	ChangeRate  float64          `json:"change_rate"`
}

// BudgetHealth represents the health status of a budget.
type BudgetHealth struct {
	Budget       *Budget  `json:"budget"`
	UsagePercent float64  `json:"usage_percent"`
	Status       string   `json:"status"`
	Remaining    float64  `json:"remaining"`
}

// OptimizationRecommendation contains an optimization suggestion.
type OptimizationRecommendation struct {
	ID               string               `json:"id"`
	TenantID         string               `json:"tenant_id"`
	Category         OptimizationCategory `json:"category"`
	Priority         OptimizationPriority `json:"priority"`
	Status           OptimizationStatus   `json:"status"`
	ResourceIDs      []string             `json:"resource_ids"`
	Description      string               `json:"description"`
	EstimatedSavings float64              `json:"estimated_savings"`
	Effort           int                  `json:"effort"`
	CreatedAt        time.Time            `json:"created_at"`
	UpdatedAt        *time.Time           `json:"updated_at,omitempty"`
	Notes            string               `json:"notes,omitempty"`
	Metadata         JSONB                `json:"metadata,omitempty"`
}

// UtilizationRecord holds resource utilization metrics.
type UtilizationRecord struct {
	ResourceID         string   `json:"resource_id"`
	ResourceType       string   `json:"resource_type"`
	ResourceName       string   `json:"resource_name"`
	CPUUtilization     float64  `json:"cpu_utilization"`
	MemoryUtilization  float64  `json:"memory_utilization"`
	StorageUtilization float64  `json:"storage_utilization"`
	MonthlyCost        float64  `json:"monthly_cost"`
	TenantID           string   `json:"tenant_id"`
	Environment        string   `json:"environment,omitempty"`
}

// UtilizationAnalysis aggregates utilization across resources.
type UtilizationAnalysis struct {
	TenantID               string                 `json:"tenant_id"`
	TotalResources         int                    `json:"total_resources"`
	UnderutilizedResources int                    `json:"underutilized_resources"`
	UnusedResources        int                    `json:"unused_resources"`
	OptimalResources       int                    `json:"optimal_resources"`
	PotentialMonthlySavings float64              `json:"potential_monthly_savings"`
	ByCategory             map[OptimizationCategory]int `json:"by_category"`
	AnalyzedAt             time.Time              `json:"analyzed_at"`
}

// AnomalyDetectionResult contains the output of anomaly detection.
type AnomalyDetectionResult struct {
	Anomalies           []AnomalyAlert `json:"anomalies"`
	TimeWindow          TimeRange      `json:"time_window"`
	DataPointsAnalyzed  int            `json:"data_points_analyzed"`
	DetectedAt          time.Time      `json:"detected_at"`
}

// TimeRange is a start/end time pair.
type TimeRange struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

// CostForecastResult contains a cost forecast.
type CostForecastResult struct {
	PredictedEndOfMonthCost float64                `json:"predicted_end_of_month_cost"`
	CurrentSpend            float64                `json:"current_spend"`
	ProjectedOverage        float64                `json:"projected_overage"`
	Confidence              float64                `json:"confidence"`
	DailyForecast           []ForecastDay          `json:"daily_forecast"`
	GeneratedAt             time.Time              `json:"generated_at"`
}

// ForecastDay is a single day prediction.
type ForecastDay struct {
	Date      string  `json:"date"`
	Predicted float64 `json:"predicted"`
}

// ==================== Request/Response DTOs ====================

// PaginatedRequest provides pagination parameters.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}

// ListCostsRequest filters cost records.
type ListCostsRequest struct {
	PaginatedRequest
	TenantID   string `form:"tenant_id"`
	StartDate  string `form:"start_date"`
	EndDate    string `form:"end_date"`
	Service    string `form:"service"`
	ResourceID string `form:"resource_id"`
	Region     string `form:"region"`
}

// RecordCostRequest is the input for creating a cost record.
type RecordCostRequest struct {
	TenantID   string `json:"tenant_id" binding:"required"`
	Service    string `json:"service" binding:"required"`
	Cost       float64 `json:"cost" binding:"required"`
	Date       string `json:"date"`
	ResourceID string `json:"resource_id"`
	Region     string `json:"region"`
	Currency   string `json:"currency"`
	Category   string `json:"category"`
	Tags       JSONB  `json:"tags"`
}

// CreateBudgetRequest is the input for creating a budget.
type CreateBudgetRequest struct {
	Name           string       `json:"name" binding:"required"`
	Amount         float64      `json:"amount" binding:"required,min=0"`
	Period         BudgetPeriod `json:"period"`
	AlertThreshold float64      `json:"alert_threshold"`
	Currency       string       `json:"currency"`
}

// UpdateBudgetRequest is the input for updating a budget.
type UpdateBudgetRequest struct {
	Name           *string      `json:"name"`
	Amount         *float64     `json:"amount"`
	Period         *BudgetPeriod `json:"period"`
	AlertThreshold *float64     `json:"alert_threshold"`
}

// DetectAnomaliesRequest is the input for anomaly detection.
type DetectAnomaliesRequest struct {
	StartDate string `json:"start_date" binding:"required"`
	EndDate   string `json:"end_date" binding:"required"`
}

// GetCostsQueryParams holds query parameters for listing costs.
type GetCostsQueryParams struct {
	Page      int    `form:"page"`
	PageSize  int    `form:"page_size"`
	StartDate string `form:"start_date"`
	EndDate   string `form:"end_date"`
	Service   string `form:"service"`
	Region    string `form:"region"`
}

// GetOptimizationsQueryParams holds query parameters for optimizations.
type GetOptimizationsQueryParams struct {
	Category   OptimizationCategory `form:"category"`
	Status     OptimizationStatus   `form:"status"`
	MinSavings float64              `form:"min_savings"`
}
