package models

import "time"

// BudgetGuard represents a budget guard rule.
type BudgetGuard struct {
	ID           string     `db:"id" json:"id"`
	TenantID     string     `db:"tenant_id" json:"tenantId"`
	Name         string     `db:"name" json:"name"`
	Description  *string    `db:"description" json:"description"`
	BudgetAmount *float64   `db:"budget_amount" json:"budgetAmount"`
	ThresholdPct *float64   `db:"threshold_pct" json:"thresholdPct"`
	Currency     string     `db:"currency" json:"currency"`
	Action       string     `db:"action" json:"action"`
	Scope        *string    `db:"scope" json:"scope"`
	Enabled      bool       `db:"enabled" json:"enabled"`
	CreatedAt    time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt    time.Time  `db:"updated_at" json:"updatedAt"`
}

// CreateBudgetGuardRequest is the request body for creating a budget guard.
type CreateBudgetGuardRequest struct {
	Name         string   `json:"name" binding:"required"`
	Description  *string  `json:"description"`
	BudgetAmount *float64 `json:"budgetAmount"`
	ThresholdPct *float64 `json:"thresholdPct"`
	Currency     *string  `json:"currency"`
	Action       string   `json:"action" binding:"required"`
	Scope        *string  `json:"scope"`
}

// EvaluationResult is the result of evaluating a cost against budget guards.
type EvaluationResult struct {
	Passed        bool      `json:"passed"`
	GuardID       *string   `json:"guardId"`
	BudgetAmount  *float64  `json:"budgetAmount"`
	EstimatedCost float64   `json:"estimatedCost"`
	ThresholdPct  *float64  `json:"thresholdPct"`
	Message       string    `json:"message"`
	TenantID      string    `json:"tenantId"`
	ProjectID     *string   `json:"projectId"`
	Environment   *string   `json:"environment"`
}

// Anomaly represents a detected cost anomaly.
type Anomaly struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenantId"`
	Type        string     `db:"type" json:"type"`
	Severity    string     `db:"severity" json:"severity"`
	DetectedAt  time.Time  `db:"detected_at" json:"detectedAt"`
	ResolvedAt  *time.Time `db:"resolved_at" json:"resolvedAt"`
	Details     string     `db:"details" json:"details"`
	CreatedAt   time.Time  `db:"created_at" json:"createdAt"`
}

// AnomalyDetectionResult is the result of anomaly detection.
type AnomalyDetectionResult struct {
	Anomalies []Anomaly `json:"anomalies"`
	Count     int       `json:"count"`
	TimeWindow  TimeWindow `json:"timeWindow"`
}

// TimeWindow represents a start-end time window.
type TimeWindow struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

// CostTrendResult is the result of a cost trend query.
type CostTrendResult struct {
	Points  []TrendPoint `json:"points"`
	Days    int          `json:"days"`
	TenantID string     `json:"tenantId"`
}

// TrendPoint is a single point in a trend series.
type TrendPoint struct {
	Period  string  `json:"period"`
	Cost    float64 `json:"cost"`
	Labels  *string `json:"labels"`
}

// OptimizationSuggestion represents a cost optimization suggestion.
type OptimizationSuggestion struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenantId"`
	Service     string    `db:"service" json:"service"`
	Category    string    `db:"category" json:"category"`
	Description string    `db:"description" json:"description"`
	PotentialSavings float64 `db:"potential_savings" json:"potentialSavings"`
	Status      string    `db:"status" json:"status"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
}

// CostOverview is the cost overview response.
type CostOverview struct {
	TotalCost            float64 `json:"totalCost"`
	CurrentMonthCost     float64 `json:"currentMonthCost"`
	PreviousMonthCost    float64 `json:"previousMonthCost"`
	MonthOverMonthChange float64 `json:"monthOverMonthChange"`
	ProjectedMonthlyCost float64 `json:"projectedMonthlyCost"`
	BudgetRemaining      float64 `json:"budgetRemaining"`
	BudgetTotal          float64 `json:"budgetTotal"`
	BudgetUsagePercent   float64 `json:"budgetUsagePercent"`
}

// CostComparisonRequest is the request body for comparing two service costs.
type CostComparisonRequest struct {
	ServiceA string `json:"serviceA" binding:"required"`
	ServiceB string `json:"serviceB" binding:"required"`
	Period   string `json:"period" binding:"required"`
}

// CostComparisonResult is the result of comparing two services.
type CostComparisonResult struct {
	ServiceA      string    `json:"serviceA"`
	ServiceB      string    `json:"serviceB"`
	CostA         float64   `json:"costA"`
	CostB         float64   `json:"costB"`
	Difference    float64   `json:"difference"`
	Percentage    float64   `json:"percentage"`
	Cheaper       string    `json:"cheaper"`
	Period        string    `json:"period"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}

// CostItem represents a cost tracking entry.
type CostItem struct {
	ID       string    `db:"id" json:"id"`
	TenantID string    `db:"tenant_id" json:"tenantId"`
	Service  string    `db:"service" json:"service"`
	Cost     float64   `db:"cost" json:"cost"`
	Currency string    `db:"currency" json:"currency"`
	Period   *string   `db:"period" json:"period"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
}

// DetectAnomaliesRequest is the request body for anomaly detection.
type DetectAnomaliesRequest struct {
	Days *int    `json:"days"`
	Start *string `json:"start"`
	End   *string `json:"end"`
}
