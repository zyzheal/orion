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
	CostPeriodDaily   CostPeriod = "daily"
	CostPeriodWeekly  CostPeriod = "weekly"
	CostPeriodMonthly CostPeriod = "monthly"
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

// CostTrend represents cost changes over time.
type CostTrend struct {
	Period CostPeriod     `json:"period"`
	Points []CostTrendPoint `json:"points"`
}

// CostTrendPoint is a single data point in a cost trend.
type CostTrendPoint struct {
	Date       string `json:"date"`
	CostCents  int64  `json:"cost_cents"`
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
