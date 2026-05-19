package monitor

import (
	"time"
)

// MetricType represents the type of metric
type MetricType string

const (
	MetricTypeCPU      MetricType = "CPU"
	MetricTypeMemory   MetricType = "MEMORY"
	MetricTypeDisk     MetricType = "DISK"
	MetricTypeNetwork  MetricType = "NETWORK"
	MetricTypeProcess  MetricType = "PROCESS"
	MetricTypeCustom   MetricType = "CUSTOM"
)

// AlertSeverity represents the severity of an alert
type AlertSeverity string

const (
	AlertSeverityInfo     AlertSeverity = "INFO"
	AlertSeverityWarning  AlertSeverity = "WARNING"
	AlertSeverityCritical AlertSeverity = "CRITICAL"
)

// AlertStatus represents the status of an alert
type AlertStatus string

const (
	AlertStatusFiring  AlertStatus = "FIRING"
	AlertStatusResolved AlertStatus = "RESOLVED"
)

// Metric represents a system metric
type Metric struct {
	ID        string     `json:"id" gorm:"primaryKey"`
	HostID    string     `json:"host_id" gorm:"index"`
	Name      string     `json:"name"`
	Type      MetricType `json:"type"`
	Value     float64    `json:"value"`
	Unit      string     `json:"unit"`
	Timestamp time.Time  `json:"timestamp" gorm:"index"`
	Labels    string     `json:"labels"` // JSON map of labels
}

// Alert represents a monitoring alert
type Alert struct {
	ID          string        `json:"id" gorm:"primaryKey"`
	TenantID    int64         `json:"tenant_id" gorm:"index"`
	HostID      string        `json:"host_id" gorm:"index"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Severity    AlertSeverity `json:"severity"`
	Status      AlertStatus   `json:"status" gorm:"default:FIRING"`
	MetricName  string        `json:"metric_name"`
	Threshold   float64       `json:"threshold"`
	CurrentValue float64      `json:"current_value"`
	FiredAt     *time.Time    `json:"fired_at"`
	ResolvedAt  *time.Time    `json:"resolved_at"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
}