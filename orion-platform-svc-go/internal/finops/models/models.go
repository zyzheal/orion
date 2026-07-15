package models

import "time"

// ============================================================================
// Budget Guards (existing)
// ============================================================================

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

// ============================================================================
// Anomaly Detection (existing + enriched)
// ============================================================================

// Anomaly represents a detected cost anomaly.
type Anomaly struct {
	ID                string     `db:"id" json:"id"`
	TenantID          string     `db:"tenant_id" json:"tenantId"`
	Type              string     `db:"type" json:"type"`
	Severity          string     `db:"severity" json:"severity"`
	Value             float64    `db:"value" json:"value"`
	ExpectedValue     float64    `db:"expected_value" json:"expectedValue"`
	Deviation         float64    `db:"deviation" json:"deviation"`
	Description       string     `db:"description" json:"description"`
	Metadata          string     `db:"metadata" json:"metadata"`
	TimeWindowStart   time.Time  `db:"time_window_start" json:"timeWindowStart"`
	TimeWindowEnd     time.Time  `db:"time_window_end" json:"timeWindowEnd"`
	DetectedAt        time.Time  `db:"detected_at" json:"detectedAt"`
	ResolvedAt        *time.Time `db:"resolved_at" json:"resolvedAt"`
	CreatedAt         time.Time  `db:"created_at" json:"createdAt"`
}

// AnomalyDetectionResult is the result of anomaly detection (statistical).
type AnomalyDetectionResult struct {
	Anomalies          []Anomaly  `json:"anomalies"`
	Count              int        `json:"count"`
	TimeWindow         TimeWindow `json:"timeWindow"`
	DataPointsAnalyzed int        `json:"dataPointsAnalyzed"`
	DetectedAt         time.Time  `json:"detectedAt"`
}

// TimeWindow represents a start-end time window.
type TimeWindow struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

// ============================================================================
// Cost Trend (existing + enriched)
// ============================================================================

// CostTrendResult is the result of a cost trend query.
type CostTrendResult struct {
	Points             []TrendPoint `json:"points"`
	Days               int          `json:"days"`
	TenantID           string       `json:"tenantId"`
	TotalCost          float64      `json:"totalCost"`
	AverageCost        float64      `json:"averageCost"`
	Trend              string       `json:"trend"` // "increasing" | "decreasing" | "stable"
	ChangeRate         float64      `json:"changeRate"`
	OverallChangeRate  float64      `json:"overallChangeRate"`
	MaxCost            float64      `json:"maxCost"`
	MinCost            float64      `json:"minCost"`
}

// TrendPoint is a single point in a trend series.
type TrendPoint struct {
	Period     string  `json:"period"`
	Cost       float64 `json:"cost"`
	Labels     *string `json:"labels"`
	Date       string  `json:"date,omitempty"`
	ChangeRate float64 `json:"changeRate,omitempty"`
}

// ============================================================================
// Optimization Suggestions (existing + enriched)
// ============================================================================

// OptimizationSuggestion represents a cost optimization suggestion.
type OptimizationSuggestion struct {
	ID                 string     `db:"id" json:"id"`
	TenantID           string     `db:"tenant_id" json:"tenantId"`
	Service            string     `db:"service" json:"service"`
	Category           string     `db:"category" json:"category"`
	Description        string     `db:"description" json:"description"`
	PotentialSavings   float64    `db:"potential_savings" json:"potentialSavings"`
	Status             string     `db:"status" json:"status"`
	Priority           string     `db:"priority" json:"priority"`
	EntityID           *string    `db:"entity_id" json:"entityId"`
	EntityType         *string    `db:"entity_type" json:"entityType"`
	ResourceIDs        *string    `db:"resource_ids" json:"resourceIds"`
	Notes              *string    `db:"notes" json:"notes"`
	Effort             float64    `db:"effort" json:"effort"`
	CreatedAt          time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt          *time.Time `db:"updated_at" json:"updatedAt"`
}

// OptimizationSavingsSummary is the aggregated savings estimate.
type OptimizationSavingsSummary struct {
	TotalMonthlySavings float64            `json:"totalMonthlySavings"`
	TotalAnnualSavings  float64            `json:"totalAnnualSavings"`
	ByCategory          map[string]float64 `json:"byCategory"`
	SuggestionCount     int                `json:"suggestionCount"`
}

