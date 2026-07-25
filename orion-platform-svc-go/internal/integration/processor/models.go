// Package processor provides the Integration Processor engine: a pluggable
// system for executing third-party integrations (API, webhook, message queue,
// database) through a unified lifecycle: transform input → dispatch to handler →
// transform output → record task.
//
// It does not replace the existing integration CRUD (models/service/handler) but
// provides the runtime execution layer consumed by those higher-level components.
package processor

import (
	"time"
)

// ---------------------------------------------------------------------------
// Integration type
// ---------------------------------------------------------------------------

// IntegrationType defines the protocol/transport of an integration.
type IntegrationType string

const (
	IntegrationTypeRESTAPI    IntegrationType = "rest_api"
	IntegrationTypeGraphQL    IntegrationType = "graphql"
	IntegrationTypeWebSocket  IntegrationType = "websocket"
	IntegrationTypeGRPC       IntegrationType = "grpc"
	IntegrationTypeKafka      IntegrationType = "kafka"
	IntegrationTypeRabbitMQ   IntegrationType = "rabbitmq"
	IntegrationTypeMongoDB    IntegrationType = "mongodb"
	IntegrationTypePostgreSQL IntegrationType = "postgres"
)

// AllIntegrationTypes lists every supported integration type.
var AllIntegrationTypes = []IntegrationType{
	IntegrationTypeRESTAPI,
	IntegrationTypeGraphQL,
	IntegrationTypeWebSocket,
	IntegrationTypeGRPC,
	IntegrationTypeKafka,
	IntegrationTypeRabbitMQ,
	IntegrationTypeMongoDB,
	IntegrationTypePostgreSQL,
}

// ---------------------------------------------------------------------------
// Integration — full integration definition for the processor
// ---------------------------------------------------------------------------

// Integration groups the metadata needed to execute a third-party integration.
type Integration struct {
	ID         string           `json:"id"`
	TenantID   string           `json:"tenant_id"`
	Name       string           `json:"name"`
	Type       IntegrationType  `json:"type"`
	Connection ConnectionConfig `json:"connection"`
	Status     string           `json:"status"` // enabled, disabled, error
	Enabled    bool             `json:"enabled"`
	CreatedAt  time.Time        `json:"created_at"`
	UpdatedAt  time.Time        `json:"updated_at"`
}

// ConnectionConfig holds the connection parameters for an integration.
type ConnectionConfig struct {
	// Endpoint is the remote host/URL (e.g. "https://api.example.com").
	Endpoint string `json:"endpoint"`
	// Protocol is the scheme ("https", "grpc", "amqp", "mongodb+srv", "postgres").
	Protocol string `json:"protocol"`
	// AuthMethod is the authentication strategy ("none", "bearer", "basic", "api_key", "mtls").
	AuthMethod string `json:"auth_method"`
	// AuthSecretKey is the name of the secret to look up (never store secrets inline).
	AuthSecretKey string `json:"auth_secret_key"`
	// Headers are static headers sent with every request (REST/WebSocket).
	Headers map[string]string `json:"headers"`
	// Timeout is the per-operation timeout. Zero means use the processor default.
	Timeout time.Duration `json:"timeout"`
	// Extra is an opaque bag for type-specific configuration.
	Extra map[string]interface{} `json:"extra"`
}

// Operation is a single unit of work against an integration.
type Operation struct {
	ID       string            `json:"id"`
	Name     string            `json:"name"`
	Method   string            `json:"method"` // GET, POST, PUT, DELETE (REST) / topic (MQ) / collection (DB)
	Path     string            `json:"path"`   // URL path, topic name, collection name
	Headers  map[string]string `json:"headers"`
	Payload  interface{}       `json:"payload"`
	Retry    int               `json:"retry"`   // number of retries; zero means default
	Timeout  time.Duration     `json:"timeout"` // per-operation timeout; zero means use integration default
	Metadata map[string]string `json:"metadata"`
}

// ---------------------------------------------------------------------------
// Task lifecycle
// ---------------------------------------------------------------------------

// TaskStatus represents the lifecycle state of a processing task.
type TaskStatus string

const (
	TaskStatusPending   TaskStatus = "pending"
	TaskStatusRunning   TaskStatus = "running"
	TaskStatusCompleted TaskStatus = "completed"
	TaskStatusFailed    TaskStatus = "failed"
	TaskStatusCancelled TaskStatus = "cancelled"
)

// TaskDirection represents the data flow direction.
type TaskDirection string

const (
	TaskDirectionInbound  TaskDirection = "inbound"
	TaskDirectionOutbound TaskDirection = "outbound"
)

// Task is a single integration execution unit.
type Task struct {
	ID            string                 `json:"id"`
	TenantID      string                 `json:"tenant_id"`
	IntegrationID string                 `json:"integration_id"`
	Direction     TaskDirection          `json:"direction"`
	Operation     *Operation             `json:"operation"`
	InputData     map[string]interface{} `json:"input_data"`
	OutputData    map[string]interface{} `json:"output_data"`
	Status        TaskStatus             `json:"status"`
	Error         string                 `json:"error"`
	StartedAt     *time.Time             `json:"started_at"`
	FinishedAt    *time.Time             `json:"finished_at"`
	DurationMs    int64                  `json:"duration_ms"`
	RetryCount    int                    `json:"retry_count"`
	CreatedAt     time.Time              `json:"created_at"`
}

// TaskEvent is emitted at each lifecycle transition for observability.
type TaskEvent struct {
	TaskID    string                 `json:"task_id"`
	EventType string                 `json:"event_type"` // created, started, completed, failed
	Message   string                 `json:"message"`
	Details   map[string]interface{} `json:"details"`
	Timestamp time.Time              `json:"timestamp"`
}
