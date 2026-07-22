package models

// ---------------------------------------------------------------------------
// Enums (string constants)
// ---------------------------------------------------------------------------

// BudgetType represents the budgeting period.
type BudgetType string

const (
	BudgetTypeMonthly  BudgetType = "monthly"
	BudgetTypeQuarterly BudgetType = "quarterly"
	BudgetTypeYearly   BudgetType = "yearly"
	BudgetTypePerRun   BudgetType = "per_run"
)

// BudgetResourceType represents the type of resource being budgeted.
type BudgetResourceType string

const (
	ResourceTypeCPU     BudgetResourceType = "cpu"
	ResourceTypeMemory  BudgetResourceType = "memory"
	ResourceTypeStorage BudgetResourceType = "storage"
	ResourceTypeNetwork BudgetResourceType = "network"
	ResourceTypeGPU     BudgetResourceType = "gpu"
	ResourceTypeCustom  BudgetResourceType = "custom"
)

// AlertSeverity represents the severity level of a budget alert.
type AlertSeverity string

const (
	AlertSeverityInfo     AlertSeverity = "info"
	AlertSeverityWarning  AlertSeverity = "warning"
	AlertSeverityCritical AlertSeverity = "critical"
)

// HistoryAction represents the type of event recorded in budget history.
type HistoryAction string

const (
	HistoryActionConfigUpdated  HistoryAction = "config_updated"
	HistoryActionAlertTriggered HistoryAction = "alert_triggered"
	HistoryActionLimitExceeded  HistoryAction = "limit_exceeded"
	HistoryActionPeriodReset    HistoryAction = "period_reset"
)

// ---------------------------------------------------------------------------
// Domain models
// ---------------------------------------------------------------------------

// BudgetLimit represents a per-resource budget limit within a BudgetConfig.
type BudgetLimit struct {
	ResourceType BudgetResourceType `db:"resource_type" json:"resourceType"`
	Limit        float64            `db:"limit" json:"limit"`
	Unit         string             `db:"unit" json:"unit"`
	Used         float64            `db:"used" json:"used"`
}

// BudgetCostLimit represents the cost ceiling for a budget.
type BudgetCostLimit struct {
	Total    float64 `db:"total" json:"total"`
	Currency string  `db:"currency" json:"currency"`
}

// BudgetPeriod represents a start/end window for a budget cycle.
type BudgetPeriod struct {
	Start string `db:"start" json:"start"`
	End   string `db:"end" json:"end"`
}

// BudgetAlert represents a notification rule for a budget.
type BudgetAlert struct {
	ID             string          `db:"id" json:"id"`
	Name           string          `db:"name" json:"name"`
	Threshold      float64         `db:"threshold" json:"threshold"` // percentage
	Severity       AlertSeverity   `db:"severity" json:"severity"`
	Channels       string          `db:"channels" json:"channels"`   // JSONB array
	Enabled        bool            `db:"enabled" json:"enabled"`
	LastTriggered  *int64          `db:"last_triggered" json:"lastTriggered"` // unix seconds
	CreatedAt      *int64          `db:"created_at" json:"createdAt"`
	UpdatedAt      *int64          `db:"updated_at" json:"updatedAt"`
}

// BudgetConfig is the core budget entity for a pipeline.
//
// Storage notes:
//   - limits     → JSONB column storing []BudgetLimit
//   - alerts     → JSONB column storing []BudgetAlert
//   - costLimits → JSONB column (nullable)
//   - period     → JSONB column storing BudgetPeriod
//
// This keeps a single row per pipeline and avoids a many-tables-per-pipeline
// explosion.  At scale (100k+ pipelines) these JSONB columns can be
// materialised into relational tables.
type BudgetConfig struct {
	ID          string          `db:"id" json:"id"`
	PipelineID  string          `db:"pipeline_id" json:"pipelineId"`
	TenantID    string          `db:"tenant_id" json:"tenantId"`
	Type        BudgetType      `db:"type" json:"type"`
	Period      string          `db:"period" json:"period"`       // JSONB
	Limits      string          `db:"limits" json:"limits"`       // JSONB
	CostLimits  *string         `db:"cost_limits" json:"costLimits"` // JSONB, nullable
	Alerts      string          `db:"alerts" json:"alerts"`       // JSONB
	CreatedAt   *int64          `db:"created_at" json:"createdAt"`
	UpdatedAt   *int64          `db:"updated_at" json:"updatedAt"`
}

