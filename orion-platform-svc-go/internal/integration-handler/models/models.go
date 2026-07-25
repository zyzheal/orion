// Package models defines data models for the Integration Handler service.
//
// The Integration Handler provides a pluggable factory for third-party system
// integrations (webhook, REST API, gRPC, SFTP, file, Kafka, RabbitMQ, HTTP client).
// It manages integration lifecycle, task execution, and operation logging.
//
// Tables: integrations, integration_tasks, integration_logs
package models

import "time"

// ---------------------------------------------------------------------------
// Integration — a configured third-party system connection
// ---------------------------------------------------------------------------

// IntegrationStatus represents the lifecycle state of an integration.
type IntegrationStatus string

const (
	IntegrationStatusEnabled  IntegrationStatus = "enabled"
	IntegrationStatusDisabled IntegrationStatus = "disabled"
	IntegrationStatusError    IntegrationStatus = "error"
)

// IntegrationType represents the protocol/transport type of the integration.
type IntegrationType string

const (
	IntegrationTypeWebhook   IntegrationType = "webhook"
	IntegrationTypeRestAPI   IntegrationType = "rest_api"
	IntegrationTypeGrpc      IntegrationType = "grpc"
	IntegrationTypeSftp      IntegrationType = "sftp"
	IntegrationTypeFile      IntegrationType = "file"
	IntegrationTypeKafka     IntegrationType = "kafka"
	IntegrationTypeRabbitmq  IntegrationType = "rabbitmq"
	IntegrationTypeHttpClient IntegrationType = "http_client"
)

var ValidIntegrationTypes = map[IntegrationType]bool{
	IntegrationTypeWebhook:   true,
	IntegrationTypeRestAPI:   true,
	IntegrationTypeGrpc:      true,
	IntegrationTypeSftp:      true,
	IntegrationTypeFile:      true,
	IntegrationTypeKafka:     true,
	IntegrationTypeRabbitmq:  true,
	IntegrationTypeHttpClient: true,
}

// Integration represents a configured third-party system integration.
type Integration struct {
	ID          string            `db:"id" json:"id"`
	TenantID    string            `db:"tenant_id" json:"tenant_id"`
	Name        string            `db:"name" json:"name"`
	Type        string            `db:"type" json:"type"`          // webhook, rest_api, grpc, sftp, file, kafka, rabbitmq, http_client
	HandlerType string            `db:"handler_type" json:"handler_type"` // handler class name
	Config      string            `db:"config" json:"config"`      // JSON: connection settings
	Status      string            `db:"status" json:"status"`      // enabled, disabled, error
	Error       string            `db:"error" json:"error"`
	Enabled     bool              `db:"enabled" json:"enabled"`
	CreatedAt   time.Time         `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time         `db:"updated_at" json:"updated_at"`
}

// CreateIntegrationRequest is the request body for creating an integration.
type CreateIntegrationRequest struct {
	Name        string            `json:"name" binding:"required"`
	Type        string            `json:"type" binding:"required"`
	HandlerType string            `json:"handler_type"`
	Config      map[string]string `json:"config"`
}

// UpdateIntegrationRequest is the request body for updating an integration.
type UpdateIntegrationRequest struct {
	Name        *string           `json:"name"`
	Type        *string           `json:"type"`
	HandlerType *string           `json:"handler_type"`
	Config      map[string]string `json:"config"`
	Status      *string           `json:"status"`
	Enabled     *bool             `json:"enabled"`
}

// ---------------------------------------------------------------------------
// IntegrationTask — a single send/receive operation
// ---------------------------------------------------------------------------

// TaskStatus represents the lifecycle state of an integration task.
type TaskStatus string

const (
	TaskStatusPending    TaskStatus = "pending"
	TaskStatusProcessing TaskStatus = "processing"
	TaskStatusCompleted  TaskStatus = "completed"
	TaskStatusFailed     TaskStatus = "failed"
)

var ValidTaskStatuses = map[TaskStatus]bool{
	TaskStatusPending:    true,
	TaskStatusProcessing: true,
	TaskStatusCompleted:  true,
	TaskStatusFailed:     true,
}

// TaskDirection represents the data flow direction.
type TaskDirection string

const (
	TaskDirectionInbound  TaskDirection = "inbound"
	TaskDirectionOutbound TaskDirection = "outbound"
)

// IntegrationTask represents a single send/receive operation.
type IntegrationTask struct {
	ID            string     `db:"id" json:"id"`
	TenantID      string     `db:"tenant_id" json:"tenant_id"`
	IntegrationID string     `db:"integration_id" json:"integration_id"`
	Direction     string     `db:"direction" json:"direction"`   // inbound, outbound
	Data          string     `db:"data" json:"data"`             // JSON payload
	Status        string     `db:"status" json:"status"`         // pending, processing, completed, failed
	Error         string     `db:"error" json:"error"`
	Response      string     `db:"response" json:"response"`
	StartedAt     time.Time  `db:"started_at" json:"started_at"`
	FinishedAt    *time.Time `db:"finished_at" json:"finished_at"`
	DurationMs    int64      `db:"duration_ms" json:"duration_ms"`
	CreatedAt     time.Time  `db:"created_at" json:"created_at"`
}

// CreateTaskRequest is the request body for creating an integration task.
type CreateTaskRequest struct {
	IntegrationID string                 `json:"integration_id" binding:"required"`
	Direction     string                 `json:"direction" binding:"required"`
	Data          map[string]interface{} `json:"data"`
}

// ---------------------------------------------------------------------------
// IntegrationLog — an operation log entry
// ---------------------------------------------------------------------------

// LogLevel represents the log severity.
type LogLevel string

const (
	LogLevelInfo  LogLevel = "info"
	LogLevelWarn  LogLevel = "warn"
	LogLevelError LogLevel = "error"
)

// IntegrationLog represents an operation log entry.
type IntegrationLog struct {
	ID        string    `db:"id" json:"id"`
	TaskID    string    `db:"task_id" json:"task_id"`
	Level     string    `db:"level" json:"level"`    // info, warn, error
	Message   string    `db:"message" json:"message"`
	Details   string    `db:"details" json:"details"` // JSON
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// ---------------------------------------------------------------------------
// Pagination helpers
// ---------------------------------------------------------------------------

// ListOptions holds pagination and filter parameters.
type ListOptions struct {
	Offset int
	Limit  int
}

// NewListOptions creates default pagination (page 1, page_size 20).
func NewListOptions(page, pageSize int) ListOptions {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
	pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return ListOptions{
		Offset: (page - 1) * pageSize,
		Limit:  pageSize,
	}
}
