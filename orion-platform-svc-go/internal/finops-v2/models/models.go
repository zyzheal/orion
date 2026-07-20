package models

import "time"

// --- Cost tracking ---

type TrackCostRequest struct {
	EntityID    string  `json:"entity_id" binding:"required"`
	Cost        float64 `json:"cost" binding:"required"`
	Currency    string  `json:"currency"`
	Category    string  `json:"category"`
	PeriodStart string  `json:"period_start" binding:"required"`
	PeriodEnd   string  `json:"period_end" binding:"required"`
	Provider    string  `json:"provider"`
	Details     string  `json:"details"`
}

type CostEntry struct {
	ID          int       `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	EntityID    string    `json:"entity_id" db:"entity_id"`
	EntityType  string    `json:"entity_type" db:"entity_type"`
	Cost        float64   `json:"cost" db:"cost"`
	Currency    string    `json:"currency" db:"currency"`
	Category    string    `json:"category" db:"category"`
	Provider    string    `json:"provider" db:"provider"`
	PeriodStart string    `json:"period_start" db:"period_start"`
	PeriodEnd   string    `json:"period_end" db:"period_end"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

type CostTrendPoint struct {
	Period string  `json:"period"`
	Cost   float64 `json:"cost"`
}

type CostTrend struct {
	EntityType        string           `json:"entity_type"`
	EntityID          string           `json:"entity_id"`
	Period            string           `json:"period"`
	TotalCost         float64          `json:"total_cost"`
	Points            []CostTrendPoint `json:"points"`
	AverageCost       float64          `json:"average_cost"`
	MaxCost           float64          `json:"max_cost"`
	MinCost           float64          `json:"min_cost"`
	OverallChangeRate float64          `json:"overall_change_rate"`
}

// --- Cost overview & breakdown ---

type CostSummary struct {
	TotalCost      float64             `json:"total_cost"`
	Period         string              `json:"period"`
	TenantID       string              `json:"tenant_id"`
	CostByCategory []CostBreakdownItem `json:"cost_by_category"`
	CostByProvider []CostBreakdownItem `json:"cost_by_provider"`
	ChangeRate     float64             `json:"change_rate"`
	ForecastCost   float64             `json:"forecast_cost"`
}

type CostBreakdownItem struct {
	Key  string  `json:"key" db:"key"`
	Cost float64 `json:"cost" db:"cost"`
}

type CostBreakdownResponse struct {
	Dimension string              `json:"dimension"`
	Items     []CostBreakdownItem `json:"items"`
}

// --- Chargeback ---

type ChargebackEntry struct {
	ID            int       `json:"id" db:"id"`
	TenantID      string    `json:"tenant_id" db:"tenant_id"`
	EntityID      string    `json:"entity_id" db:"entity_id"`
	EntityType    string    `json:"entity_type" db:"entity_type"`
	AllocatedCost float64   `json:"allocated_cost" db:"allocated_cost"`
	Percentage    float64   `json:"percentage" db:"percentage"`
	Period        string    `json:"period" db:"period"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

// --- Budget management ---

type CreateBudgetRequest struct {
	Name           string  `json:"name" binding:"required"`
	EntityID       string  `json:"entity_id" binding:"required"`
	EntityType     string  `json:"entity_type" binding:"required"`
	Amount         float64 `json:"amount" binding:"required"`
	Period         string  `json:"period"`
	Currency       string  `json:"currency"`
	Category       string  `json:"category"`
	AlertThreshold float64 `json:"alert_threshold"`
}

type UpdateBudgetRequest struct {
	Name           *string  `json:"name"`
	Amount         *float64 `json:"amount"`
	Period         *string  `json:"period"`
	AlertThreshold *float64 `json:"alert_threshold"`
}

type Budget struct {
	ID             int       `json:"id" db:"id"`
	TenantID       string    `json:"tenant_id" db:"tenant_id"`
	Name           string    `json:"name" db:"name"`
	EntityID       string    `json:"entity_id" db:"entity_id"`
	EntityType     string    `json:"entity_type" db:"entity_type"`
	Amount         float64   `json:"amount" db:"amount"`
	Period         string    `json:"period" db:"period"`
	Currency       string    `json:"currency" db:"currency"`
	Category       string    `json:"category" db:"category"`
	AlertThreshold float64   `json:"alert_threshold" db:"alert_threshold"`
	Status         string    `json:"status" db:"status"` // active, exceeded, archived
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
}

type BudgetStatusResponse struct {
	BudgetID       int     `json:"budget_id"`
	UsedCost       float64 `json:"used_cost"`
	AllocatedCost  float64 `json:"allocated_cost"`
	UtilizationPct float64 `json:"utilization_pct"`
	RemainingCost  float64 `json:"remaining_cost"`
	Status         string  `json:"status"`
}

type BudgetForecastResponse struct {
	BudgetID           int     `json:"budget_id"`
	ProjectedTotalCost float64 `json:"projected_total_cost"`
	RemainingDays      int     `json:"remaining_days"`
	OverrunLikelihood  float64 `json:"overrun_likelihood"` // 0-100
	Recommendation     string  `json:"recommendation"`
}

type CheckBudgetAlertsRequest struct {
	EntityID   string `json:"entity_id"`
	EntityType string `json:"entity_type"`
}

type BudgetAlert struct {
	BudgetID  int     `json:"budget_id" db:"budget_id"`
	Name      string  `json:"name" db:"name"`
	UsedCost  float64 `json:"used_cost"`
	Threshold float64 `json:"threshold"`
	Severity  string  `json:"severity"` // warning, critical
}

type AlertTrigger struct {
	BudgetID    int       `json:"budget_id" db:"budget_id"`
	Name        string    `json:"name" db:"name"`
	Threshold   float64   `json:"threshold" db:"threshold"`
	TriggeredAt time.Time `json:"triggered_at" db:"triggered_at"`
}

// --- Cost forecast ---

type CostForecast struct {
	EntityID           string           `json:"entity_id"`
	EntityType         string           `json:"entity_type"`
	Period             string           `json:"period"`
	NextPeriodForecast float64          `json:"next_period_forecast"`
	Points             []CostTrendPoint `json:"points"`
	AverageCost        float64          `json:"average_cost"`
	MaxCost            float64          `json:"max_cost"`
	MinCost            float64          `json:"min_cost"`
	OverallChangeRate  float64          `json:"overall_change_rate"`
}

// --- Optimization recommendations ---

type Recommendation struct {
	ID               int       `json:"id" db:"id"`
	TenantID         string    `json:"tenant_id" db:"tenant_id"`
	Type             string    `json:"type" db:"type"` // right-sizing, unused, savings
	Title            string    `json:"title" db:"title"`
	Description      string    `json:"description" db:"description"`
	EstimatedSavings float64   `json:"estimated_savings" db:"estimated_savings"`
	Confidence       float64   `json:"confidence" db:"confidence"` // 0-100
	EntityID         string    `json:"entity_id" db:"entity_id"`
	EntityType       string    `json:"entity_type" db:"entity_type"`
	Status           string    `json:"status" db:"status"` // open, in_progress, implemented, dismissed
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time `json:"updated_at" db:"updated_at"`
}

type UpdateRecommendationRequest struct {
	Status string `json:"status" binding:"required"`
	Notes  string `json:"notes"`
}

type RightSizingRecommendation struct {
	ResourceName     string  `json:"resource_name"`
	ResourceType     string  `json:"resource_type"`
	CurrentSpec      string  `json:"current_spec"`
	RecommendedSpec  string  `json:"recommended_spec"`
	EstimatedSavings float64 `json:"estimated_savings"`
}

type UnusedResource struct {
	ResourceName     string    `json:"resource_name"`
	ResourceType     string    `json:"resource_type"`
	LastUsedAt       time.Time `json:"last_used_at"`
	MonthlyCost      float64   `json:"monthly_cost"`
	SavingsIfRemoved float64   `json:"savings_if_removed"`
}

type SavingsEstimate struct {
	TotalPotentialSavings  float64            `json:"total_potential_savings"`
	OptimizationCategories map[string]float64 `json:"optimization_categories"`
	Confidence             float64            `json:"confidence"`
	ReportedPeriod         string             `json:"reported_period"`
}

// --- Reports ---

type Report struct {
	ID          int       `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Type        string    `json:"type" db:"type"`
	Period      string    `json:"period" db:"period"`
	GeneratedAt time.Time `json:"generated_at" db:"generated_at"`
}

// --- ROI ---

type ROIEntry struct {
	ID                 int       `json:"id" db:"id"`
	TenantID           string    `json:"tenant_id" db:"tenant_id"`
	Period             string    `json:"period" db:"period"`
	TotalSpend         float64   `json:"total_spend" db:"total_spend"`
	TotalSavings       float64   `json:"total_savings" db:"total_savings"`
	ROI                float64   `json:"roi" db:"roi"`
	ImplementedActions int       `json:"implemented_actions" db:"implemented_actions"`
	CreatedAt          time.Time `json:"created_at" db:"created_at"`
}

type ROISummary struct {
	TotalSpend         float64 `json:"total_spend"`
	TotalSavings       float64 `json:"total_savings"`
	CurrentROI         float64 `json:"current_roi"`
	ImplementedActions int     `json:"implemented_actions"`
}

// --- Metrics (KPIs) ---

type FinOpsMetricsResponse struct {
	CostMetrics    CostSummary     `json:"cost_metrics"`
	ROIMetrics     ROISummary      `json:"roi_metrics"`
	SavingsMetrics SavingsEstimate `json:"savings_metrics"`
}

// --- Cost collection ---

type CollectCostRequest struct {
	Provider string `json:"provider"`
	Days     int    `json:"days"`
}

type CollectCostResponse struct {
	Collected   int     `json:"collected"`
	TotalCost   float64 `json:"total_cost"`
	Provider    string  `json:"provider"`
	PeriodStart string  `json:"period_start"`
	PeriodEnd   string  `json:"period_end"`
}

type CloudProviderEntry struct {
	Name    string `json:"name"`
	Enabled bool   `json:"enabled"`
}

type ScheduleRequest struct {
	Provider       string `json:"provider" binding:"required"`
	CronExpression string `json:"cron_expression" binding:"required"`
	Enabled        bool   `json:"enabled"`
}

type CollectionSchedule struct {
	Provider       string     `json:"provider" db:"provider"`
	CronExpression string     `json:"cron_expression" db:"cron_expression"`
	Enabled        bool       `json:"enabled" db:"enabled"`
	LastRun        *time.Time `json:"last_run,omitempty" db:"last_run"`
}
