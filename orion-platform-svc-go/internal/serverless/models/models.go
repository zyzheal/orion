package models

import "time"

// FunctionRuntime is the language/runtime for a serverless function.
type FunctionRuntime string

const (
	RuntimeNodeJS FunctionRuntime = "nodejs"
	RuntimePython FunctionRuntime = "python"
	RuntimeGo     FunctionRuntime = "go"
	RuntimeJava   FunctionRuntime = "java"
	RuntimeDotnet FunctionRuntime = "dotnet"
)

// FunctionStatus describes the deployment state of a function.
type FunctionStatus string

const (
	StatusCreated  FunctionStatus = "created"
	StatusDeployed FunctionStatus = "deployed"
	StatusFailed   FunctionStatus = "failed"
	StatusScaling  FunctionStatus = "scaling"
	StatusInactive FunctionStatus = "inactive"
)

// TriggerType describes the trigger type for a serverless function.
type TriggerType string

const (
	TriggerHTTP        TriggerType = "http"
	TriggerTimer       TriggerType = "timer"
	TriggerQueue       TriggerType = "queue"
	TriggerEventBridge TriggerType = "eventbridge"
)

// Function represents a serverless function.
type Function struct {
	ID          string            `db:"id" json:"id"`
	TenantID    string            `db:"tenant_id" json:"tenant_id"`
	Name        string            `db:"name" json:"name"`
	Description *string           `db:"description" json:"description,omitempty"`
	Runtime     FunctionRuntime   `db:"runtime" json:"runtime"`
	Handler     string            `db:"handler" json:"handler"`
	Memory      int               `db:"memory" json:"memory"`
	Timeout     int               `db:"timeout" json:"timeout"`
	Environment map[string]string `db:"environment" json:"environment"`
	Code        string            `db:"code" json:"code"`
	Replicas    int               `db:"replicas" json:"replicas"`
	Status      FunctionStatus    `db:"status" json:"status"`
	CreatedAt   time.Time         `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time         `db:"updated_at" json:"updated_at"`
}

// CreateFunctionRequest is the body for creating a function.
type CreateFunctionRequest struct {
	Name        string            `json:"name" binding:"required"`
	Description *string           `json:"description"`
	Runtime     FunctionRuntime   `json:"runtime" binding:"required"`
	Handler     string            `json:"handler" binding:"required"`
	Memory      int               `json:"memory"`
	Timeout     int               `json:"timeout"`
	Environment map[string]string `json:"environment"`
	Code        string            `json:"code"`
	Replicas    int               `json:"replicas"`
}

// UpdateFunctionRequest is the body for updating a function.
type UpdateFunctionRequest struct {
	Name        *string           `json:"name"`
	Description *string           `json:"description"`
	Runtime     *FunctionRuntime  `json:"runtime"`
	Handler     *string           `json:"handler"`
	Memory      *int              `json:"memory"`
	Timeout     *int              `json:"timeout"`
	Environment map[string]string `json:"environment"`
	Code        *string           `json:"code"`
	Replicas    *int              `json:"replicas"`
}

// ListFunctionsQuery filters used when listing functions.
type ListFunctionsQuery struct {
	Status  *FunctionStatus
	Runtime *FunctionRuntime
}

// Deployment represents a deployment of a function.
type Deployment struct {
	ID         string    `db:"id" json:"id"`
	TenantID   string    `db:"tenant_id" json:"tenant_id"`
	FunctionID string    `db:"function_id" json:"function_id"`
	Status     string    `db:"status" json:"status"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time `db:"updated_at" json:"updated_at"`
}

// InvokeResult is the result of invoking a function.
type InvokeResult struct {
	Success    bool   `json:"success"`
	Output     string `json:"output,omitempty"`
	Error      string `json:"error,omitempty"`
	DurationMs int    `json:"duration_ms"`
}

// FunctionLog represents a log entry for a function invocation.
type FunctionLog struct {
	ID         string    `db:"id" json:"id"`
	TenantID   string    `db:"tenant_id" json:"tenant_id"`
	FunctionID string    `db:"function_id" json:"function_id"`
	Level      string    `db:"level" json:"level"`
	Message    string    `db:"message" json:"message"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}

// GetFunctionLogsQuery filters used when getting function logs.
type GetFunctionLogsQuery struct {
	Level *string
	Limit *int
}

// FunctionMetric represents a metric for a function.
type FunctionMetric struct {
	FunctionID    string  `db:"function_id" json:"function_id"`
	Invocations   int64   `json:"invocations"`
	AvgDurationMs float64 `json:"avg_duration_ms"`
	ErrorCount    int64   `json:"error_count"`
	ErrorRate     float64 `json:"error_rate"`
	MemoryUsageMB float64 `json:"memory_usage_mb"`
}

// AggregateMetrics returns aggregate metrics across all functions for a tenant.
type AggregateMetrics struct {
	TenantID         string           `json:"tenant_id"`
	TotalFunctions   int              `json:"total_functions"`
	TotalInvocations int64            `json:"total_invocations"`
	AvgErrorRate     float64          `json:"avg_error_rate"`
	TopFunctions     []FunctionMetric `json:"top_functions"`
}

// Trigger represents a trigger for a serverless function.
type Trigger struct {
	ID         string      `db:"id" json:"id"`
	TenantID   string      `db:"tenant_id" json:"tenant_id"`
	FunctionID string      `db:"function_id" json:"function_id"`
	Type       TriggerType `db:"type" json:"type"`
	Name       string      `db:"name" json:"name"`
	Config     string      `db:"config" json:"config"`
	CreatedAt  time.Time   `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time   `db:"updated_at" json:"updated_at"`
}

// CreateTriggerRequest is the body for creating a trigger.
type CreateTriggerRequest struct {
	FunctionID string      `json:"function_id" binding:"required"`
	Type       TriggerType `json:"type" binding:"required"`
	Name       string      `json:"name" binding:"required"`
	Config     string      `json:"config"`
}

// ListTriggersQuery filters used when listing triggers.
type ListTriggersQuery struct {
	FunctionID *string
	Type       *TriggerType
}

// AutoScalingRecommendation represents an auto-scaling recommendation.
type AutoScalingRecommendation struct {
	FunctionID          string `json:"function_id"`
	FunctionName        string `json:"function_name"`
	CurrentReplicas     int    `json:"current_replicas"`
	RecommendedReplicas int    `json:"recommended_replicas"`
	Reason              string `json:"reason"`
}