// ============================================================================
// Cost Overview (existing + enriched)
// ============================================================================

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
	ServiceA   string  `json:"serviceA"`
	ServiceB   string  `json:"serviceB"`
	CostA      float64 `json:"costA"`
	CostB      float64 `json:"costB"`
	Difference float64 `json:"difference"`
	Percentage float64 `json:"percentage"`
	Cheaper    string  `json:"cheaper"`
	Period     string  `json:"period"`
}

// ============================================================================
// CostItem (existing, enriched)
// ============================================================================

// CostItem represents a cost tracking entry.
type CostItem struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenantId"`
	Service   string    `db:"service" json:"service"`
	Cost      float64   `db:"cost" json:"cost"`
	Currency  string    `db:"currency" json:"currency"`
	Period    *string   `db:"period" json:"period"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
}

// DetectAnomaliesRequest is the request body for anomaly detection.
type DetectAnomaliesRequest struct {
	Days  *int    `json:"days"`
	Start *string `json:"start"`
	End   *string `json:"end"`
}

// ============================================================================
// Usage Metering (from billing/BillingService.ts)
// ============================================================================

// UsageRecord represents a usage metering entry.
type UsageRecord struct {
	ID          string            `db:"id" json:"id"`
	TenantID    string            `db:"tenant_id" json:"tenantId"`
	Service     string            `db:"service" json:"service"`
	Metric      string            `db:"metric" json:"metric"`
	Quantity    float64           `db:"quantity" json:"quantity"`
	UnitPrice   float64           `db:"unit_price" json:"unitPrice"`
	TotalCost   float64           `db:"total_cost" json:"totalCost"`
	PeriodStart string            `db:"period_start" json:"periodStart"`
	PeriodEnd   string            `db:"period_end" json:"periodEnd"`
	Metadata    string            `db:"metadata" json:"metadata,omitempty"`
	CreatedAt   time.Time         `db:"created_at" json:"createdAt"`
}

// RecordUsageRequest is the request body for recording usage.
type RecordUsageRequest struct {
	Service    string            `json:"service" binding:"required"`
	Metric     string            `json:"metric" binding:"required"`
	Quantity   float64           `json:"quantity" binding:"required"`
	UnitPrice  float64           `json:"unitPrice" binding:"required"`
	PeriodStart string           `json:"periodStart" binding:"required"`
	PeriodEnd  string            `json:"periodEnd" binding:"required"`
	Metadata   map[string]string `json:"metadata"`
}

// UsageSummary is the usage summary response.
type UsageSummary struct {
	TotalCost float64            `json:"totalCost"`
	ByService map[string]float64 `json:"byService"`
	Period    string             `json:"period"`
}

// ============================================================================
// Billing Records (from billing/BillingService.ts)
// ============================================================================

// BillingRecord represents a billing record.
type BillingRecord struct {
	ID            string     `db:"id" json:"id"`
	TenantID      string     `db:"tenant_id" json:"tenantId"`
	BillingPeriod string     `db:"billing_period" json:"billingPeriod"`
	Status        string     `db:"status" json:"status"`
	TotalAmount   float64    `db:"total_amount" json:"totalAmount"`
	PaidAmount    float64    `db:"paid_amount" json:"paidAmount"`
	DueDate       *string    `db:"due_date" json:"dueDate"`
	PaidAt        *time.Time `db:"paid_at" json:"paidAt"`
	Items         string     `db:"items" json:"items"`
	CreatedAt     time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt     time.Time  `db:"updated_at" json:"updatedAt"`
}

// GenerateBillingRecordRequest is the request body for generating a billing record.
type GenerateBillingRecordRequest struct {
	Period string `json:"period"` // e.g., "2026-05"
}

// BillingSummary is the billing summary response.
type BillingSummary struct {
	TotalBilling    float64 `json:"totalBilling"`
	PaidAmount      float64 `json:"paidAmount"`
	PendingAmount   float64 `json:"pendingAmount"`
	OverdueAmount   float64 `json:"overdueAmount"`
	CurrentMonthCost float64 `json:"currentMonthCost"`
}

// ============================================================================
// Cost Tracking (from CostTrackingService.ts)
// ============================================================================

// CostEntityType represents the type of entity being tracked.
// Valid values: "project", "tenant", "team"
type CostEntityType string

const (
	CostEntityTypeProject CostEntityType = "project"
	CostEntityTypeTenant  CostEntityType = "tenant"
	CostEntityTypeTeam    CostEntityType = "team"
)

// CostRecord represents an entity cost tracking record.
type CostRecord struct {
	ID         string            `db:"id" json:"id"`
	TenantID   string            `db:"tenant_id" json:"tenantId"`
	EntityType CostEntityType    `db:"entity_type" json:"entityType"`
	EntityID   string            `db:"entity_id" json:"entityId"`
	Amount     float64           `db:"amount" json:"amount"`
	Category   string            `db:"category" json:"category"`
	Currency   string            `db:"currency" json:"currency"`
	Environment *string          `db:"environment" json:"environment"`
	Metadata   string            `db:"metadata" json:"metadata"`
	CreatedAt  time.Time         `db:"created_at" json:"createdAt"`
}

// TrackCostRequest is the generic request body for tracking costs.
type TrackCostRequest struct {
	EntityID    string            `json:"entityId" binding:"required"`
	Amount      float64           `json:"amount" binding:"required"`
	Category    string            `json:"category" binding:"required"`
	Environment *string           `json:"environment"`
	Tags        map[string]string `json:"tags"`
	Currency    string            `json:"currency"`
}

// EntityCostSummary is the cost summary for a specific entity.
type EntityCostSummary struct {
	EntityType  CostEntityType     `json:"entityType"`
	EntityID    string             `json:"entityId"`
	TotalCost   float64            `json:"totalCost"`
	Breakdown   map[string]float64 `json:"breakdown"`
	Period      string             `json:"period"`
	Currency    string             `json:"currency"`
	RecordCount int                `json:"recordCount"`
}

// CostSummary is the aggregated cost summary.
type CostSummary struct {
	TotalCost     float64 `json:"totalCost"`
	ComputeCost   float64 `json:"computeCost"`
	StorageCost   float64 `json:"storageCost"`
	NetworkCost   float64 `json:"networkCost"`
	SaasCost      float64 `json:"saasCost"`
	Period        string  `json:"period"`
	Currency      string  `json:"currency"`
	TenantID      string  `json:"tenantId"`
}

// CostBreakdown is a cost breakdown by dimension.
type CostBreakdown struct {
	Dimension      string  `json:"dimension"`
	DimensionValue string  `json:"dimensionValue"`
	Cost           float64 `json:"cost"`
	Percentage     float64 `json:"percentage"`
	RecordCount    int     `json:"recordCount"`
}

// ============================================================================
// Chargeback Report (from CostTrackingService.ts)
// ============================================================================

// ChargebackReport represents a cost chargeback report.
type ChargebackReport struct {
	ID          string                    `json:"id"`
	GeneratedAt time.Time                 `json:"generatedAt"`
	Period      string                    `json:"period"`
	TotalCost   float64                   `json:"totalCost"`
	Entities    []ChargebackEntity        `json:"entities"`
	Currency    string                    `json:"currency"`
}

// ChargebackEntity represents an entity in a chargeback report.
type ChargebackEntity struct {
	EntityType  CostEntityType     `json:"entityType"`
	EntityID    string             `json:"entityId"`
	Cost        float64            `json:"cost"`
	Percentage  float64            `json:"percentage"`
	Breakdown   map[string]float64 `json:"breakdown"`
}

// ============================================================================
// Budget (from FinOpsBudgetService.ts - enriched budget CRUD)
// ============================================================================

// Budget represents a cost budget for an entity.
type Budget struct {
	ID          string            `db:"id" json:"id"`
	TenantID    string            `db:"tenant_id" json:"tenantId"`
	EntityType  CostEntityType    `db:"entity_type" json:"entityType"`
	EntityID    string            `db:"entity_id" json:"entityId"`
	Amount      float64           `db:"amount" json:"amount"`
	Period      string            `db:"period" json:"period"`
	Currency    string            `db:"currency" json:"currency"`
	Alerts      string            `db:"alerts" json:"alerts"` // JSON array of thresholds
	Environment *string           `db:"environment" json:"environment"`
	Description *string           `db:"description" json:"description"`
	CreatedAt   time.Time         `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time         `db:"updated_at" json:"updatedAt"`
}

