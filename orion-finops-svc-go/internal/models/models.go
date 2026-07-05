package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// CostSource represents the origin of cost data.
type CostSource string

const (
	CostSourceCloud CostSource = "cloud"
	CostSourceK8s   CostSource = "k8s"
	CostSourceSaaS  CostSource = "saas"
)

// CostPeriod represents the aggregation period.
type CostPeriod string

const (
	CostPeriodDaily    CostPeriod = "daily"
	CostPeriodWeekly   CostPeriod = "weekly"
	CostPeriodMonthly  CostPeriod = "monthly"
	CostPeriodQuarterly CostPeriod = "quarterly"
	CostPeriodYearly   CostPeriod = "yearly"
)

// CostEntityType represents the type of entity for cost tracking.
type CostEntityType string

const (
	EntityProject CostEntityType = "project"
	EntityTenant  CostEntityType = "tenant"
	EntityTeam    CostEntityType = "team"
)

// OptimizationCategory represents the type of cost optimization.
type OptimizationCategory string

const (
	OptRightSizing       OptimizationCategory = "right-sizing"
	OptUnusedResources   OptimizationCategory = "unused-resources"
	OptReservedInstances OptimizationCategory = "reserved-instances"
	OptStorageOptimization OptimizationCategory = "storage-optimization"
	OptScheduling        OptimizationCategory = "scheduling"
	OptArchitecture      OptimizationCategory = "architecture"
)

// OptimizationPriority represents the priority level of an optimization.
type OptimizationPriority string

const (
	PriorityCritical OptimizationPriority = "critical"
	PriorityHigh     OptimizationPriority = "high"
	PriorityMedium   OptimizationPriority = "medium"
	PriorityLow      OptimizationPriority = "low"
)

// OptimizationStatus represents the lifecycle of an optimization suggestion.
type OptimizationStatus string

const (
	OptStatusIdentified OptimizationStatus = "identified"
	OptStatusReviewing  OptimizationStatus = "reviewing"
	OptStatusApproved   OptimizationStatus = "approved"
	OptStatusInProgress OptimizationStatus = "in-progress"
	OptStatusCompleted  OptimizationStatus = "completed"
	OptStatusRejected   OptimizationStatus = "rejected"
)

// AlertStatus represents the lifecycle of a budget alert.
type AlertStatus string

const (
	AlertActive   AlertStatus = "active"
	AlertTriggered AlertStatus = "triggered"
	AlertResolved AlertStatus = "resolved"
	AlertDisabled AlertStatus = "disabled"
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

// CloudCost represents a cloud resource cost record.
type CloudCost struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenant_id"`
	ResourceType string    `db:"resource_type" json:"resource_type"`
	ResourceID   string    `db:"resource_id" json:"resource_id"`
	Provider     string    `db:"provider" json:"provider"`
	Region       string    `db:"region" json:"region"`
	Service      string    `db:"service" json:"service"`
	CostCents    int64     `db:"cost_cents" json:"cost_cents"`
	Currency     string    `db:"currency" json:"currency"`
	UsageAmount  float64   `db:"usage_amount" json:"usage_amount"`
	UsageUnit    string    `db:"usage_unit" json:"usage_unit"`
	PeriodStart  time.Time `db:"period_start" json:"period_start"`
	PeriodEnd    time.Time `db:"period_end" json:"period_end"`
	Tags         JSONB     `db:"tags" json:"tags"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

// K8sCost represents a Kubernetes cost record.
type K8sCost struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Cluster     string    `db:"cluster" json:"cluster"`
	Namespace   string    `db:"namespace" json:"namespace"`
	Workload    string    `db:"workload" json:"workload"`
	WorkloadType string   `db:"workload_type" json:"workload_type"`
	CPUCostCents int64    `db:"cpu_cost_cents" json:"cpu_cost_cents"`
	MemCostCents int64    `db:"mem_cost_cents" json:"mem_cost_cents"`
	StorageCostCents int64 `db:"storage_cost_cents" json:"storage_cost_cents"`
	TotalCostCents int64  `db:"total_cost_cents" json:"total_cost_cents"`
	Currency    string    `db:"currency" json:"currency"`
	CPUUsage    float64   `db:"cpu_usage" json:"cpu_usage"`
	MemUsage    float64   `db:"mem_usage" json:"mem_usage"`
	PeriodStart time.Time `db:"period_start" json:"period_start"`
	PeriodEnd   time.Time `db:"period_end" json:"period_end"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

// SaaSCost represents a SaaS service cost record.
type SaaSCost struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Provider    string    `db:"provider" json:"provider"`
	Plan        string    `db:"plan" json:"plan"`
	SeatsUsed   int       `db:"seats_used" json:"seats_used"`
	SeatsTotal  int       `db:"seats_total" json:"seats_total"`
	CostCents   int64     `db:"cost_cents" json:"cost_cents"`
	Currency    string    `db:"currency" json:"currency"`
	PeriodStart time.Time `db:"period_start" json:"period_start"`
	PeriodEnd   time.Time `db:"period_end" json:"period_end"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

// BudgetAlert represents a budget alert configuration.
type BudgetAlert struct {
	ID            string      `db:"id" json:"id"`
	TenantID      string      `db:"tenant_id" json:"tenant_id"`
	Name          string      `db:"name" json:"name"`
	BudgetCents   int64       `db:"budget_cents" json:"budget_cents"`
	ThresholdPct  int         `db:"threshold_pct" json:"threshold_pct"`
	CurrentSpendCents int64   `db:"current_spend_cents" json:"current_spend_cents"`
	Status        AlertStatus `db:"status" json:"status"`
	NotifyEmail   string      `db:"notify_email" json:"notify_email"`
	Period        CostPeriod  `db:"period" json:"period"`
	LastTriggeredAt *time.Time `db:"last_triggered_at" json:"last_triggered_at,omitempty"`
	CreatedAt     time.Time   `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time   `db:"updated_at" json:"updated_at"`
}

