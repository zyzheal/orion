package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB is a PostgreSQL JSONB-compatible map type.
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

// ==================== Dashboard ====================

// Dashboard represents a visualization dashboard with configurable widgets.
type Dashboard struct {
	ID            string    `db:"id" json:"id"`
	TenantID      string    `db:"tenant_id" json:"tenant_id"`
	Name          string    `db:"name" json:"name"`
	DashboardType string    `db:"dashboard_type" json:"dashboard_type"`
	Config        JSONB     `db:"config" json:"config"`
	Layout        JSONB     `db:"layout" json:"layout,omitempty"`
	Shared        bool      `db:"shared" json:"shared"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
}

type CreateDashboardRequest struct {
	Name          string `json:"name" binding:"required"`
	DashboardType string `json:"dashboard_type" binding:"required"`
	Config        JSONB  `json:"config" binding:"required"`
}

type UpdateDashboardRequest struct {
	Name          *string `json:"name"`
	DashboardType *string `json:"dashboard_type"`
	Config        JSONB   `json:"config"`
	Layout        JSONB   `json:"layout"`
	Shared        *bool   `json:"shared"`
}

// ==================== Monitor Host ====================

// MonitorHost represents a managed host for ops visualization and monitoring.
type MonitorHost struct {
	ID            string     `db:"id" json:"id"`
	TenantID      string     `db:"tenant_id" json:"tenant_id"`
	Name          string     `db:"name" json:"name"`
	Host          string     `db:"host" json:"host"`
	Port          int        `db:"port" json:"port"`
	Status        string     `db:"status" json:"status"`
	OSType        *string    `db:"os_type" json:"os_type,omitempty"`
	Tags          JSONB      `db:"tags" json:"tags"`
	AgentID       *string    `db:"agent_id" json:"agent_id,omitempty"`
	LastHeartbeat *time.Time `db:"last_heartbeat" json:"last_heartbeat,omitempty"`
	CreatedAt     time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time  `db:"updated_at" json:"updated_at"`
}

type CreateHostRequest struct {
	Name   string `json:"name" binding:"required"`
	Host   string `json:"host" binding:"required"`
	Port   int    `json:"port"`
	OSType string `json:"os_type"`
	Tags   JSONB  `json:"tags"`
}

type UpdateHostRequest struct {
	Name   *string `json:"name"`
	Host   *string `json:"host"`
	Port   *int    `json:"port"`
	OSType *string `json:"os_type"`
	Tags   JSONB   `json:"tags"`
	Status *string `json:"status"`
}

// ==================== Alert Rule ====================

// AlertRule defines a configurable alerting rule that monitors a metric
// against a threshold condition (>, <, >=, <=, ==, !=).
type AlertRule struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Metric      string    `db:"metric" json:"metric"`
	Condition   string    `db:"condition" json:"condition"`
	Threshold   float64   `db:"threshold" json:"threshold"`
	Severity    string    `db:"severity" json:"severity"`
	Enabled     bool      `db:"enabled" json:"enabled"`
	Suppressed  bool      `db:"suppressed" json:"suppressed"`
	CooldownMs  int       `db:"cooldown_ms" json:"cooldown_ms"`
	Tags        JSONB     `db:"tags" json:"tags"`
	Description *string   `db:"description" json:"description,omitempty"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type CreateAlertRuleRequest struct {
	Name        string  `json:"name" binding:"required"`
	Metric      string  `json:"metric" binding:"required"`
	Condition   string  `json:"condition" binding:"required"`
	Threshold   float64 `json:"threshold"`
	Severity    string  `json:"severity"`
	CooldownMs  int     `json:"cooldown_ms"`
	Tags        JSONB   `json:"tags"`
	Description string  `json:"description"`
}

type UpdateAlertRuleRequest struct {
	Name        *string  `json:"name"`
	Metric      *string  `json:"metric"`
	Condition   *string  `json:"condition"`
	Threshold   *float64 `json:"threshold"`
	Severity    *string  `json:"severity"`
	Enabled     *bool    `json:"enabled"`
	Suppressed  *bool    `json:"suppressed"`
	CooldownMs  *int     `json:"cooldown_ms"`
	Tags        JSONB    `json:"tags"`
	Description *string  `json:"description"`
}

// ==================== Alert Instance ====================

// AlertInstance represents a triggered alert record created when a rule
// threshold is breached.
type AlertInstance struct {
	ID             string     `db:"id" json:"id"`
	TenantID       string     `db:"tenant_id" json:"tenant_id"`
	RuleID         string     `db:"rule_id" json:"rule_id"`
	RuleName       *string    `db:"rule_name" json:"rule_name,omitempty"`
	Metric         string     `db:"metric" json:"metric"`
	Value          float64    `db:"value" json:"value"`
	Threshold      float64    `db:"threshold" json:"threshold"`
	Severity       string     `db:"severity" json:"severity"`
	Status         string     `db:"status" json:"status"`
	Message        *string    `db:"message" json:"message,omitempty"`
	TriggeredAt    time.Time  `db:"triggered_at" json:"triggered_at"`
	AcknowledgedAt *time.Time `db:"acknowledged_at" json:"acknowledged_at,omitempty"`
	AcknowledgedBy *string    `db:"acknowledged_by" json:"acknowledged_by,omitempty"`
	ResolvedAt     *time.Time `db:"resolved_at" json:"resolved_at,omitempty"`
	Tags           JSONB      `db:"tags" json:"tags"`
}

// ==================== Metric Data Point ====================

// MetricDataPoint is a single time-series data point for a named metric.
type MetricDataPoint struct {
	ID         int64     `db:"id" json:"id"`
	TenantID   string    `db:"tenant_id" json:"tenant_id"`
	MetricName string    `db:"metric_name" json:"metric_name"`
	Value      float64   `db:"value" json:"value"`
	Tags       JSONB     `db:"tags" json:"tags"`
	Timestamp  time.Time `db:"timestamp" json:"timestamp"`
}

type RecordMetricRequest struct {
	MetricName string            `json:"metric_name" binding:"required"`
	Value      float64           `json:"value"`
	Tags       map[string]string `json:"tags"`
}

// ==================== Notification Channel ====================

// NotificationChannel stores configuration for an alert delivery channel
// (email, webhook, slack).
type NotificationChannel struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`
	Type      string    `db:"type" json:"type"`
	Config    JSONB     `db:"config" json:"config"`
	Enabled   bool      `db:"enabled" json:"enabled"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

type CreateChannelRequest struct {
	Name   string `json:"name" binding:"required"`
	Type   string `json:"type" binding:"required"`
	Config JSONB  `json:"config" binding:"required"`
}

// ==================== Notification History ====================

// NotificationHistory records the outcome of each notification delivery attempt.
type NotificationHistory struct {
	ID           string  `db:"id" json:"id"`
	TenantID     string  `db:"tenant_id" json:"tenant_id"`
	AlertID      string  `db:"alert_id" json:"alert_id"`
	ChannelID    string  `db:"channel_id" json:"channel_id"`
	ChannelType  string  `db:"channel_type" json:"channel_type"`
	Status       string  `db:"status" json:"status"`
	ErrorMessage *string `db:"error_message" json:"error_message,omitempty"`
	SentAt       time.Time `db:"sent_at" json:"sent_at"`
}

// ==================== Common ====================

// PaginatedRequest holds pagination query parameters.
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

// AlertStats aggregates alert counts by status and severity.
type AlertStats struct {
	Total        int `db:"total" json:"total"`
	Firing       int `db:"firing" json:"firing"`
	Acknowledged int `db:"acknowledged" json:"acknowledged"`
	Resolved     int `db:"resolved" json:"resolved"`
	Critical     int `db:"critical" json:"critical"`
	Warning      int `db:"warning" json:"warning"`
}

// PaginatedResult wraps a paginated list response.
type PaginatedResult struct {
	Data       interface{} `json:"data"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
	TotalPages int         `json:"total_pages"`
}