// CreateBudgetRequest is the request body for creating a budget.
type CreateBudgetRequest struct {
	EntityType  string            `json:"entityType" binding:"required"`
	EntityID    string            `json:"entityId" binding:"required"`
	Amount      float64           `json:"amount" binding:"required"`
	Period      string            `json:"period" binding:"required"`
	Currency    string            `json:"currency"`
	Alerts      []int             `json:"alerts"`
	Environment *string           `json:"environment"`
	Description *string           `json:"description"`
}

// UpdateBudgetRequest is the request body for updating a budget.
type UpdateBudgetRequest struct {
	Amount      *float64 `json:"amount"`
	Period      *string  `json:"period"`
	Alerts      *[]int   `json:"alerts"`
	Environment *string  `json:"environment"`
	Description *string  `json:"description"`
}

// BudgetStatus is the current status of a budget.
type BudgetStatus struct {
	BudgetID      string    `json:"budgetId"`
	EntityType    string    `json:"entityType"`
	EntityID      string    `json:"entityId"`
	BudgetAmount  float64   `json:"budgetAmount"`
	CurrentSpend  float64   `json:"currentSpend"`
	UsagePercent  float64   `json:"usagePercent"`
	Remaining     float64   `json:"remaining"`
	Period        string    `json:"period"`
	OverBudget    bool      `json:"overBudget"`
	TriggeredAlerts []BudgetAlertTrigger `json:"triggeredAlerts"`
	ForecastedSpend *float64 `json:"forecastedSpend"`
}