// CostSummary is the aggregated cost view.
type CostSummary struct {
	TotalCostCents  int64            `json:"total_cost_cents"`
	CloudCostCents  int64            `json:"cloud_cost_cents"`
	K8sCostCents    int64            `json:"k8s_cost_cents"`
	SaaSCostCents   int64            `json:"saas_cost_cents"`
	Currency        string           `json:"currency"`
	Period          CostPeriod       `json:"period"`
	Breakdown       []CostBreakdown  `json:"breakdown"`
}

// CostBreakdown represents cost by category.
type CostBreakdown struct {
	Category    string `json:"category"`
	CostCents   int64  `json:"cost_cents"`
	Percentage  float64 `json:"percentage"`
}

// CostTrend represents cost changes over time with statistical analysis.
type CostTrend struct {
	Period           CostPeriod       `json:"period"`
	Points           []CostTrendPoint `json:"points"`
	OverallChangeRate float64         `json:"overall_change_rate"`
	AverageCostCents int64            `json:"average_cost_cents"`
	MaxCostCents     int64            `json:"max_cost_cents"`
	MinCostCents     int64            `json:"min_cost_cents"`
}

// CostTrendPoint is a single data point in a cost trend.
type CostTrendPoint struct {
	Date       string  `json:"date"`
	CostCents  int64   `json:"cost_cents"`
	ChangeRate float64 `json:"change_rate"`
}

// CostByService represents cost breakdown by service name.
type CostByService struct {
	Service     string  `json:"service"`
	CostCents   int64   `json:"cost_cents"`
	Percentage  float64 `json:"percentage"`
	RecordCount int     `json:"record_count"`
}

// Budget represents a per-entity budget configuration.
type Budget struct {
	ID           string         `db:"id" json:"id"`
	TenantID     string         `db:"tenant_id" json:"tenant_id"`
	EntityType   CostEntityType `db:"entity_type" json:"entity_type"`
	EntityID     string         `db:"entity_id" json:"entity_id"`
	Name         string         `db:"name" json:"name"`
	AmountCents  int64          `db:"amount_cents" json:"amount_cents"`
	Currency     string         `db:"currency" json:"currency"`
	Period       CostPeriod     `db:"period" json:"period"`
	Environment  string         `db:"environment" json:"environment"`
	Description  string         `db:"description" json:"description"`
	Status       string         `db:"status" json:"status"`
	CreatedAt    time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time      `db:"updated_at" json:"updated_at"`
}

