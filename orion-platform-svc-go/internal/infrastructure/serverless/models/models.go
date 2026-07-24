package models

import "time"

// ServerlessFunction represents a serverless function definition.
type ServerlessFunction struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description,omitempty"`
	Runtime     string    `db:"runtime" json:"runtime"`
	Handler     string    `db:"handler" json:"handler"`
	Memory      int       `db:"memory" json:"memory"`
	Timeout     int       `db:"timeout" json:"timeout"`
	Environment string    `db:"environment" json:"environment,omitempty"`
	Code        string    `db:"code" json:"code,omitempty"`
	Replicas    int       `db:"replicas" json:"replicas"`
	Status      string    `db:"status" json:"status"`
	CreatedBy   string    `db:"created_by" json:"created_by"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type CreateFunctionRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Runtime     string `json:"runtime" binding:"required"`
	Handler     string `json:"handler" binding:"required"`
	Memory      int    `json:"memory"`
	Timeout     int    `json:"timeout"`
	Environment string `json:"environment"`
	Code        string `json:"code"`
	Replicas    int    `json:"replicas"`
}

type UpdateFunctionRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Runtime     *string `json:"runtime"`
	Handler     *string `json:"handler"`
	Memory      *int    `json:"memory"`
	Timeout     *int    `json:"timeout"`
	Environment *string `json:"environment"`
	Code        *string `json:"code"`
	Replicas    *int    `json:"replicas"`
}

// FunctionDeployment represents a deployment of a function.
type FunctionDeployment struct {
	ID         string    `db:"id" json:"id"`
	FunctionID string    `db:"function_id" json:"function_id"`
	TenantID   string    `db:"tenant_id" json:"tenant_id"`
	Version    string    `db:"version" json:"version"`
	Status     string    `db:"status" json:"status"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}

// FunctionTrigger represents a trigger attached to a function.
type FunctionTrigger struct {
	ID         string    `db:"id" json:"id"`
	TenantID   string    `db:"tenant_id" json:"tenant_id"`
	FunctionID string    `db:"function_id" json:"function_id"`
	Name       string    `db:"name" json:"name"`
	Type       string    `db:"type" json:"type"`
	Config     string    `db:"config" json:"config"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time `db:"updated_at" json:"updated_at"`
}

type CreateTriggerRequest struct {
	FunctionID string `json:"function_id" binding:"required"`
	Type       string `json:"type" binding:"required"`
	Name       string `json:"name" binding:"required"`
	Config     string `json:"config"`
}

// FunctionLog represents a log entry for a function invocation.
type FunctionLog struct {
	ID         string    `db:"id" json:"id"`
	FunctionID string    `db:"function_id" json:"function_id"`
	TenantID   string    `db:"tenant_id" json:"tenant_id"`
	Level      string    `db:"level" json:"level"`
	Message    string    `db:"message" json:"message"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}

// FunctionMetric represents a metric snapshot for a function.
type FunctionMetric struct {
	ID             string    `db:"id" json:"id"`
	FunctionID     string    `db:"function_id" json:"function_id"`
	TenantID       string    `db:"tenant_id" json:"tenant_id"`
	Invocations    int       `db:"invocations" json:"invocations"`
	AvgDurationMs  float64   `db:"avg_duration_ms" json:"avg_duration_ms"`
	ErrorCount     int       `db:"error_count" json:"error_count"`
	RecordedAt     time.Time `db:"recorded_at" json:"recorded_at"`
}