// BudgetForecast is the forecasted spend for a budget.
type BudgetForecast struct {
	BudgetID         string    `json:"budgetId"`
	CurrentSpend     float64   `json:"currentSpend"`
	ForecastedSpend  float64   `json:"forecastedSpend"`
	ProjectedOverage float64   `json:"projectedOverage"`
	DailySpendRate   float64   `json:"dailySpendRate"`
	DaysUntilExhausted int     `json:"daysUntilExhausted"`
	WithinBudget     bool      `json:"withinBudget"`
	History          []BudgetHistoryPoint `json:"history"`
}

// BudgetHistoryPoint is a point in budget history.
type BudgetHistoryPoint struct {
	Date           string  `json:"date"`
	CumulativeCost float64 `json:"cumulativeCost"`
}

// BudgetAlertTrigger represents a triggered budget alert.
type BudgetAlertTrigger struct {
	ID           string  `json:"id"`
	BudgetID     string  `json:"budgetId"`
	Threshold    int     `json:"threshold"`
	Actual       float64 `json:"actual"`
	Percentage   float64 `json:"percentage"`
	TriggeredAt  time.Time `json:"triggeredAt"`
	EntityType   string  `json:"entityType"`
	EntityID     string  `json:"entityId"`
}

// ============================================================================
// ROI Analysis (from FinOpsBudgetService.ts)
// ============================================================================

// ROIInvestmentType represents the type of investment.
type ROIInvestmentType string

const (
	ROIInvestmentInfrastructure ROIInvestmentType = "infrastructure"
	ROIInvestmentAutomation     ROIInvestmentType = "automation"
	ROIInvestmentTooling        ROIInvestmentType = "tooling"
	ROIInvestmentTraining       ROIInvestmentType = "training"
	ROIInvestmentMigration      ROIInvestmentType = "migration"
)

// ROIAnalysis represents an ROI analysis record.
type ROIAnalysis struct {
	ID             string            `db:"id" json:"id"`
	TenantID       string            `db:"tenant_id" json:"tenantId"`
	InvestmentType string            `db:"investment_type" json:"investmentType"`
	Name           string            `db:"name" json:"name"`
	Cost           float64           `db:"cost" json:"cost"`
	Savings        float64           `db:"savings" json:"savings"`
	Period         string            `db:"period" json:"period"`
	ROIPercentage  float64           `db:"roi_percentage" json:"roiPercentage"`
	PaybackMonths  float64           `db:"payback_months" json:"paybackMonths"`
	Description    *string           `db:"description" json:"description"`
	Details        string            `db:"details" json:"details"`
	AnalyzedAt     time.Time         `db:"analyzed_at" json:"analyzedAt"`
}

// CreateROIRequest is the request body for creating an ROI analysis.
type CreateROIRequest struct {
	InvestmentType string  `json:"investmentType" binding:"required"`
	Name           string  `json:"name" binding:"required"`
	Cost           float64 `json:"cost" binding:"required"`
	MonthlySavings float64 `json:"monthlySavings" binding:"required"`
	TimeSavingsHours *float64 `json:"timeSavingsHours"`
	Description *string `json:"description"`
	Details     string  `json:"details"`
}

// ROISummary is the aggregated ROI summary.
type ROISummary struct {
	TotalAnalyses        int     `json:"totalAnalyses"`
	AverageROI           float64 `json:"averageROI"`
	AveragePaybackMonths float64 `json:"averagePaybackMonths"`
	TotalComparisons     int     `json:"totalComparisons"`
	TotalSavings         float64 `json:"totalSavings"`
}

// ============================================================================
// Cost Period Comparison (from FinOpsBudgetService.ts)
// ============================================================================

