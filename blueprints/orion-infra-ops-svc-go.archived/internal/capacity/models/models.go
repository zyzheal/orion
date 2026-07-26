package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

type JSONB map[string]interface{}
func (j JSONB) Value() (driver.Value, error) { if j == nil { return nil, nil }; return json.Marshal(j) }
func (j *JSONB) Scan(src interface{}) error { if src == nil { *j = nil; return nil }; switch v := src.(type) { case []byte: return json.Unmarshal(v, j); case string: return json.Unmarshal([]byte(v), j); default: return fmt.Errorf("cannot scan %T into JSONB", src) } }

type ResourcePool struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	ResourceType string   `db:"resource_type" json:"resource_type"`
	TotalCPU    float64   `db:"total_cpu" json:"total_cpu"`
	TotalMemory float64   `db:"total_memory" json:"total_memory"`
	UsedCPU     float64   `db:"used_cpu" json:"used_cpu"`
	UsedMemory  float64   `db:"used_memory" json:"used_memory"`
	NodeCount   int       `db:"node_count" json:"node_count"`
	Labels      JSONB     `db:"labels" json:"labels,omitempty"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type CapacityForecast struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenant_id"`
	ResourceType string    `db:"resource_type" json:"resource_type"`
	CurrentUsage float64   `db:"current_usage" json:"current_usage"`
	Predicted    float64   `db:"predicted" json:"predicted"`
	Threshold    float64   `db:"threshold" json:"threshold"`
	DaysUntilFull int      `db:"days_until_full" json:"days_until_full"`
	Recommendation string  `db:"recommendation" json:"recommendation,omitempty"`
	ForecastDate time.Time `db:"forecast_date" json:"forecast_date"`
}

type ScalingPolicy struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenant_id"`
	Name         string    `db:"name" json:"name"`
	ResourceType string    `db:"resource_type" json:"resource_type"`
	MinReplicas  int       `db:"min_replicas" json:"min_replicas"`
	MaxReplicas  int       `db:"max_replicas" json:"max_replicas"`
	ScaleUpThreshold   float64 `db:"scale_up_threshold" json:"scale_up_threshold"`
	ScaleDownThreshold float64 `db:"scale_down_threshold" json:"scale_down_threshold"`
	CooldownSec  int       `db:"cooldown_sec" json:"cooldown_sec"`
	Enabled      bool      `db:"enabled" json:"enabled"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

type CreatePoolRequest struct {
	Name         string  `json:"name" binding:"required"`
	ResourceType string  `json:"resource_type" binding:"required"`
	TotalCPU     float64 `json:"total_cpu"`
	TotalMemory  float64 `json:"total_memory"`
	NodeCount    int     `json:"node_count"`
	Labels       JSONB   `json:"labels"`
}

type CreatePolicyRequest struct {
	Name         string  `json:"name" binding:"required"`
	ResourceType string  `json:"resource_type" binding:"required"`
	MinReplicas  int     `json:"min_replicas"`
	MaxReplicas  int     `json:"max_replicas"`
	ScaleUpThreshold   float64 `json:"scale_up_threshold"`
	ScaleDownThreshold float64 `json:"scale_down_threshold"`
	CooldownSec  int     `json:"cooldown_sec"`
}

// CapacityMetric tracks a single resource measurement at a point in time.
type CapacityMetric struct {
	ID                string    `db:"id" json:"id"`
	TenantID          string    `db:"tenant_id" json:"tenant_id"`
	ResourceType      string    `db:"resource_type" json:"resource_type"`
	ResourceID        string    `db:"resource_id" json:"resource_id"`
	MetricName        string    `db:"metric_name" json:"metric_name"`
	CurrentValue      float64   `db:"current_value" json:"current_value"`
	MaxValue          float64   `db:"max_value" json:"max_value"`
	Unit              string    `db:"unit" json:"unit"`
	UtilizationPercent float64  `db:"utilization_percent" json:"utilization_percent"`
	RecordedAt        time.Time `db:"recorded_at" json:"recorded_at"`
}

// CapacityAlert represents a high-utilization warning.
type CapacityAlert struct {
	ID                string    `db:"id" json:"id"`
	TenantID          string    `db:"tenant_id" json:"tenant_id"`
	ResourceID        string    `db:"resource_id" json:"resource_id"`
	ResourceType      string    `db:"resource_type" json:"resource_type"`
	MetricName        string    `db:"metric_name" json:"metric_name"`
	CurrentUtilization float64  `db:"current_utilization" json:"current_utilization"`
	Threshold         float64   `db:"threshold" json:"threshold"`
	Severity          string    `db:"severity" json:"severity"`
	Message           string    `db:"message" json:"message"`
	CreatedAt         time.Time `db:"created_at" json:"created_at"`
}

// CapacityReport holds an aggregated capacity analysis snapshot.
type CapacityReport struct {
	ID              string    `db:"id" json:"id"`
	TenantID        string    `db:"tenant_id" json:"tenant_id"`
	Title           string    `db:"title" json:"title"`
	TotalResources  int       `db:"total_resources" json:"total_resources"`
	HealthyCount    int       `db:"healthy_count" json:"healthy_count"`
	WarningCount    int       `db:"warning_count" json:"warning_count"`
	CriticalCount   int       `db:"critical_count" json:"critical_count"`
	OverallScore    int       `db:"overall_score" json:"overall_score"`
	AlertsSnapshot  JSONB     `db:"alerts_snapshot" json:"alerts_snapshot,omitempty"`
	ForecastsSnapshot JSONB   `db:"forecasts_snapshot" json:"forecasts_snapshot,omitempty"`
	GeneratedAt     time.Time `db:"generated_at" json:"generated_at"`
}

// Bottleneck is the result of a capacity bottleneck analysis.
type Bottleneck struct {
	ResourceID    string  `json:"resource_id"`
	ResourceType  string  `json:"resource_type"`
	MetricName    string  `json:"metric_name"`
	Utilization   float64 `json:"utilization"`
	Impact        string  `json:"impact"`
	Recommendation string `json:"recommendation"`
}

// --- Request / Filter types ---

type RecordMetricRequest struct {
	ResourceType string  `json:"resource_type" binding:"required"`
	ResourceID   string  `json:"resource_id" binding:"required"`
	MetricName   string  `json:"metric_name" binding:"required"`
	CurrentValue float64 `json:"current_value"`
	MaxValue     float64 `json:"max_value"`
	Unit         string  `json:"unit"`
}

type MetricFilter struct {
	ResourceType string `form:"resource_type"`
	MetricName   string `form:"metric_name"`
}

type AlertFilter struct {
	Severity string `form:"severity"`
}

type ReportFilter struct {
	PaginatedRequest
}

type PaginatedRequest struct { Page int `form:"page"`; PageSize int `form:"page_size"` }
func (p *PaginatedRequest) Offset() int { if p.Page <= 0 { p.Page = 1 }; if p.PageSize <= 0 { p.PageSize = 20 }; return (p.Page - 1) * p.PageSize }
func (p *PaginatedRequest) Limit() int { if p.PageSize <= 0 { p.PageSize = 20 }; if p.PageSize > 100 { p.PageSize = 100 }; return p.PageSize }
