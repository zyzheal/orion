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

// Status constants for middleware instances.
const (
	StatusHealthy   = "healthy"
	StatusDegraded  = "degraded"
	StatusUnhealthy = "unhealthy"
	StatusUnknown   = "unknown"
)

// Alert type constants.
const (
	AlertTypeConnPoolExhaustion = "connection_pool_exhaustion"
	AlertTypeHighLatency        = "high_latency"
	AlertTypeQueueBacklog       = "queue_backlog"
	AlertTypeNodeDown           = "node_down"
	AlertTypeReplicationLag     = "replication_lag"
)

// Severity constants.
const (
	SeverityInfo     = "info"
	SeverityWarning  = "warning"
	SeverityCritical = "critical"
)

// Middleware type constants.
const (
	TypeRedis         = "redis"
	TypeKafka         = "kafka"
	TypeRabbitMQ      = "rabbitmq"
	TypeMySQL         = "mysql"
	TypePostgreSQL    = "postgresql"
	TypeElasticsearch = "elasticsearch"
	TypeMongoDB       = "mongodb"
	TypeNginx         = "nginx"
)

// ---- Existing entities ----

type MiddlewareInstance struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`
	Type      string    `db:"type" json:"type"`
	Version   string    `db:"version" json:"version"`
	Host      string    `db:"host" json:"host"`
	Port      int       `db:"port" json:"port"`
	Status    string    `db:"status" json:"status"`
	Config    JSONB     `db:"config" json:"config,omitempty"`
	Labels    JSONB     `db:"labels" json:"labels,omitempty"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

type BackupRecord struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenant_id"`
	InstanceID  string     `db:"instance_id" json:"instance_id"`
	Status      string     `db:"status" json:"status"`
	SizeBytes   int64      `db:"size_bytes" json:"size_bytes"`
	Location    string     `db:"location" json:"location"`
	StartedAt   time.Time  `db:"started_at" json:"started_at"`
	CompletedAt *time.Time `db:"completed_at" json:"completed_at,omitempty"`
}

// ---- New entities ported from Node.js ----

type MiddlewareMetric struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenant_id"`
	MiddlewareID string    `db:"middleware_id" json:"middleware_id"`
	MetricName   string    `db:"metric_name" json:"metric_name"`
	Value        float64   `db:"value" json:"value"`
	Unit         string    `db:"unit" json:"unit"`
	Timestamp    time.Time `db:"timestamp" json:"timestamp"`
}

type ConnectionPool struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenant_id"`
	MiddlewareID string    `db:"middleware_id" json:"middleware_id"`
	PoolName     string    `db:"pool_name" json:"pool_name"`
	Active       int       `db:"active" json:"active"`
	Idle         int       `db:"idle" json:"idle"`
	Max          int       `db:"max_conn" json:"max"`
	Waiting      int       `db:"waiting" json:"waiting"`
	TotalCreated int64     `db:"total_created" json:"total_created"`
	TotalClosed  int64     `db:"total_closed" json:"total_closed"`
	Timestamp    time.Time `db:"timestamp" json:"timestamp"`
}

type MessageQueueStats struct {
	ID                string    `db:"id" json:"id"`
	TenantID          string    `db:"tenant_id" json:"tenant_id"`
	MiddlewareID      string    `db:"middleware_id" json:"middleware_id"`
	QueueName         string    `db:"queue_name" json:"queue_name"`
	MessageCount      int64     `db:"message_count" json:"message_count"`
	ConsumerCount     int       `db:"consumer_count" json:"consumer_count"`
	MessagesPerSecond float64   `db:"messages_per_second" json:"messages_per_second"`
	AvgLatencyMs      float64   `db:"avg_latency_ms" json:"avg_latency_ms"`
	DeadLetterCount   int64     `db:"dead_letter_count" json:"dead_letter_count"`
	Timestamp         time.Time `db:"timestamp" json:"timestamp"`
}

type MiddlewareAlert struct {
	ID             string    `db:"id" json:"id"`
	TenantID       string    `db:"tenant_id" json:"tenant_id"`
	MiddlewareID   string    `db:"middleware_id" json:"middleware_id"`
	MiddlewareName string    `db:"middleware_name" json:"middleware_name"`
	AlertType      string    `db:"alert_type" json:"alert_type"`
	Severity       string    `db:"severity" json:"severity"`
	Message        string    `db:"message" json:"message"`
	Value          float64   `db:"value" json:"value"`
	Threshold      float64   `db:"threshold" json:"threshold"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
}

// ---- Request types ----

type CreateInstanceRequest struct {
	Name    string `json:"name" binding:"required"`
	Type    string `json:"type" binding:"required"`
	Version string `json:"version"`
	Host    string `json:"host" binding:"required"`
	Port    int    `json:"port"`
	Config  JSONB  `json:"config"`
	Labels  JSONB  `json:"labels"`
}

type CreateBackupRequest struct {
	InstanceID string `json:"instance_id" binding:"required"`
}

type CreateMetricRequest struct {
	MiddlewareID string  `json:"middleware_id" binding:"required"`
	MetricName  string  `json:"metric_name" binding:"required"`
	Value       float64 `json:"value" binding:"required"`
	Unit        string  `json:"unit" binding:"required"`
}

type CreateConnectionPoolRequest struct {
	MiddlewareID string `json:"middleware_id" binding:"required"`
	PoolName    string `json:"pool_name" binding:"required"`
	Active      int    `json:"active" binding:"required"`
	Idle        int    `json:"idle"`
	Max         int    `json:"max" binding:"required"`
	Waiting     int    `json:"waiting"`
}

type CreateMqStatsRequest struct {
	MiddlewareID      string  `json:"middleware_id" binding:"required"`
	QueueName         string  `json:"queue_name" binding:"required"`
	MessageCount      int64   `json:"message_count"`
	ConsumerCount     int     `json:"consumer_count"`
	MessagesPerSecond float64 `json:"messages_per_second"`
	AvgLatencyMs      float64 `json:"avg_latency_ms"`
	DeadLetterCount   int64   `json:"dead_letter_count"`
}

// ---- Pagination ----

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

// ---- Health summary response ----

type HealthSummary struct {
	TotalInstances int `json:"total_instances"`
	HealthyCount   int `json:"healthy_count"`
	DegradedCount  int `json:"degraded_count"`
	UnhealthyCount int `json:"unhealthy_count"`
	TotalAlerts    int `json:"total_alerts"`
	CriticalAlerts int `json:"critical_alerts"`
	HealthScore    int `json:"health_score"`
}

// ---- Internal aggregation types for health queries ----

type HealthCounts struct {
	Total     int `db:"total"`
	Healthy   int `db:"healthy"`
	Degraded  int `db:"degraded"`
	Unhealthy int `db:"unhealthy"`
}

type AlertCounts struct {
	Total    int `db:"total"`
	Critical int `db:"critical"`
}