// CostPeriodComparison represents a before/after cost comparison.
type CostPeriodComparison struct {
	ID              string    `db:"id" json:"id"`
	TenantID        string    `db:"tenant_id" json:"tenantId"`
	Description     string    `db:"description" json:"description"`
	BeforeCost      float64   `db:"before_cost" json:"beforeCost"`
	AfterCost       float64   `db:"after_cost" json:"afterCost"`
	Savings         float64   `db:"savings" json:"savings"`
	SavingsPercent  float64   `db:"savings_percent" json:"savingsPercent"`
	TimeSavingsHours *float64 `db:"time_savings_hours" json:"timeSavingsHours"`
	Period          string    `db:"period" json:"period"`
	CreatedAt       time.Time `db:"created_at" json:"createdAt"`
}

// CreateCostComparisonRequest is the request body for creating a period comparison.
type CreateCostComparisonRequest struct {
	Description      string    `json:"description" binding:"required"`
	BeforeCost       float64   `json:"beforeCost" binding:"required"`
	AfterCost        float64   `json:"afterCost" binding:"required"`
	TimeSavingsHours *float64  `json:"timeSavingsHours"`
	Period           string    `json:"period"`
}

// ============================================================================
// Optimization (full CRUD from FinOpsOptimizer.ts)
// ============================================================================

// OptimizationCategory represents the category of an optimization.
type OptimizationCategory string

const (
	OptCategoryRightSizing      OptimizationCategory = "right-sizing"
	OptCategoryUnusedResources  OptimizationCategory = "unused-resources"
	OptCategoryReservedInstances OptimizationCategory = "reserved-instances"
	OptCategoryStorageOpt       OptimizationCategory = "storage-optimization"
	OptCategoryNetworkOpt       OptimizationCategory = "network-optimization"
	OptCategoryScheduling       OptimizationCategory = "scheduling"
	OptCategoryArchitecture     OptimizationCategory = "architecture"
)

// OptimizationPriority represents the priority of an optimization.
type OptimizationPriority string

const (
	OptPriorityCritical OptimizationPriority = "critical"
	OptPriorityHigh     OptimizationPriority = "high"
	OptPriorityMedium   OptimizationPriority = "medium"
	OptPriorityLow      OptimizationPriority = "low"
)

// OptimizationStatus represents the status of an optimization.
type OptimizationStatus string

const (
	OptStatusIdentified OptimizationStatus = "identified"
	OptStatusReviewing  OptimizationStatus = "reviewing"
	OptStatusApproved   OptimizationStatus = "approved"
	OptStatusInProgress OptimizationStatus = "in-progress"
	OptStatusCompleted  OptimizationStatus = "completed"
	OptStatusRejected   OptimizationStatus = "rejected"
)

// CreateOptimizationRequest is the request body for creating an optimization suggestion.
type CreateOptimizationRequest struct {
	Category   OptimizationCategory `json:"category" binding:"required"`
	Description string             `json:"description" binding:"required"`
	EstimatedSavings float64       `json:"estimatedSavings"`
	Effort       float64          `json:"effort"`
	Priority     OptimizationPriority `json:"priority"`
	EntityID     *string          `json:"entityId"`
	EntityType   *string          `json:"entityType"`
	ResourceIDs  []string         `json:"resourceIds"`
	Notes        *string          `json:"notes"`
}

// UpdateOptimizationRequest is the request body for updating optimization status.
type UpdateOptimizationRequest struct {
	Status OptimizationStatus `json:"status" binding:"required"`
	Notes  *string            `json:"notes"`
}

// ============================================================================
// Cost Forecast (from CostAnomalyDetectionService.ts)
// ============================================================================

// CostForecastResult is the result of cost forecasting.
type CostForecastResult struct {
	PredictedEndOfMonthCost float64                    `json:"predictedEndOfMonthCost"`
	CurrentSpend            float64                    `json:"currentSpend"`
	ProjectedOverage        float64                    `json:"projectedOverage"`
	Confidence              float64                    `json:"confidence"`
	DailyForecast           []ForecastDay              `json:"dailyForecast"`
	GeneratedAt             time.Time                  `json:"generatedAt"`
}

// ForecastDay is a single day in the forecast.
type ForecastDay struct {
	Date      string  `json:"date"`
	Predicted float64 `json:"predicted"`
}

// ============================================================================
// Health Check
// ============================================================================

// HealthCheckResponse is the health check response.
type HealthCheckResponse struct {
	Status  string `json:"status"`
	Storage string `json:"storage"`
}

// ============================================================================
// Generic helpers
// ============================================================================

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}