// BudgetHistoryRecord records an auditable event on a budget.
type BudgetHistoryRecord struct {
	ID         string      `db:"id" json:"id"`
	PipelineID string      `db:"pipeline_id" json:"pipelineId"`
	TenantID   string      `db:"tenant_id" json:"tenantId"`
	Timestamp  *int64      `db:"timestamp" json:"timestamp"`
	Action     HistoryAction `db:"action" json:"action"`
	Details    string      `db:"details" json:"details"` // JSONB
	Actor      string      `db:"actor" json:"actor"`
}

// ---------------------------------------------------------------------------
// Request / Response models
// ---------------------------------------------------------------------------

// CreateLimitRequest is the limit input for upsert.
type CreateLimitRequest struct {
	ResourceType BudgetResourceType `json:"resourceType" binding:"required"`
	Limit        float64            `json:"limit" binding:"required"`
	Unit         string             `json:"unit" binding:"required"`
}

// UpsertBudgetRequest is the body for creating / updating a budget config.
type UpsertBudgetRequest struct {
	Type        BudgetType            `json:"type" binding:"required"`
	Limits      []CreateLimitRequest  `json:"limits" binding:"required"`
	CostLimits  *BudgetCostLimit      `json:"costLimits"`
}

// CreateAlertRequest is the body for creating a budget alert rule.
type CreateAlertRequest struct {
	Name      string          `json:"name" binding:"required"`
	Threshold float64         `json:"threshold" binding:"required"`
	Severity  AlertSeverity   `json:"severity" binding:"required"`
	Channels  []string        `json:"channels"`
	Enabled   *bool           `json:"enabled"`
}

// UpdateAlertRequest is the body for partially updating a budget alert.
type UpdateAlertRequest struct {
	Name      *string         `json:"name"`
	Threshold *float64        `json:"threshold"`
	Severity  *AlertSeverity  `json:"severity"`
	Channels  *[]string       `json:"channels"`
	Enabled   *bool           `json:"enabled"`
}

// ---------------------------------------------------------------------------
// DTOs returned by the service (not stored directly)
// ---------------------------------------------------------------------------

// BudgetUsageResource is a single resource's usage snapshot.
type BudgetUsageResource struct {
	Type       BudgetResourceType `json:"type"`
	Used       float64            `json:"used"`
	Limit      float64            `json:"limit"`
	Unit       string             `json:"unit"`
	Percentage int                `json:"percentage"`
}

// BudgetUsageCost is the cost snapshot inside a usage response.
type BudgetUsageCost struct {
	Used       float64 `json:"used"`
	Limit      float64 `json:"limit"`
	Currency   string  `json:"currency"`
	Percentage int     `json:"percentage"`
}

// BudgetForecast projects period-end usage/cost.
type BudgetForecast struct {
	ProjectedUsage float64 `json:"projectedUsage"`
	ProjectedCost  float64 `json:"projectedCost"`
	DaysRemaining  int     `json:"daysRemaining"`
}

// BudgetUsage is the full usage response for a pipeline's budget.
type BudgetUsage struct {
	PipelineID string                `json:"pipelineId"`
	Period     BudgetPeriod          `json:"period"`
	Resources  []BudgetUsageResource `json:"resources"`
	Cost       BudgetUsageCost       `json:"cost"`
	Forecast   *BudgetForecast       `json:"forecast"`
}

// ListQuery is the standard list/pagination query parameters.
type ListQuery struct {
	Offset *int `form:"offset" db:"-"`
	Limit  *int `form:"limit" db:"-"`
}

// DefaultListQuery returns a ListQuery with conventional defaults.
func DefaultListQuery() ListQuery {
	o := 0
	l := 20
	return ListQuery{Offset: &o, Limit: &l}
}

// GetOffset returns the effective offset value.
func (q ListQuery) GetOffset() int {
	if q.Offset == nil || *q.Offset < 0 {
		return 0
	}
	return *q.Offset
}

// GetLimit returns the effective limit value.
func (q ListQuery) GetLimit() int {
	if q.Limit == nil || *q.Limit <= 0 {
		return 20
	}
	if *q.Limit > 100 {
		return 100
	}
	return *q.Limit
}

// ---------------------------------------------------------------------------
// Notes on JSONB storage
// ---------------------------------------------------------------------------
//
// BudgetConfig has four JSONB columns:
//   - period     → stores BudgetPeriod JSON
//   - limits     → stores []BudgetLimit JSON array
//   - cost_limits → stores BudgetCostLimit JSON (nullable)
//   - alerts     → stores []BudgetAlert JSON array
//
// The repository layer uses []byte for writing and string for reading.
// Business logic serialises/deserialises via the service layer using
// the stdlib json package.