// BudgetThreshold represents an alert threshold for a budget.
type BudgetThreshold struct {
	ID          string     `db:"id" json:"id"`
	BudgetID    string     `db:"budget_id" json:"budget_id"`
	Percentage  int        `db:"percentage" json:"percentage"`
	Triggered   bool       `db:"triggered" json:"triggered"`
	TriggeredAt *time.Time `db:"triggered_at" json:"triggered_at,omitempty"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
}

// BudgetSpend represents a spend record against a budget.
type BudgetSpend struct {
	ID         string    `db:"id" json:"id"`
	BudgetID   string    `db:"budget_id" json:"budget_id"`
	AmountCents int64    `db:"amount_cents" json:"amount_cents"`
	RecordedAt time.Time `db:"recorded_at" json:"recorded_at"`
}

// BudgetAlertTrigger represents a triggered budget alert event.
type BudgetAlertTrigger struct {
	ID          string    `db:"id" json:"id"`
	BudgetID    string    `db:"budget_id" json:"budget_id"`
	ThresholdPct int      `db:"threshold_pct" json:"threshold_pct"`
	ActualCents int64     `db:"actual_cents" json:"actual_cents"`
	UsagePct    float64   `db:"usage_pct" json:"usage_pct"`
	EntityType  string    `db:"entity_type" json:"entity_type"`
	EntityID    string    `db:"entity_id" json:"entity_id"`
	TriggeredAt time.Time `db:"triggered_at" json:"triggered_at"`
}

// BudgetStatus represents the current status of a budget.
type BudgetStatus struct {
	BudgetID        string               `json:"budget_id"`
	EntityType      CostEntityType       `json:"entity_type"`
	EntityID        string               `json:"entity_id"`
	BudgetAmountCents int64              `json:"budget_amount_cents"`
	CurrentSpendCents int64              `json:"current_spend_cents"`
	UsagePercent    float64              `json:"usage_percent"`
	RemainingCents  int64                `json:"remaining_cents"`
	Period          CostPeriod           `json:"period"`
	OverBudget      bool                 `json:"over_budget"`
	TriggeredAlerts []BudgetAlertTrigger `json:"triggered_alerts"`
	ForecastedSpendCents *int64          `json:"forecasted_spend_cents,omitempty"`
}

// BudgetForecast represents a budget spending forecast.
type BudgetForecast struct {
	BudgetID             string  `json:"budget_id"`
	CurrentSpendCents    int64   `json:"current_spend_cents"`
	ForecastedSpendCents int64   `json:"forecasted_spend_cents"`
	ProjectedOverageCents int64  `json:"projected_overage_cents"`
	DailySpendRateCents  float64 `json:"daily_spend_rate_cents"`
	DaysUntilExhausted   int     `json:"days_until_exhausted"`
	WithinBudget         bool    `json:"within_budget"`
}

// CostOptimization represents a cost optimization recommendation.
type CostOptimization struct {
	ID                   string               `db:"id" json:"id"`
	TenantID             string               `db:"tenant_id" json:"tenant_id"`
	Category             OptimizationCategory `db:"category" json:"category"`
	Description          string               `db:"description" json:"description"`
	EstimatedSavingsCents int64              `db:"estimated_savings_cents" json:"estimated_savings_cents"`
	Effort               int                  `db:"effort" json:"effort"`
	Priority             OptimizationPriority `db:"priority" json:"priority"`
	Status               OptimizationStatus   `db:"status" json:"status"`
	ResourceIDs          JSONB                `db:"resource_ids" json:"resource_ids"`
	EntityType           string               `db:"entity_type" json:"entity_type"`
	EntityID             string               `db:"entity_id" json:"entity_id"`
	Notes                string               `db:"notes" json:"notes"`
	CreatedAt            time.Time            `db:"created_at" json:"created_at"`
	UpdatedAt            time.Time            `db:"updated_at" json:"updated_at"`
}

// ResourceUtilization represents resource usage metrics.
type ResourceUtilization struct {
	ID                string    `db:"id" json:"id"`
	TenantID          string    `db:"tenant_id" json:"tenant_id"`
	ResourceID        string    `db:"resource_id" json:"resource_id"`
	ResourceType      string    `db:"resource_type" json:"resource_type"`
	ResourceName      string    `db:"resource_name" json:"resource_name"`
	CPUUtilization    float64   `db:"cpu_utilization" json:"cpu_utilization"`
	MemoryUtilization float64   `db:"memory_utilization" json:"memory_utilization"`
	StorageUtilization float64  `db:"storage_utilization" json:"storage_utilization"`
	MonthlyCostCents  int64     `db:"monthly_cost_cents" json:"monthly_cost_cents"`
	Environment       string    `db:"environment" json:"environment"`
	RecordedAt        time.Time `db:"recorded_at" json:"recorded_at"`
}

// RightSizingRecommendation represents a recommendation to resize a resource.
type RightSizingRecommendation struct {
	ID                  string                 `json:"id"`
	ResourceID          string                 `json:"resource_id"`
	ResourceType        string                 `json:"resource_type"`
	CurrentSpec         map[string]interface{} `json:"current_spec"`
	RecommendedSpec     map[string]interface{} `json:"recommended_spec"`
	CurrentCostCents    int64                  `json:"current_cost_cents"`
	EstimatedCostCents  int64                  `json:"estimated_cost_cents"`
	EstimatedSavingsCents int64                `json:"estimated_savings_cents"`
	Reason              string                 `json:"reason"`
	TenantID            string                 `json:"tenant_id"`
}

// SavingsEstimate represents the total estimated savings from optimizations.
type SavingsEstimate struct {
	TotalMonthlySavingsCents int64            `json:"total_monthly_savings_cents"`
	TotalAnnualSavingsCents  int64            `json:"total_annual_savings_cents"`
	ByCategory               map[string]int64 `json:"by_category"`
	SuggestionCount          int              `json:"suggestion_count"`
}

// CreateBudgetAlertRequest is the input for creating a budget alert.
type CreateBudgetAlertRequest struct {
	Name         string     `json:"name" binding:"required"`
	BudgetCents  int64      `json:"budget_cents" binding:"required"`
	ThresholdPct int        `json:"threshold_pct" binding:"required"`
	NotifyEmail  string     `json:"notify_email" binding:"required,email"`
	Period       CostPeriod `json:"period"`
}

// RecordCostRequest is the input for recording a cost.
type RecordCostRequest struct {
	Source       CostSource   `json:"source" binding:"required"`
	ResourceType string       `json:"resource_type"`
	ResourceID   string       `json:"resource_id"`
	Provider     string       `json:"provider"`
	Region       string       `json:"region"`
	Service      string       `json:"service"`
	CostCents    int64        `json:"cost_cents" binding:"required"`
	Currency     string       `json:"currency"`
	PeriodStart  time.Time    `json:"period_start" binding:"required"`
	PeriodEnd    time.Time    `json:"period_end" binding:"required"`
	Tags         map[string]interface{} `json:"tags"`
}

// CreateBudgetRequest is the input for creating a budget.
type CreateBudgetRequest struct {
	EntityType  CostEntityType `json:"entity_type" binding:"required"`
	EntityID    string         `json:"entity_id" binding:"required"`
	Name        string         `json:"name" binding:"required"`
	AmountCents int64          `json:"amount_cents" binding:"required"`
	Currency    string         `json:"currency"`
	Period      CostPeriod     `json:"period"`
	Environment string         `json:"environment"`
	Description string         `json:"description"`
	Alerts      []AlertThresholdInput `json:"alerts"`
}

// AlertThresholdInput represents a threshold percentage for budget alerts.
type AlertThresholdInput struct {
	Percentage int `json:"percentage" binding:"required,min=1,max=100"`
}

// UpdateBudgetRequest is the input for updating a budget.
type UpdateBudgetRequest struct {
	AmountCents *int64                `json:"amount_cents"`
	Period      *CostPeriod           `json:"period"`
	Environment *string               `json:"environment"`
	Description *string               `json:"description"`
	Alerts      []AlertThresholdInput `json:"alerts"`
}

// RecordSpendRequest is the input for recording a spend against a budget.
type RecordSpendRequest struct {
	AmountCents int64 `json:"amount_cents" binding:"required"`
}

// AnalyzeOptimizationRequest is the input for analyzing resource utilizations.
type AnalyzeOptimizationRequest struct {
	Utilizations []ResourceUtilizationInput `json:"utilizations" binding:"required,min=1"`
}

// ResourceUtilizationInput represents input resource utilization data.
type ResourceUtilizationInput struct {
	ResourceID        string  `json:"resource_id" binding:"required"`
	ResourceType      string  `json:"resource_type" binding:"required"`
	ResourceName      string  `json:"resource_name"`
	CPUUtilization    float64 `json:"cpu_utilization"`
	MemoryUtilization float64 `json:"memory_utilization"`
	StorageUtilization float64 `json:"storage_utilization"`
	MonthlyCostCents  int64   `json:"monthly_cost_cents"`
	Environment       string  `json:"environment"`
}

// RecordUtilizationRequest is the input for recording resource utilization.
type RecordUtilizationRequest struct {
	ResourceID        string  `json:"resource_id" binding:"required"`
	ResourceType      string  `json:"resource_type" binding:"required"`
	ResourceName      string  `json:"resource_name"`
	CPUUtilization    float64 `json:"cpu_utilization"`
	MemoryUtilization float64 `json:"memory_utilization"`
	StorageUtilization float64 `json:"storage_utilization"`
	MonthlyCostCents  int64   `json:"monthly_cost_cents"`
	Environment       string  `json:"environment"`
}

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
